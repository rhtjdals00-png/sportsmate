import {
  BadgeHelp,
  Bike,
  BicepsFlexed,
  Club,
  Dumbbell,
  Flag,
  Footprints,
  Landmark,
  Mountain,
  PersonStanding,
  Route,
  Sailboat,
  Trophy,
  Waves
} from "lucide-react";

function SoccerBallIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 3 2-1 4h-4L9 9l3-2Z" />
      <path d="m9 9-4-.5" />
      <path d="m15 9 4-.5" />
      <path d="m10 13-2.5 3" />
      <path d="m14 13 2.5 3" />
      <path d="m12 7 .5-3" />
    </svg>
  );
}

function BasketballIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9.5c5.2.5 9.5 4.8 10 11" />
      <path d="M10.5 3.5c.5 5.2 4.8 9.5 10 10" />
      <path d="M5.6 18.4 18.4 5.6" />
      <path d="M3 12h18" />
    </svg>
  );
}

function VolleyballIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c2.7 2 4.1 4.9 3.8 8.4" />
      <path d="M20.2 8.4c-3.1-.2-6.1.9-8.4 3.2" />
      <path d="M12 21c-1.7-2.8-1.9-6-.2-9.4" />
      <path d="M3.8 15.6c3.1.2 6.1-.9 8.4-3.2" />
    </svg>
  );
}

function BaseballIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7 5.6c1.4 1.5 2.1 3.7 2.1 6.4S8.4 16.9 7 18.4" />
      <path d="M17 5.6c-1.4 1.5-2.1 3.7-2.1 6.4s.7 4.9 2.1 6.4" />
      <path d="m7.9 8.1.9.7" />
      <path d="m7.9 15.9.9-.7" />
      <path d="m16.1 8.1-.9.7" />
      <path d="m16.1 15.9-.9-.7" />
    </svg>
  );
}

function RacketIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="9" cy="8" rx="4" ry="5.5" transform="rotate(-35 9 8)" />
      <path d="m12 12 7 7" />
      <path d="m17.5 20.5 3-3" />
      <path d="M6.5 5.5 11 10" />
      <path d="M4.8 8.6 8.4 12" />
      <circle cx="18" cy="6" r="1.7" />
    </svg>
  );
}

function BowlingIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="10" cy="8" r=".8" fill="currentColor" stroke="none" />
      <circle cx="13" cy="7" r=".8" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

const sportIconRules = [
  { pattern: /축구|풋살|족구/, icon: SoccerBallIcon },
  { pattern: /농구/, icon: BasketballIcon },
  { pattern: /배구/, icon: VolleyballIcon },
  { pattern: /야구/, icon: BaseballIcon },
  { pattern: /배드민턴|탁구|테니스|스쿼시|라켓/, icon: RacketIcon },
  { pattern: /러닝|마라톤/, icon: Footprints },
  { pattern: /등산|트레킹/, icon: Mountain },
  { pattern: /자전거|라이딩/, icon: Bike },
  { pattern: /산책/, icon: PersonStanding },
  { pattern: /헬스|웨이트|피트니스/, icon: Dumbbell },
  { pattern: /크로스핏/, icon: BicepsFlexed },
  { pattern: /클라이밍/, icon: Mountain },
  { pattern: /요가|필라테스/, icon: PersonStanding },
  { pattern: /수영/, icon: Waves },
  { pattern: /서핑/, icon: Sailboat },
  { pattern: /볼링/, icon: BowlingIcon },
  { pattern: /당구/, icon: Club },
  { pattern: /골프/, icon: Flag },
  { pattern: /구기/, icon: Trophy },
  { pattern: /러닝|야외/, icon: Route },
  { pattern: /기타/, icon: BadgeHelp }
];

export function getSportIcon(sportName) {
  return sportIconRules.find((rule) => rule.pattern.test(sportName || ""))?.icon || Landmark;
}
