import React from "react";
import {
  BadgeHelp,
  Landmark
} from "lucide-react";

// 1. 축구 (soccer.svg)
function SoccerBallIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45" />
      <path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45" />
    </svg>
  );
}

// 2. 풋살 (futsal.svg)
function FutsalIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 5h18v15" />
      <path d="M3 5v15" />
      <path d="M3 20l3.5-5h11L21 20" />
      <path d="M3 5l3.5 6h11L21 5" strokeWidth="1" />
      <path d="M6.5 11v4M10 5v10M14 5v10M17.5 11v4" strokeWidth="1" />
      <path d="M4 9h16M4 12h16M5 15h14" strokeWidth="1" />
    </svg>
  );
}

// 3. 농구 (basketball.svg)
function BasketballIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M5.65 5.65l12.7 12.7" />
      <path d="M5.65 18.35l12.7 -12.7" />
      <path d="M12 3a9 9 0 0 0 9 9" />
      <path d="M3 12a9 9 0 0 1 9 9" />
    </svg>
  );
}

// 4. 배구 (volleyball.svg)
function VolleyballIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M12 12a8 8 0 0 0 8 4" />
      <path d="M7.5 13.5a12 12 0 0 0 8.5 6.5" />
      <path d="M12 12a8 8 0 0 0 -7.464 4.928" />
      <path d="M12.951 7.353a12 12 0 0 0 -9.88 4.111" />
      <path d="M12 12a8 8 0 0 0 -.536 -8.928" />
      <path d="M15.549 15.147a12 12 0 0 0 1.38 -10.611" />
    </svg>
  );
}

// 5. 야구 (baseball.svg)
function BaseballIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5.636 18.364a9 9 0 1 0 12.728 -12.728a9 9 0 0 0 -12.728 12.728" />
      <path d="M12.495 3.02a9 9 0 0 1 -9.475 9.475" />
      <path d="M20.98 11.505a9 9 0 0 0 -9.475 9.475" />
      <path d="M9 9l2 2" />
      <path d="M13 13l2 2" />
      <path d="M11 7l2 1" />
      <path d="M7 11l1 2" />
      <path d="M16 11l1 2" />
      <path d="M11 16l2 1" />
    </svg>
  );
}

// 6. 족구 (jokgu.svg)
function JokguIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4c2 3 2 6 0 8" />
      <path d="M12 12c3 0 5 2 6 5" />
      <path d="M12 12c-3 0-5 2-6 5" />
    </svg>
  );
}

// 7. 배드민턴 (badminton.svg)
function BadmintonIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="15.5" cy="7.5" rx="4.5" ry="5.5" transform="rotate(35 15.5 7.5)" />
      <path d="M12.3 10.7 7.2 15.8" />
      <path d="M5.7 15.8 3.5 18a1.5 1.5 0 0 0 2.1 2.1l2.2-2.2" />
      <path d="M13.2 5.6 18 10.4M11.6 7.8 15.8 12M15.4 4.2 19.2 8" />
      <path d="M14.3 17.2h5.2M14.3 17.2 20 14.8M14.3 17.2 20 19.6" />
    </svg>
  );
}

// 8. 탁구 (table-tennis.svg)
function TableTennisIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12.718 20.713a7.64 7.64 0 0 1 -7.48 -12.755l.72 -.72a7.643 7.643 0 0 1 9.105 -1.283l2.387 -2.345a2.08 2.08 0 0 1 3.057 2.815l-.116 .126l-2.346 2.387a7.644 7.644 0 0 1 -1.052 8.864" />
      <path d="M11 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M9.3 5.3l9.4 9.4" />
    </svg>
  );
}

// 9. 테니스 (tennis.svg)
function TennisIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M6 5.3a9 9 0 0 1 0 13.4" />
      <path d="M18 5.3a9 9 0 0 0 0 13.4" />
    </svg>
  );
}

// 10. 스쿼시 (squash.svg)
function SquashIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="9" cy="8" rx="4" ry="5.5" transform="rotate(-35 9 8)" />
      <path d="m12 12 7 7" />
      <path d="m17.5 20.5 3-3" />
      <circle cx="18" cy="6" r="1.8" />
    </svg>
  );
}

// 11. 러닝 (running.svg)
function RunningIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M4 17l5 1l.75 -1.5" />
      <path d="M15 21v-4l-4 -3l1 -6" />
      <path d="M7 12v-3l5 -1l3 3l3 1" />
    </svg>
  );
}

// 12. 등산 (hiking.svg)
function HikingIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}

// 13. 트레킹 (trekking.svg)
function TrekkingIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M7 21l2 -4" />
      <path d="M13 21v-4l-3 -3l1 -6l3 4l3 2" />
      <path d="M10 14l-1.827 -1.218a2 2 0 0 1 -.831 -2.15l.28 -1.117a2 2 0 0 1 1.939 -1.515h1.439l4 1l3 -2" />
      <path d="M17 12v9" />
      <path d="M16 20h2" />
    </svg>
  );
}

// 14. 자전거 (cycling.svg)
function CyclingIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M12 19v-4l-3 -3l5 -4l2 3h3" />
      <path d="M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    </svg>
  );
}

// 15. 산책 (walking.svg)
function WalkingIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
      <path d="M16 17h4" />
      <path d="M4 13h4" />
    </svg>
  );
}

// 16. 헬스 (fitness.svg)
function FitnessIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.4 14.4 9.6 9.6" />
      <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
      <path d="m21.5 21.5-1.4-1.4" />
      <path d="M3.9 3.9 2.5 2.5" />
      <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
    </svg>
  );
}

// 17. 크로스핏 (crossfit.svg)
function CrossfitIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
      <path d="M8 10h8" />
      <path d="M7 11c-1 2-1.5 5 .2 7.2C8.3 19.7 10 21 12 21s3.7-1.3 4.8-2.8c1.7-2.2 1.2-5.2.2-7.2" />
      <path d="M10 14h4" />
    </svg>
  );
}

// 18. 클라이밍 (climbing.svg)
function ClimbingIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10.8" cy="5.4" r="1.7" />
      <path d="M10.5 9v5" />
      <path d="M10.5 9.5 7.2 8.2 6 5.4" />
      <path d="M10.5 9l4 2 2-2.5" />
      <path d="M10.5 14 7 13.2 5.2 16.5" />
      <path d="M10.5 14l3.5 2.5 2.2 4" />
      <ellipse cx="19" cy="7" rx="1.2" ry=".8" strokeWidth="1" />
    </svg>
  );
}

// 19. 요가 (yoga.svg)
function YogaIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20h4l1.5 -3" />
      <path d="M17 20l-1 -5h-5l1 -7" />
      <path d="M4 10l4 -1l4 -1l4 1.5l4 1.5" />
      <path d="M10.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    </svg>
  );
}

// 20. 필라테스 (pilates.svg)
function PilatesIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 13h16" />
      <path d="M4 16h16" />
      <path d="M5 16v4h2v-4" />
      <path d="M17 16v4h2v-4" />
      <path d="M7 12 5 10" />
      <path d="M5 10h4" />
      <path d="M12 13l6-3" />
      <path d="M19 8v5" />
      <path d="M18 8h3" />
    </svg>
  );
}

// 21. 볼링 (bowling.svg)
function BowlingIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 11v.01" />
      <path d="M11 10v.01" />
      <path d="M10 14v.01" />
      <path d="M11.059 6.07a8 8 0 1 0 .32 15.81" />
      <path d="M15.969 9h4" />
      <path d="M14.969 5c0 1.5 1 2 1 4c0 2.5 -2 4.5 -2 7c0 2.6 1.9 6 1.9 6h4.1s2 -3.4 2 -6c0 -2.5 -2 -4.5 -2 -7c0 -2 1 -2.5 1 -4a3 3 0 1 0 -6 0" />
    </svg>
  );
}

// 22. 당구 (billiards.svg)
function BilliardsIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5 5 19" />
      <circle cx="12" cy="5.5" r="1.8" />
      <circle cx="18.5" cy="12" r="1.8" />
      <circle cx="12" cy="18.5" r="1.8" />
      <circle cx="5.5" cy="12" r="1.8" />
    </svg>
  );
}

// 23. 골프 (golf.svg)
function GolfIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 18v-15l7 4l-7 4" />
      <path d="M9 17.67c-.62 .36 -1 .82 -1 1.33c0 1.1 1.8 2 4 2s4 -.9 4 -2c0 -.5 -.38 -.97 -1 -1.33" />
    </svg>
  );
}

// 24. 수영 (swimming.svg)
function SwimmingIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M6 11l4 -2l3.5 3l-1.5 2" />
      <path d="M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1 -.25" />
    </svg>
  );
}

const sportIconRules = [
  { pattern: /축구/, icon: SoccerBallIcon },
  { pattern: /풋살/, icon: FutsalIcon },
  { pattern: /농구/, icon: BasketballIcon },
  { pattern: /배구/, icon: VolleyballIcon },
  { pattern: /야구/, icon: BaseballIcon },
  { pattern: /족구/, icon: JokguIcon },
  { pattern: /배드민턴/, icon: BadmintonIcon },
  { pattern: /탁구/, icon: TableTennisIcon },
  { pattern: /테니스/, icon: TennisIcon },
  { pattern: /스쿼시/, icon: SquashIcon },
  { pattern: /러닝|마라톤/, icon: RunningIcon },
  { pattern: /등산/, icon: HikingIcon },
  { pattern: /트레킹|트래킹/, icon: TrekkingIcon },
  { pattern: /자전거|라이딩/, icon: CyclingIcon },
  { pattern: /산책|워킹|걷기/, icon: WalkingIcon },
  { pattern: /헬스|웨이트|피트니스/, icon: FitnessIcon },
  { pattern: /크로스핏/, icon: CrossfitIcon },
  { pattern: /클라이밍/, icon: ClimbingIcon },
  { pattern: /요가/, icon: YogaIcon },
  { pattern: /필라테스/, icon: PilatesIcon },
  { pattern: /볼링/, icon: BowlingIcon },
  { pattern: /당구/, icon: BilliardsIcon },
  { pattern: /골프/, icon: GolfIcon },
  { pattern: /수영/, icon: SwimmingIcon },
  { pattern: /기타/, icon: BadgeHelp }
];

export function getSportIcon(sportName) {
  return sportIconRules.find((rule) => rule.pattern.test(sportName || ""))?.icon || Landmark;
}

const SPORT_EMOJI_RULES = [
  { pattern: /축구|풋살|족구/, emoji: "⚽" },
  { pattern: /농구/, emoji: "🏀" },
  { pattern: /배구/, emoji: "🏐" },
  { pattern: /야구/, emoji: "⚾" },
  { pattern: /배드민턴/, emoji: "🏸" },
  { pattern: /탁구/, emoji: "🏓" },
  { pattern: /테니스|스쿼시/, emoji: "🎾" },
  { pattern: /러닝|마라톤|달리기/, emoji: "🏃" },
  { pattern: /등산|산악/, emoji: "🏔️" },
  { pattern: /트레킹|트래킹|하이킹/, emoji: "🥾" },
  { pattern: /자전거|라이딩|사이클/, emoji: "🚴" },
  { pattern: /산책|워킹|걷기/, emoji: "🚶" },
  { pattern: /헬스|웨이트|피트니스|크로스핏/, emoji: "🏋️" },
  { pattern: /클라이밍|암벽/, emoji: "🧗" },
  { pattern: /요가|필라테스/, emoji: "🧘" },
  { pattern: /볼링/, emoji: "🎳" },
  { pattern: /당구|포켓볼/, emoji: "🎱" },
  { pattern: /골프/, emoji: "⛳" },
  { pattern: /수영|스위밍/, emoji: "🏊" },
  { pattern: /스케이트|보드/, emoji: "🛹" },
  { pattern: /스키|스노우보드/, emoji: "🏂" },
];

export function getSportEmoji(sportName) {
  const name = String(sportName || "").trim();
  if (!name) return "👟";
  return SPORT_EMOJI_RULES.find((rule) => rule.pattern.test(name))?.emoji || "👟";
}
