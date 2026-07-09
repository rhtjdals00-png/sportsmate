import math
import re
from datetime import datetime
from urllib.parse import urlencode

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import ChatbotMessage, ChatbotSession, ChatbotUserMemory, Meeting, Participant, Region, Sport, User
from app.services.location_service import search_places
from app.services.openai_service import generate_openai_chatbot_nlu, generate_openai_chatbot_reply
from app.utils.timezone import kst_now

chatbot_bp = Blueprint("chatbot", __name__)

TIME_KEYWORDS = ["아침", "오전", "점심", "오후", "저녁", "밤", "야간", "새벽", "주말", "평일", "토요일", "일요일"]
INTENT_SCHEDULE = ["내 일정", "일정", "스케줄", "참여", "신청한", "내 모임", "언제"]
INTENT_RECOMMEND = ["찾아", "추천", "모임", "운동", "할만한", "갈만한", "근처", "주변"]
SCHEDULE_ONLY_HINTS = ["내 모임", "내 일정", "내가 만든", "참여 중", "참여중", "참여한", "신청한", "가입한"]
RECOMMEND_STRONG_HINTS = ["찾아", "찾아줘", "찾아봐", "추천", "할만한", "갈만한", "근처", "주변", "부근", "인근", "맞춤"]
LOCATION_HINTS = ["근처", "주변", "부근", "쪽", "인근"]
LOCATION_HINT_PATTERN = r"(?:근처|주변|부근|쪽|인근)(?:에서는|에서|으로는|으로|에는|이라도|엔|에|로)?"
PERSONALIZED_HINTS = ["나한테", "내 취향", "맞춤", "선호", "관심", "좋아하는", "내가 좋아"]
MY_LOCATION_PATTERNS = [r"내\s*(?:주변|근처|위치)", r"현재\s*위치", r"주변\s*모임"]
SEARCH_STOPWORDS = {"모임", "운동", "추천", "찾아", "찾아줘", "찾아봐", "찾아봐줘", "찾아봐줄래", "알려줘", "근처", "주변", "부근", "쪽", "인근", "할만한", "갈만한", "이번", "주말", "평일", "오늘", "내일", "지금", "모집중", "모집중인", "뭐야", "뭐가", "있어"}
NEARBY_RADIUS_KM = 6
PLACE_COORD_FALLBACKS = {
    "잠실": (37.5133, 127.1002),
    "잠실역": (37.5133, 127.1002),
    "반포": (37.5048, 126.9947),
    "여의도": (37.5264, 126.9240),
    "한강": (37.5219, 126.9391),
    "강남": (37.4979, 127.0276),
    "홍대": (37.5572, 126.9238),
    "성수": (37.5446, 127.0557),
    "상암": (37.5683, 126.8972),
    "상암동": (37.5782, 126.8946),
    "상암월드컵경기장": (37.5683, 126.8972),
    "서울월드컵경기장": (37.5683, 126.8972),
}
PLACEHOLDER_REGIONS = {"", "서울", "?쒖슱", "전국", "지역 미설정", "활동 지역 미설정", "미설정"}
PLACEHOLDER_REGION_PREFIXES = ("?", "�")
REGION_TEXT_ALIASES = {
    "서울": "서울",
    "서울시": "서울",
    "서울특별시": "서울특별시",
    "수원": "수원",
    "수원시": "수원시",
    "용산": "용산구",
    "용산구": "용산구",
}


def ensure_session_access(session_id, user_id):
    session = ChatbotSession.query.get_or_404(session_id)
    if session.user_id != user_id:
        raise PermissionError("해당 대화에 접근할 권한이 없습니다.")
    return session


def csv_items(value):
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def merge_csv(*values, limit=12):
    merged = []
    seen = set()
    for value in values:
        items = value if isinstance(value, list) else csv_items(value)
        for item in items:
            normalized = item.strip()
            key = normalized.lower()
            if normalized and key not in seen:
                merged.append(normalized)
                seen.add(key)
            if len(merged) >= limit:
                return ", ".join(merged)
    return ", ".join(merged)


def is_meaningful_region(value):
    normalized = (value or "").strip()
    if not normalized or normalized in PLACEHOLDER_REGIONS:
        return False
    if any(normalized.startswith(prefix) for prefix in PLACEHOLDER_REGION_PREFIXES):
        return False
    return True


def meaningful_regions(*values):
    regions = []
    for value in values:
        regions.extend(csv_items(value) if isinstance(value, str) else [value])
    return [region for region in regions if is_meaningful_region(region)]


def clean_memory_regions(value):
    return meaningful_regions(value)


def contains_any(text, keywords):
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def should_use_personalized_preferences(content):
    return contains_any(content or "", PERSONALIZED_HINTS) or is_my_nearby_request(content)


def is_schedule_intent(content):
    return contains_any(content or "", INTENT_SCHEDULE)


def is_recommend_intent(content):
    text = content or ""
    if is_schedule_intent(text) and contains_any(text, SCHEDULE_ONLY_HINTS):
        return False
    normalized = normalize_query_token(text)
    if normalized in PLACE_COORD_FALLBACKS or normalized in REGION_TEXT_ALIASES:
        return True
    if len(normalized) >= 2 and Sport.query.filter(Sport.name == normalized).first():
        return True
    return contains_any(text, RECOMMEND_STRONG_HINTS) or ("모임" in text and not is_schedule_intent(text))


def fallback_chatbot_nlu(content):
    extracted = extract_preferences_from_text(content)
    normalized = normalize_query_token(content)
    if normalized in PLACE_COORD_FALLBACKS and normalized not in extracted["places"]:
        extracted["places"].insert(0, normalized)
    if normalized in REGION_TEXT_ALIASES and REGION_TEXT_ALIASES[normalized] not in extracted["regions"]:
        extracted["regions"].append(REGION_TEXT_ALIASES[normalized])
    if normalized and normalized not in extracted["sports"]:
        sport = Sport.query.filter(Sport.name == normalized).first()
        if sport:
            extracted["sports"].append(sport.name)
    location_query = (extracted.get("places") or extracted.get("regions") or [""])[0]
    if is_my_nearby_request(content):
        location_kind = "current"
    elif location_query:
        location_kind = "explicit"
    elif should_use_personalized_preferences(content):
        location_kind = "profile"
    else:
        location_kind = "none"
    return {
        "intent": "schedule" if is_schedule_intent(content) else ("recommend" if is_recommend_intent(content) else "general"),
        "location_query": location_query,
        "location_kind": location_kind,
        "radius_km": NEARBY_RADIUS_KM if location_kind in {"current", "explicit"} else None,
        "sport": (extracted.get("sports") or [""])[0],
        "use_profile": should_use_personalized_preferences(content),
        "time_hint": (extracted.get("times") or [""])[0],
        "keywords": extracted.get("keywords") or [],
    }


def normalize_chatbot_nlu(value, content):
    fallback = fallback_chatbot_nlu(content)
    if not isinstance(value, dict):
        return fallback
    intent = value.get("intent") if value.get("intent") in {"schedule", "recommend", "general"} else fallback["intent"]
    if intent == "general" and fallback["intent"] == "recommend" and (fallback.get("sport") or fallback.get("location_query")):
        intent = "recommend"
    location_kind = value.get("location_kind") if value.get("location_kind") in {"explicit", "current", "profile", "none"} else fallback["location_kind"]
    radius = coerce_float(value.get("radius_km"))
    return {
        "intent": intent,
        "location_query": (value.get("location_query") or fallback["location_query"] or "").strip(),
        "location_kind": location_kind,
        "radius_km": radius or fallback["radius_km"],
        "sport": (value.get("sport") or fallback["sport"] or "").strip(),
        "use_profile": bool(value.get("use_profile", fallback["use_profile"])),
        "time_hint": (value.get("time_hint") or fallback["time_hint"] or "").strip(),
        "keywords": value.get("keywords") if isinstance(value.get("keywords"), list) else fallback["keywords"],
    }


def interpret_chatbot_query(content, user=None, memory=None, use_ai=True):
    context = {}
    if user:
        context["profile"] = user_profile_context(user)
    if memory:
        context["memory"] = memory.to_dict()
    ai_nlu = generate_openai_chatbot_nlu(content, context) if use_ai else None
    return normalize_chatbot_nlu(ai_nlu, content)


def clean_title(value):
    return (value or "새로운 대화").strip()[:40] or "새로운 대화"


def user_profile_context(user):
    profile = user.profile
    if not profile:
        return {"sports": [], "regions": [], "level": "", "summary_parts": []}
    sports = csv_items(profile.preferred_sports)
    regions = meaningful_regions(profile.region, profile.region_2)
    level = profile.exercise_level or ""
    has_explicit_preference = bool(sports or regions)

    summary_parts = []
    if sports:
        summary_parts.append(f"선호 종목: {', '.join(sports)}")
    if regions:
        summary_parts.append(f"선호 지역: {', '.join(regions)}")
    if level and has_explicit_preference:
        summary_parts.append(f"운동 레벨: {level}")
    return {
        "sports": sports,
        "regions": regions,
        "level": level if has_explicit_preference else "",
        "summary_parts": summary_parts,
    }


def compact_unique(items):
    result = []
    seen = set()
    for item in items:
        normalized = (item or "").strip()
        key = normalized.lower()
        if normalized and key not in seen:
            result.append(normalized)
            seen.add(key)
    return result


def location_term_variants(term):
    variants = [term]
    for part in re.split(r"\s+", term or ""):
        if len(part) >= 2:
            variants.append(part)
    return compact_unique(variants)


def distance_km(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2):
        return None
    radius = 6371
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    delta_phi = math.radians(float(lat2) - float(lat1))
    delta_lambda = math.radians(float(lng2) - float(lng1))
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return round(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)


def resolve_place_coordinate(term):
    normalized = (term or "").strip()
    if not normalized:
        return None
    if normalized in PLACE_COORD_FALLBACKS:
        lat, lng = PLACE_COORD_FALLBACKS[normalized]
        return {"term": normalized, "latitude": lat, "longitude": lng, "source": "fallback"}
    try:
        result = search_places(normalized, size=1)
    except Exception:
        result = None
    item = (result or {}).get("items", [{}])[0] if (result or {}).get("items") else None
    if not item or item.get("latitude") is None or item.get("longitude") is None:
        return None
    return {
        "term": normalized,
        "latitude": item.get("latitude"),
        "longitude": item.get("longitude"),
        "source": item.get("source") or (result or {}).get("source") or "",
    }


def resolve_nearby_context(terms):
    for term in terms:
        resolved = resolve_place_coordinate(term)
        if resolved:
            resolved["radius_km"] = NEARBY_RADIUS_KM
            return resolved
    return None


def is_my_nearby_request(content):
    return any(re.search(pattern, content or "") for pattern in MY_LOCATION_PATTERNS)


def coerce_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def request_location_context(payload):
    payload = payload or {}
    location = payload.get("location") or payload.get("user_location") or {}
    latitude = coerce_float(location.get("latitude") or location.get("lat") or payload.get("latitude") or payload.get("lat"))
    longitude = coerce_float(location.get("longitude") or location.get("lng") or payload.get("longitude") or payload.get("lng"))
    if latitude is None or longitude is None:
        return None
    return {
        "term": "내 현재 위치",
        "latitude": latitude,
        "longitude": longitude,
        "source": "browser",
        "radius_km": NEARBY_RADIUS_KM,
    }


def profile_location_context(user):
    profile = user.profile
    if not profile:
        return None
    latitude = coerce_float(profile.region_latitude)
    longitude = coerce_float(profile.region_longitude)
    if latitude is None or longitude is None:
        return None
    return {
        "term": profile.region or "내 활동지역",
        "latitude": latitude,
        "longitude": longitude,
        "source": "profile",
        "radius_km": NEARBY_RADIUS_KM,
    }


def my_nearby_context(user, content, payload=None):
    if not is_my_nearby_request(content):
        return None
    return request_location_context(payload) or profile_location_context(user) or {
        "term": "내 주변",
        "needs_location": True,
        "radius_km": NEARBY_RADIUS_KM,
    }


def normalize_query_token(token):
    normalized = (token or "").strip()
    for suffix in ("으로", "에서", "에게", "까지", "부터", "처럼", "하고", "이랑", "을", "를", "이", "가", "은", "는", "에", "로", "와", "과", "도", "만"):
        if normalized.endswith(suffix) and len(normalized) > len(suffix) + 1:
            normalized = normalized[: -len(suffix)]
            break
    return normalized


def clean_place_phrase(value):
    phrase = re.sub(r"\s+", " ", value or "").strip(" ,.!?~")
    phrase = re.sub(LOCATION_HINT_PATTERN + r".*$", "", phrase).strip(" ,.!?~")
    phrase = re.sub(r"(?:에서|으로|로|에)$", "", phrase).strip()
    return phrase


def extract_place_terms(content, sports=None, regions=None):
    sports = sports or []
    regions = regions or []
    blocked = {item.lower() for item in [*sports, *regions, *TIME_KEYWORDS, *INTENT_RECOMMEND, *SEARCH_STOPWORDS]}
    terms = []
    for match in re.finditer(r"([가-힣A-Za-z0-9][가-힣A-Za-z0-9\s]{1,30}?)\s*" + LOCATION_HINT_PATTERN, content or ""):
        phrase = clean_place_phrase(match.group(1))
        if phrase and phrase.lower() not in blocked:
            terms.append(phrase)
    for match in re.finditer(r"([가-힣A-Za-z0-9]{2,20})\s*" + LOCATION_HINT_PATTERN, content or ""):
        terms.append(normalize_query_token(match.group(1)))
    if contains_any(content or "", LOCATION_HINTS):
        for raw_token in re.findall(r"[가-힣A-Za-z0-9]{2,20}", content or ""):
            token = normalize_query_token(raw_token)
            key = token.lower()
            if key not in blocked and not any(key == sport.lower() for sport in sports):
                terms.append(token)
    return compact_unique(terms)


def extract_preferences_from_text(content):
    lowered = content.lower()
    sports = [sport.name for sport in Sport.query.all() if sport.name and sport.name.lower() in lowered]
    regions = []
    for region in Region.query.limit(400).all():
        names = [region.name, region.full_name]
        if any(name and name.lower() in lowered for name in names):
            regions.append(region.full_name or region.name)
    for alias, region_name in REGION_TEXT_ALIASES.items():
        if alias in (content or ""):
            regions.append(region_name)
    place_terms = extract_place_terms(content, sports, regions)
    times = [keyword for keyword in TIME_KEYWORDS if keyword in content]
    keywords = sports + regions + place_terms + times
    for keyword in ["초보", "입문", "가볍게", "친목", "다이어트", "퇴근", "한강", "실내", "야외"]:
        if keyword in content:
            keywords.append(keyword)
    return {"sports": sports, "regions": regions, "places": place_terms, "times": times, "keywords": keywords}


def get_or_create_memory(user_id):
    memory = ChatbotUserMemory.query.filter_by(user_id=user_id).first()
    if not memory:
        memory = ChatbotUserMemory(user_id=user_id)
        db.session.add(memory)
    return memory


def update_user_memory(user, content):
    memory = get_or_create_memory(user.id)
    profile_context = user_profile_context(user)
    extracted = extract_preferences_from_text(content)

    memory.preferred_sports = merge_csv(memory.preferred_sports, profile_context["sports"], extracted["sports"])
    memory.preferred_regions = merge_csv(clean_memory_regions(memory.preferred_regions), profile_context["regions"], extracted["regions"])
    memory.preferred_times = merge_csv(memory.preferred_times, extracted["times"])
    memory.interest_keywords = merge_csv(memory.interest_keywords, extracted["keywords"], limit=20)

    summary_bits = []
    if memory.preferred_sports:
        summary_bits.append(f"관심 종목은 {memory.preferred_sports}")
    if memory.preferred_regions:
        summary_bits.append(f"선호 지역은 {memory.preferred_regions}")
    if memory.preferred_times:
        summary_bits.append(f"선호 시간대는 {memory.preferred_times}")
    memory.summary = "; ".join(summary_bits) or "아직 충분한 선호 정보가 없습니다."
    memory.last_extracted_at = kst_now()
    return memory


def meeting_datetime_label(meeting):
    if not meeting.start_at:
        return "일정 미정"
    return meeting.start_at.strftime("%m월 %d일 %H:%M")


def meeting_line(meeting):
    sport_name = meeting.sport.name if meeting.sport else "운동"
    return f"- {meeting.title} ({sport_name}, {meeting.location_name}, {meeting_datetime_label(meeting)}, {meeting.current_participants}/{meeting.max_participants}명)"


def upcoming_user_meetings(user_id, limit=5):
    now = kst_now()
    hosted = (
        Meeting.query.options(joinedload(Meeting.sport))
        .filter(Meeting.host_id == user_id)
        .filter(or_(Meeting.start_at.is_(None), Meeting.start_at >= now))
        .filter(~Meeting.status.in_(["cancelled", "closed", "suspended"]))
        .all()
    )
    joined = (
        Meeting.query.options(joinedload(Meeting.sport))
        .join(Participant, Participant.meeting_id == Meeting.id)
        .filter(Participant.user_id == user_id, Participant.status == "approved")
        .filter(or_(Meeting.start_at.is_(None), Meeting.start_at >= now))
        .filter(~Meeting.status.in_(["cancelled", "closed", "suspended"]))
        .all()
    )
    unique = {meeting.id: meeting for meeting in hosted + joined}
    return sorted(unique.values(), key=lambda item: item.start_at or datetime.max)[:limit]


def meeting_search_haystack(meeting):
    return " ".join([
        meeting.title or "",
        meeting.description or "",
        meeting.location_name or "",
        meeting.address or "",
        meeting.sport.name if meeting.sport else "",
    ]).lower()


def recommend_meetings(user, content, memory, payload=None, limit=5, nlu=None):
    now = kst_now()
    nlu = nlu or fallback_chatbot_nlu(content)
    extracted = extract_preferences_from_text(content)
    if nlu.get("sport") and nlu["sport"] not in extracted["sports"]:
        matched_sport = Sport.query.filter(Sport.name.ilike(nlu["sport"])).first()
        if matched_sport:
            extracted["sports"].append(matched_sport.name)
    if nlu.get("location_query") and nlu["location_query"] not in extracted["places"] and nlu.get("location_kind") == "explicit":
        extracted["places"].insert(0, nlu["location_query"])
    explicit_sports = extracted["sports"]
    explicit_regions = compact_unique(extracted["regions"] + extracted.get("places", []))
    use_personalized = bool(nlu.get("use_profile")) or should_use_personalized_preferences(content)
    own_nearby_context = my_nearby_context(user, content, payload)
    if own_nearby_context and own_nearby_context.get("needs_location"):
        return []
    nearby_context = own_nearby_context or resolve_nearby_context(extracted.get("places", []) or extracted["regions"])
    sports = explicit_sports or (csv_items(memory.preferred_sports) if use_personalized else [])
    regions = explicit_regions if (explicit_regions or nearby_context) else csv_items(memory.preferred_regions)
    if not use_personalized and not nearby_context and not explicit_regions:
        regions = []
    strict_terms = []
    if not nearby_context:
        for region in explicit_regions:
            strict_terms.extend(location_term_variants(region))
    strict_sports = explicit_sports

    query = (
        Meeting.query.options(joinedload(Meeting.sport), joinedload(Meeting.host), joinedload(Meeting.chat_room))
        .filter(Meeting.status == "open")
        .filter(or_(Meeting.start_at.is_(None), Meeting.start_at >= now))
    )
    candidates = query.order_by(Meeting.start_at.asc().nullslast(), Meeting.created_at.desc()).limit(80).all()

    lowered = content.lower()
    scored = []
    for meeting in candidates:
        haystack = meeting_search_haystack(meeting)
        nearby_distance = None
        if nearby_context:
            nearby_distance = distance_km(
                nearby_context["latitude"],
                nearby_context["longitude"],
                meeting.latitude,
                meeting.longitude,
            )
            if nearby_distance is None or nearby_distance > nearby_context["radius_km"]:
                continue
            meeting._distance_km = nearby_distance
        if strict_terms and not any(term.lower() in haystack for term in strict_terms):
            continue
        if strict_sports and not any(sport.lower() in haystack for sport in strict_sports):
            continue

        score = 0
        if nearby_distance is not None:
            score += max(0, 12 - nearby_distance)
        for sport in sports:
            if sport.lower() in haystack:
                score += 4
        for region in regions:
            if any(term.lower() in haystack for term in location_term_variants(region)):
                score += 5 if region in explicit_regions else 3
        for token in re.findall(r"[가-힣A-Za-z0-9]{2,20}", lowered):
            if token not in SEARCH_STOPWORDS and token in haystack:
                score += 1
        if meeting.host_id == user.id:
            score -= 3
        scored.append((score, meeting))

    scored.sort(key=lambda pair: (-pair[0], getattr(pair[1], "_distance_km", 999999), pair[1].start_at or datetime.max))
    return [meeting for _, meeting in scored[:limit]]


def build_schedule_reply(user):
    meetings = upcoming_user_meetings(user.id)
    if not meetings:
        return "아직 잡혀 있는 모임 일정은 없어요. 원하시면 관심 있는 종목이나 동네 기준으로 바로 찾아봐드릴게요."
    lines = ["확인해보니 다가오는 일정은 이렇게 있어요."]
    lines.extend(meeting_line(meeting) for meeting in meetings)
    return "\n".join(lines)


def build_recommendation_reply(user, content, memory, payload=None, nlu=None):
    nlu = nlu or fallback_chatbot_nlu(content)
    nearby_context = my_nearby_context(user, content, payload)
    if nearby_context and nearby_context.get("needs_location"):
        return "내 주변 모임을 보려면 현재 위치가 필요해요. 위치 권한을 허용해주시면 지금 있는 곳 기준으로 가까운 모임을 찾아드릴게요."
    meetings = recommend_meetings(user, content, memory, payload=payload, nlu=nlu)
    profile_context = user_profile_context(user)
    if nearby_context:
        source_label = "현재 위치" if nearby_context.get("source") == "browser" else f"{nearby_context.get('term') or '활동지역'}"
        context_label = f"{source_label} 반경 {nearby_context.get('radius_km', NEARBY_RADIUS_KM)}km"
    elif nlu.get("location_query"):
        context_label = nlu["location_query"]
    else:
        context_label = memory.summary if should_use_personalized_preferences(content) and memory and memory.summary else ""
    if not meetings:
        base = "지금 조건으로는 바로 추천할 만한 열린 모임을 찾지 못했어요."
        if context_label:
            return f"{base}\n지역을 조금 넓히거나 종목을 하나 더 알려주시면 다시 찾아볼게요."
        return f"{base}\n원하는 종목, 지역, 시간대 중 하나만 더 알려주셔도 더 정확히 찾아볼게요."
    if nearby_context:
        lines = [f"좋아요. {context_label} 안에서 갈 만한 모임을 찾아봤어요."]
    else:
        lines = ["좋아요. 지금 조건에 맞는 모임을 몇 개 골라봤어요."]
    lines.extend(meeting_line(meeting) for meeting in meetings)
    return "\n".join(lines)


def build_general_reply(user, content, memory, payload=None, nlu=None):
    nlu = nlu or fallback_chatbot_nlu(content)
    if nlu.get("intent") == "schedule":
        return build_schedule_reply(user)
    if nlu.get("intent") == "recommend":
        return build_recommendation_reply(user, content, memory, payload=payload, nlu=nlu)
    profile_context = user_profile_context(user)
    hints = []
    if profile_context["sports"]:
        hints.append(f"선호 종목 {', '.join(profile_context['sports'])}")
    if profile_context["regions"]:
        hints.append(f"선호 지역 {', '.join(profile_context['regions'])}")
    hint_text = f" 현재 {', '.join(hints)} 정보를 참고할 수 있어요." if hints else ""
    return f"저는 SportsMate AI 비서예요.{hint_text}\n'내 일정 알려줘', '한강 러닝 모임 찾아줘', '나한테 맞는 모임 추천해줘'처럼 물어보면 DB를 보고 도와드릴게요."


def meeting_context(meeting):
    return {
        "id": meeting.id,
        "title": meeting.title,
        "sport": meeting.sport.name if meeting.sport else "",
        "location_name": meeting.location_name,
        "address": meeting.address,
        "latitude": meeting.latitude,
        "longitude": meeting.longitude,
        "distance_km": getattr(meeting, "_distance_km", None),
        "start_at": meeting.start_at.isoformat() if meeting.start_at else None,
        "current_participants": meeting.current_participants,
        "max_participants": meeting.max_participants,
        "status": meeting.status,
        "chat_room_id": meeting.chat_room.id if meeting.chat_room else None,
    }


def build_meeting_search_href(content, memory, user=None, payload=None, recommended_meetings=None, nlu=None):
    nlu = nlu or fallback_chatbot_nlu(content)
    extracted = extract_preferences_from_text(content)
    if nlu.get("location_query") and nlu.get("location_kind") == "explicit":
        extracted["places"].insert(0, nlu["location_query"])
    use_personalized = bool(nlu.get("use_profile")) or should_use_personalized_preferences(content)
    sports = extracted["sports"] or (csv_items(memory.preferred_sports) if use_personalized else [])
    explicit_regions = compact_unique(extracted["regions"] + extracted.get("places", []))
    regions = explicit_regions or (csv_items(memory.preferred_regions) if use_personalized else [])
    own_nearby_context = my_nearby_context(user, content, payload) if user else None
    nearby_context = None if (own_nearby_context and own_nearby_context.get("needs_location")) else own_nearby_context
    nearby_context = nearby_context or resolve_nearby_context(extracted.get("places", []) or extracted["regions"])
    if not nearby_context and contains_any(content, LOCATION_HINTS):
        first_recommended = (recommended_meetings or [None])[0]
        latitude = coerce_float((first_recommended or {}).get("latitude"))
        longitude = coerce_float((first_recommended or {}).get("longitude"))
        if latitude is not None and longitude is not None:
            nearby_context = {
                "term": (extracted.get("places") or extracted["regions"] or [(first_recommended or {}).get("location_name") or "선택 위치"])[0],
                "latitude": latitude,
                "longitude": longitude,
                "source": "recommended-meeting",
                "radius_km": NEARBY_RADIUS_KM,
            }
    params = {}

    if sports:
        sport = Sport.query.filter(Sport.name.in_(sports)).first()
        if sport:
            params["sport"] = str(sport.id)
        else:
            params["keyword"] = sports[0]
    if nearby_context:
        params["lat"] = str(nearby_context["latitude"])
        params["lng"] = str(nearby_context["longitude"])
        params["radius_km"] = str(nearby_context["radius_km"])
        params["near"] = nearby_context["term"]
    elif regions:
        params["keyword"] = regions[0]
    if not params:
        cleaned_terms = [normalize_query_token(token) for token in re.findall(r"[가-힣A-Za-z0-9]{2,20}", content or "") if normalize_query_token(token) not in SEARCH_STOPWORDS]
        if cleaned_terms:
            params["keyword"] = cleaned_terms[0]

    return "/meetings" + (f"?{urlencode(params)}" if params else "")


def build_chatbot_actions(user, content, memory, context, payload=None, nlu=None):
    nlu = nlu or context.get("nlu") or fallback_chatbot_nlu(content)
    actions = []
    schedule_intent = nlu.get("intent") == "schedule"
    recommend_intent = nlu.get("intent") == "recommend"
    if schedule_intent:
        upcoming = upcoming_user_meetings(user.id, limit=1)
        href = "/mypage?calendar=1&from=chatbot"
        if upcoming:
            href += f"&meeting={upcoming[0].id}"
        actions.append({
            "type": "schedule",
            "label": "일정 확인하러 가기",
            "description": "가장 가까운 일정을 내 달력에서 열어요.",
            "href": href,
        })
    if recommend_intent:
        recommended = context.get("recommended_meetings") or []
        actions.append({
            "type": "meeting_search",
            "label": "추천한 모임 찾아보기",
            "description": "종목이나 지역 조건을 모임게시판에 적용해요.",
            "href": build_meeting_search_href(content, memory, user=user, payload=payload, recommended_meetings=recommended, nlu=nlu),
        })
        if recommended:
            actions.append({
                "type": "meeting_detail",
                "label": "첫 추천 모임 보기",
                "description": recommended[0].get("title") or "",
                "href": f"/meetings/{recommended[0].get('id')}",
            })
    return actions


def build_chatbot_context(user, content, memory, fallback_reply, payload=None, nlu=None):
    nlu = nlu or fallback_chatbot_nlu(content)
    profile_context = user_profile_context(user)
    upcoming = upcoming_user_meetings(user.id)
    recommended = recommend_meetings(user, content, memory, payload=payload, nlu=nlu)
    recent_messages = (
        ChatbotMessage.query.join(ChatbotSession, ChatbotSession.id == ChatbotMessage.session_id)
        .filter(ChatbotSession.user_id == user.id)
        .order_by(ChatbotMessage.created_at.desc())
        .limit(8)
        .all()
    )
    return {
        "user": {
            "id": user.id,
            "nickname": user.nickname,
            "profile": profile_context,
        },
        "memory": memory.to_dict() if memory else None,
        "intent": {
            "schedule": nlu.get("intent") == "schedule",
            "recommend": nlu.get("intent") == "recommend",
        },
        "nlu": nlu,
        "upcoming_meetings": [meeting_context(meeting) for meeting in upcoming],
        "recommended_meetings": [meeting_context(meeting) for meeting in recommended],
        "recent_chatbot_messages": [message.to_dict() for message in reversed(recent_messages)],
        "fallback_reply": fallback_reply,
    }


def serialize_chatbot_messages(user, messages):
    memory = ChatbotUserMemory.query.filter_by(user_id=user.id).first() or ChatbotUserMemory(user_id=user.id)
    items = []
    last_user_content = ""
    for message in messages:
        item = message.to_dict()
        if message.role == "user":
            last_user_content = message.content
        elif message.role == "assistant" and last_user_content:
            context = build_chatbot_context(user, last_user_content, memory, item.get("content") or "")
            item["actions"] = build_chatbot_actions(user, last_user_content, memory, context)
        items.append(item)
    return items


@chatbot_bp.get("/sessions")
@jwt_required()
def get_sessions():
    user_id = int(get_jwt_identity())
    sessions = (
        ChatbotSession.query.filter_by(user_id=user_id)
        .order_by(ChatbotSession.updated_at.desc())
        .all()
    )
    return jsonify({"items": [session.to_dict() for session in sessions]})


@chatbot_bp.post("/sessions")
@jwt_required()
def create_session():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    title = clean_title(data.get("title"))
    session = ChatbotSession(user_id=user_id, title=title)
    db.session.add(session)
    db.session.commit()
    return jsonify(session.to_dict()), 201


@chatbot_bp.get("/sessions/<int:session_id>/messages")
@jwt_required()
def get_messages(session_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    try:
        session = ensure_session_access(session_id, user_id)
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403
    limit = max(1, min(request.args.get("limit", default=40, type=int) or 40, 80))
    before_id = request.args.get("before_id", type=int)
    query = ChatbotMessage.query.filter_by(session_id=session.id)
    if before_id:
        query = query.filter(ChatbotMessage.id < before_id)
    newest_first = query.order_by(ChatbotMessage.id.desc()).limit(limit + 1).all()
    has_more = len(newest_first) > limit
    messages = list(reversed(newest_first[:limit]))
    return jsonify({
        "items": serialize_chatbot_messages(user, messages),
        "has_more": has_more,
        "next_before_id": messages[0].id if has_more and messages else None,
    })


@chatbot_bp.post("/sessions/<int:session_id>/message")
@jwt_required()
def send_message(session_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    try:
        session = ensure_session_access(session_id, user_id)
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403

    data = request.get_json() or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"message": "메시지를 입력해주세요."}), 400

    user_msg = ChatbotMessage(session_id=session.id, role="user", content=content)
    db.session.add(user_msg)

    if not session.messages or session.title == "새로운 대화":
        session.title = clean_title(content)

    memory = update_user_memory(user, content)
    nlu = interpret_chatbot_query(content, user=user, memory=memory, use_ai=True)
    fallback_reply = build_general_reply(user, content, memory, payload=data, nlu=nlu)
    chatbot_context = build_chatbot_context(user, content, memory, fallback_reply, payload=data, nlu=nlu)
    actions = build_chatbot_actions(user, content, memory, chatbot_context, payload=data, nlu=nlu)
    bot_reply_content = generate_openai_chatbot_reply(content, fallback_reply, chatbot_context) or fallback_reply
    bot_msg = ChatbotMessage(session_id=session.id, role="assistant", content=bot_reply_content)
    db.session.add(bot_msg)

    # 3. 만약 세션의 제목이 기본값 "새로운 대화"라면, 첫 번째 질문 내용으로 제목 자동 업데이트
    if session.title == "새로운 대화":
        summary = content[:15] + "..." if len(content) > 15 else content
        session.title = summary

    # 4. 세션 수정 시각 업데이트 (최근 대화 순으로 상단 노출하기 위함)
    session.updated_at = db.func.now()

    db.session.commit()

    bot_message = bot_msg.to_dict()
    bot_message["actions"] = actions
    return jsonify({
        "user_message": user_msg.to_dict(),
        "bot_message": bot_message,
        "memory": memory.to_dict(),
        "actions": actions,
    }), 201


@chatbot_bp.route("/sessions/<int:session_id>", methods=["PUT"])
@jwt_required()
def update_session(session_id):
    user_id = int(get_jwt_identity())
    try:
        session = ensure_session_access(session_id, user_id)
    except PermissionError as e:
        return jsonify({"message": str(e)}), 403

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"message": "수정할 제목을 입력해주세요."}), 400

    session.title = title
    session.updated_at = db.func.now()
    db.session.commit()
    return jsonify(session.to_dict())


@chatbot_bp.delete("/sessions/<int:session_id>")
@jwt_required()
def delete_session(session_id):
    user_id = int(get_jwt_identity())
    try:
        session = ensure_session_access(session_id, user_id)
    except PermissionError as error:
        return jsonify({"message": str(error)}), 403
    db.session.delete(session)
    db.session.commit()
    return jsonify({"message": "대화방을 삭제했습니다."})


@chatbot_bp.get("/memory")
@jwt_required()
def get_memory():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    memory = update_user_memory(user, "")
    db.session.commit()
    return jsonify({"memory": memory.to_dict()})
