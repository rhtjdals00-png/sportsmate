// 2026-07-09: Meeting thumbnail fallback by sport until a custom cover image is uploaded.
const SPORT_THUMBNAIL_DIR = "/images/sports/thumbnails";

const SPORT_THUMBNAIL_FILES = {
  "축구": "soccer",
  "풋살": "futsal",
  "농구": "basketball",
  "배구": "volleyball",
  "야구": "baseball",
  "족구": "jokgu",
  "배드민턴": "badminton",
  "탁구": "table-tennis",
  "테니스": "tennis",
  "스쿼시": "squash",
  "러닝": "running",
  "등산": "hiking",
  "트레킹": "trekking",
  "트래킹": "trekking",
  "자전거": "cycling",
  "라이딩": "cycling",
  "산책": "walking",
  "워킹": "walking",
  "걷기": "walking",
  "헬스": "fitness",
  "피트니스": "fitness",
  "크로스핏": "crossfit",
  "클라이밍": "climbing",
  "요가": "yoga",
  "필라테스": "pilates",
  "볼링": "bowling",
  "당구": "billiards",
  "골프": "golf",
  "수영": "swimming",
};

export function getSportNameFromMeeting(meeting) {
  return meeting?.sport?.name || meeting?.sport_name || meeting?.sport || "";
}

export function getSportThumbnailUrl(sportName) {
  const normalizedName = String(sportName || "").trim();
  if (!normalizedName) return "";

  const exactFileName = SPORT_THUMBNAIL_FILES[normalizedName];
  if (exactFileName) return `${SPORT_THUMBNAIL_DIR}/${exactFileName}.png`;

  const matchedEntry = Object.entries(SPORT_THUMBNAIL_FILES).find(([name]) =>
    normalizedName.includes(name)
  );

  return matchedEntry ? `${SPORT_THUMBNAIL_DIR}/${matchedEntry[1]}.png` : "";
}

export function getSportIconUrl(sportName) {
  const normalizedName = String(sportName || "").trim();
  if (!normalizedName) return "";

  const exactFileName = SPORT_THUMBNAIL_FILES[normalizedName];
  if (exactFileName) {
    return `/images/sports/icons/${exactFileName}.svg`;
  }

  const matchedEntry = Object.entries(SPORT_THUMBNAIL_FILES).find(([name]) =>
    normalizedName.includes(name)
  );

  if (matchedEntry) {
    return `/images/sports/icons/${matchedEntry[1]}.svg`;
  }

  return "";
}

export function getMeetingCustomCoverImage(meeting) {
  return meeting?.cover_image_url || meeting?.image_url || meeting?.thumbnail_url || "";
}

export function getMeetingCoverImage(meeting) {
  return getMeetingCustomCoverImage(meeting) || getSportThumbnailUrl(getSportNameFromMeeting(meeting));
}

export function isUsingSportThumbnail(meeting) {
  return !getMeetingCustomCoverImage(meeting) && Boolean(getSportThumbnailUrl(getSportNameFromMeeting(meeting)));
}
