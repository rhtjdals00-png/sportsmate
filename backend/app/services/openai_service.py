import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


def _extract_response_text(data):
    if data.get("output_text"):
        return data["output_text"].strip()
    parts = []
    for item in data.get("output", []) or []:
        for content in item.get("content", []) or []:
            text = content.get("text")
            if text:
                parts.append(text)
    return "\n".join(parts).strip()


def _parse_json_text(text):
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.removeprefix("json").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end >= start:
        cleaned = cleaned[start:end + 1]
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def generate_openai_chatbot_nlu(user_content, context=None):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("OPENAI_CHATBOT_NLU_MODEL") or os.getenv("OPENAI_CHATBOT_MODEL", "gpt-5.2")
    instructions = """
You normalize Korean SportsMate chatbot requests into JSON.
Return JSON only. Do not include markdown.
Schema:
{
  "intent": "schedule" | "recommend" | "weather" | "general",
  "location_query": string | "",
  "location_kind": "explicit" | "current" | "profile" | "none",
  "radius_km": number | null,
  "sport": string | "",
  "use_profile": boolean,
  "time_hint": string | "",
  "keywords": string[],
  "action_intents": string[]
}
Rules:
- "내 모임", "내 일정", "참여한 모임", "신청한 모임" mean schedule, not recommend.
- Questions about weather, temperature, rain, snow, wind, humidity, umbrellas, or forecasts mean weather.
- For weather questions, extract an explicitly named Korean place into location_query. Use location_kind current for "내 위치/현재 위치 날씨".
- "내 주변", "현 위치", "현재 위치" mean recommend with location_kind current.
- "상암 주변", "상암 주변에", "상암쪽", "상암 근처에서" all mean recommend with location_query "상암" and radius_km 6.
- If the user explicitly says a place or region, put it in location_query.
- Do not use profile/default location unless the user asks for personalized or matched recommendations.
- Fill action_intents with zero or more of:
  support, create_meeting, notifications, joined_meetings, profile, chat.
- "문의하고 싶어", "고객센터", "관리자에게 메시지" => support.
- "모임 만들고 싶어", "모임 개설", "모집글 올리기" => create_meeting.
- "알림 확인", "공지 보고 싶어" => notifications.
- "참여 중인 모임", "내 모임 보기" => joined_meetings.
- "내 정보", "프로필" => profile.
- "채팅방", "채팅 확인" => chat.
""".strip()

    input_text = "\n".join([
        f"User message: {user_content}",
        "",
        "Optional app context:",
        json.dumps(context or {}, ensure_ascii=False, default=str),
    ])

    payload = json.dumps({
        "model": model,
        "instructions": instructions,
        "input": input_text,
        "max_output_tokens": 300,
    }).encode("utf-8")

    request = Request(
        OPENAI_RESPONSES_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=12) as response:
            data = json.loads(response.read().decode("utf-8"))
        return _parse_json_text(_extract_response_text(data))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def generate_openai_chatbot_reply(user_content, fallback_reply, context):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("OPENAI_CHATBOT_MODEL", "gpt-5.2")
    instructions = """
You are SportsMate's Korean AI assistant.
Answer in warm, natural Korean like a helpful human sports meetup counselor.
Use only the provided SportsMate DB context for schedules, meetings, user profile, and memory.
For weather questions, use only the provided weather context, which comes from the Korea Meteorological Administration API. Preserve its location, forecast time, values, and limitations.
If the context is insufficient, say what information is missing and ask a short follow-up.
Do not invent meeting names, times, participants, locations, or user preferences.
Never invent weather, temperature, precipitation, humidity, wind, air-quality values, or unsupported dates. If weather.available is false, explain that the forecast is unavailable.
Keep answers concise, practical, and friendly. Prefer 2-5 short lines.
Do not expose internal evidence labels such as "참고한 정보", "DB context", "fallback", or "context".
When recommending meetings, explain briefly why they match the user.
When the recommended_meetings list is empty, never recommend unrelated meetings. Say no matching meetings were found and suggest broadening the condition.
Do not sound like a report. Sound like a real counselor continuing the conversation.
""".strip()

    input_text = "\n".join([
        "SportsMate DB context:",
        json.dumps(context, ensure_ascii=False, default=str),
        "",
        f"User question: {user_content}",
        "",
        "A deterministic fallback answer is available below. You may rewrite it naturally, but do not add unsupported facts.",
        fallback_reply,
    ])

    payload = json.dumps({
        "model": model,
        "instructions": instructions,
        "input": input_text,
        "max_output_tokens": 700,
    }).encode("utf-8")

    request = Request(
        OPENAI_RESPONSES_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=18) as response:
            data = json.loads(response.read().decode("utf-8"))
        return _extract_response_text(data) or None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
