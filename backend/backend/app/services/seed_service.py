from datetime import datetime, timedelta

from app.extensions import db
from app.models import ChatMessage, ChatRoom, Meeting, Notice, Notification, Participant, Region, Sport, SportCategory, User, UserProfile, Vote, VoteOption


def seed_database():
    categories = [
        ("구기 종목", "팀 모집 / 친선전", ["축구", "풋살", "농구", "배구", "야구", "족구"]),
        ("라켓 스포츠", "파트너 모집 / 친선전", ["배드민턴", "탁구", "테니스", "스쿼시"]),
        ("러닝 / 야외", "동행 모집 / 팀 모집", ["러닝", "등산", "트래킹", "자전거", "산책"]),
        ("피트니스", "파트너 모집 / 운동 메이트 모집", ["헬스", "크로스핏", "클라이밍", "요가", "필라테스"]),
        ("기타", "파트너 모집", ["볼링", "당구", "골프", "수영"])
    ]

    region_specs = [
        ("11", "서울특별시", "sido", None, "서울특별시", 37.5665, 126.9780),
        ("26", "부산광역시", "sido", None, "부산광역시", 35.1796, 129.0756),
        ("27", "대구광역시", "sido", None, "대구광역시", 35.8714, 128.6014),
        ("28", "인천광역시", "sido", None, "인천광역시", 37.4563, 126.7052),
        ("29", "광주광역시", "sido", None, "광주광역시", 35.1595, 126.8526),
        ("30", "대전광역시", "sido", None, "대전광역시", 36.3504, 127.3845),
        ("31", "울산광역시", "sido", None, "울산광역시", 35.5384, 129.3114),
        ("36", "세종특별자치시", "sido", None, "세종특별자치시", 36.4800, 127.2890),
        ("41", "경기도", "sido", None, "경기도", 37.4138, 127.5183),
        ("43", "충청북도", "sido", None, "충청북도", 36.6357, 127.4913),
        ("44", "충청남도", "sido", None, "충청남도", 36.5184, 126.8000),
        ("45", "전북특별자치도", "sido", None, "전북특별자치도", 35.7175, 127.1530),
        ("46", "전라남도", "sido", None, "전라남도", 34.8161, 126.4629),
        ("47", "경상북도", "sido", None, "경상북도", 36.4919, 128.8889),
        ("48", "경상남도", "sido", None, "경상남도", 35.4606, 128.2132),
        ("50", "제주특별자치도", "sido", None, "제주특별자치도", 33.4890, 126.4983),
        ("11110", "종로구", "sigungu", "11", "서울특별시 종로구", 37.5735, 126.9788),
        ("11680", "강남구", "sigungu", "11", "서울특별시 강남구", 37.5172, 127.0473),
        ("11710", "송파구", "sigungu", "11", "서울특별시 송파구", 37.5145, 127.1059),
        ("11560", "영등포구", "sigungu", "11", "서울특별시 영등포구", 37.5264, 126.8963),
        ("41135", "분당구", "sigungu", "41", "경기도 성남시 분당구", 37.3826, 127.1189),
        ("41111", "장안구", "sigungu", "41", "경기도 수원시 장안구", 37.3040, 127.0107),
        ("43113", "흥덕구", "sigungu", "43", "충청북도 청주시 흥덕구", 36.6422, 127.4313),
        ("44133", "서북구", "sigungu", "44", "충청남도 천안시 서북구", 36.8789, 127.1545),
        ("50110", "제주시", "sigungu", "50", "제주특별자치도 제주시", 33.4996, 126.5312)
    ]

    for code, name, level, parent_code, full_name, latitude, longitude in region_specs:
        db.session.add(Region(code=code, name=name, level=level, parent_code=parent_code, full_name=full_name, latitude=latitude, longitude=longitude))

    sports = []
    for category_name, purpose, sport_names in categories:
        category = SportCategory(name=category_name, purpose=purpose)
        db.session.add(category)
        db.session.flush()
        for sport_name in sport_names:
            sport = Sport(name=sport_name, category_id=category.id)
            db.session.add(sport)
            sports.append(sport)

    demo = User(email="demo@sportsmate.kr", nickname="스포츠메이트")
    demo.set_password("password123")
    demo.profile = UserProfile(region="서울 강남구", exercise_level="intermediate", preferred_sports="러닝, 배드민턴")
    db.session.add(demo)
    db.session.flush()

    applicant = User(email="mate@sportsmate.kr", nickname="운동메이트")
    applicant.set_password("password123")
    applicant.profile = UserProfile(region="서울 송파구", exercise_level="beginner", preferred_sports="러닝, 배드민턴")
    db.session.add(applicant)
    db.session.flush()

    meeting_specs = [
        ("퇴근 후 한강 러닝 5km", "가볍게 몸 풀고 함께 뛰는 러닝 모임입니다.", "여의도 한강공원", "서울 영등포구 여의동로 330", 11, 8, "11", "11560", 37.5284, 126.9348),
        ("주말 오전 배드민턴", "초보도 환영하는 실내 배드민턴 모임입니다.", "송파 체육문화회관", "서울 송파구 올림픽로 25", 7, 10, "11", "11710", 37.5145, 127.1059),
        ("강남 직장인 헬스 루틴", "운동 루틴을 공유하고 서로 동기부여하는 모임입니다.", "강남 피트니스센터", "서울 강남구 테헤란로 123", 16, 6, "11", "11680", 37.5012, 127.0396)
    ]

    for index, (title, description, location, address, sport_index, max_count, sido_code, sigungu_code, latitude, longitude) in enumerate(meeting_specs, start=1):
        meeting = Meeting(
            host_id=demo.id,
            sport_id=sport_index,
            title=title,
            description=description,
            meeting_type="regular" if index == 3 else "one_time",
            purpose="함께 운동할 메이트 모집",
            region_sido_code=sido_code,
            region_sigungu_code=sigungu_code,
            location_name=location,
            address=address,
            latitude=latitude,
            longitude=longitude,
            start_at=datetime.utcnow() + timedelta(days=index, hours=10),
            end_at=datetime.utcnow() + timedelta(days=index, hours=12),
            max_participants=max_count,
            current_participants=1,
            status="open",
            approval_required=True
        )
        db.session.add(meeting)
        db.session.flush()
        db.session.add(Participant(meeting_id=meeting.id, user_id=demo.id, role="host", status="approved", approved_at=datetime.utcnow()))
        room = ChatRoom(meeting_id=meeting.id)
        db.session.add(room)
        db.session.flush()
        db.session.add(ChatMessage(chat_room_id=room.id, user_id=demo.id, content="모임에 오신 것을 환영합니다."))
        if index == 1:
            db.session.add(Participant(meeting_id=meeting.id, user_id=applicant.id, role="member", status="pending", join_message="퇴근 후 러닝에 함께 참여하고 싶습니다."))
            db.session.add(Notice(meeting_id=meeting.id, title="준비물 안내", content="가벼운 러닝화와 개인 물을 준비해 주세요.", is_pinned=True))
            vote = Vote(meeting_id=meeting.id, title="러닝 후 간식 장소를 골라주세요.")
            db.session.add(vote)
            db.session.flush()
            db.session.add(VoteOption(vote_id=vote.id, text="카페"))
            db.session.add(VoteOption(vote_id=vote.id, text="샐러드 가게"))

    db.session.add(Notification(user_id=demo.id, type="system", title="SportsMate 시작", message="내 주변 운동 모임을 찾아보세요.", link_url="/meetings"))
    db.session.add(Notification(user_id=demo.id, type="join_request", title="새 참여 신청", message="퇴근 후 한강 러닝 5km에 새 참여 신청이 있습니다.", link_url="/host/meetings/1/applicants"))
    db.session.commit()
