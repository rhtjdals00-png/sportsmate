const SPORT_THUMBNAIL_DIR = "/images/sports/thumbnails";
const SPORT_ICON_DIR = "/images/sports/icons";

const SPORT_VISUAL_FILES = {
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
  "climbing": "climbing",
  "클라이밍": "climbing",
  "요가": "yoga",
  "필라테스": "pilates",
  "볼링": "bowling",
  "당구": "billiards",
  "골프": "golf",
  "수영": "swimming",
};

export const HOME_SPORT_SHORTCUT_LABELS = [
  "농구",
  "축구",
  "러닝",
  "헬스",
  "등산",
  "자전거",
];

export function getSportAssetKey(sportName) {
  const normalizedName = String(sportName || "").trim();
  if (!normalizedName) return "";

  const exactKey = SPORT_VISUAL_FILES[normalizedName];
  if (exactKey) return exactKey;

  const matchedEntry = Object.entries(SPORT_VISUAL_FILES).find(([name]) =>
    normalizedName.includes(name)
  );

  return matchedEntry?.[1] || "";
}

export function getSportVisualAsset(sportName) {
  const key = getSportAssetKey(sportName);
  return {
    key,
    thumbnail: key ? `${SPORT_THUMBNAIL_DIR}/${key}.png` : "",
    icon: key ? `${SPORT_ICON_DIR}/${key}.svg` : "",
  };
}
