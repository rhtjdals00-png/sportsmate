import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  DollarSign, 
  UserPlus, 
  Trophy, 
  AlertCircle, 
  MoreHorizontal, 
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Activity,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { adminApi } from "../api/adminApi";
import { useResponsive } from "../hooks/useResponsive";
import MobileAdminAnalyticsPage from "../components/admin/mobile/MobileAdminAnalyticsPage.jsx";

// Default/Fallback stats
// Default/Fallback stats
const initialStats = {
  revenue: 14250000,
  revenueTrend: "12.5%",
  revenueTrendIsUp: true,
  newUsers: 1842,
  newUsersTrend: "8.2%",
  newUsersTrendIsUp: true,
  activeMeetings: 328,
  meetingsDetails: { soccer: 145, running: 98, tennis: 85 },
  reports: { pending: 12, resolved: 45 }
};

const topMeetings = [
  { rank: 1, title: "주말 한강 러닝 크루", location: "서울 여의도 한강공원", rate: "98%", capacity: "50/50명" },
  { rank: 2, title: "강남 풋살 매치 (실력무관)", location: "강남구 스포타임", rate: "95%", capacity: "12/12명" },
  { rank: 3, title: "초보자 테니스 랠리 모임", location: "송파구 올림픽공원", rate: "92%", capacity: "4/4명" },
  { rank: 4, title: "퇴근길 가벼운 산책", location: "마포구 경의선숲길", rate: "88%", capacity: "10/10명" }
];

const systemLogs = [
  { id: 1, category: "보안 경고", type: "security", time: "10분 전", desc: "비정상적인 로그인 시도가 감지되었습니다. (IP: 192.168.1.45)" },
  { id: 2, category: "관리자 액션", type: "action", time: "1시간 전", desc: "관리자 'Admin_01'이 신고된 모임 #4592를 차단 처리했습니다." },
  { id: 3, category: "시스템 업데이트", type: "update", time: "3시간 전", desc: "정기 데이터베이스 백업이 성공적으로 완료되었습니다." },
  { id: 4, category: "결제 오류", type: "error", time: "5시간 전", desc: "PG사 연결 지연으로 3건의 결제가 실패했습니다. 자동 재시도 예정." }
];

function AdminAnalyticsPage() {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();

  if (isMobile) {
    return <MobileAdminAnalyticsPage />;
  }

  const [activeTab, setActiveTab] = useState("30일"); // Filter options: 오늘, 7일, 30일
  const [stats, setStats] = useState(initialStats);
  const [logs, setLogs] = useState(systemLogs);
  const [topMeetingsList, setTopMeetingsList] = useState(topMeetings);
  const [rawData, setRawData] = useState({ users: [], meetings: [], reports: [] });
  
  // Dynamic SVG Chart paths states
  const [chartPaths, setChartPaths] = useState({
    lineD: "M40,150 Q76,145 112,130 T184,115 T256,120 T328,50 T400,90 T480,35",
    areaD: "M40,165 L40,150 Q76,145 112,130 T184,115 T256,120 T328,50 T400,90 T480,35 L480,165 Z",
    points: [{ cx: 328, cy: 50 }, { cx: 480, cy: 35 }],
    yLabels: ["2k", "1.5k", "1k", "0.5k"],
    labelsX: ["1일", "8일", "15일", "22일", "30일"]
  });

  // Dynamic Sport Top 3 + Others Bar Chart list
  const [sportPercentages, setSportPercentages] = useState([
    { rank: 1, name: "축구", count: 145, percentage: 45 },
    { rank: 2, name: "러닝", count: 98, percentage: 30 },
    { rank: 3, name: "테니스", count: 85, percentage: 25 },
    { rank: 4, name: "기타", count: "-", percentage: 0 }
  ]);

  const [regionPercentages, setRegionPercentages] = useState([
    { rank: 1, name: "서울", count: 25, percentage: 55 },
    { rank: 2, name: "경기", count: 12, percentage: 25 },
    { rank: 3, name: "부산", count: 5, percentage: 12 },
    { rank: 4, name: "기타", count: 4, percentage: 8 }
  ]);

  const [weeklyPercentages, setWeeklyPercentages] = useState([
    { day: "일", percentage: 15 },
    { day: "월", percentage: 10 },
    { day: "화", percentage: 12 },
    { day: "수", percentage: 14 },
    { day: "목", percentage: 16 },
    { day: "금", percentage: 20 },
    { day: "토", percentage: 25 }
  ]);

  const [loading, setLoading] = useState(true);
  const [isApiConnected, setIsApiConnected] = useState(false);

  useEffect(() => {
    async function fetchAnalyticsData() {
      try {
        setLoading(true);
        const [usersRes, meetingsRes, reportsRes] = await Promise.allSettled([
          adminApi.users(),
          adminApi.meetings(),
          adminApi.reports()
        ]);

        const apiUsers = usersRes.status === "fulfilled" && usersRes.value?.items ? usersRes.value.items : [];
        const apiMeetings = meetingsRes.status === "fulfilled" && meetingsRes.value?.items ? meetingsRes.value.items : [];
        const apiReports = reportsRes.status === "fulfilled" && reportsRes.value?.items ? reportsRes.value.items : [];

        setRawData({
          users: apiUsers,
          meetings: apiMeetings,
          reports: apiReports
        });
        if (usersRes.status === "fulfilled" || meetingsRes.status === "fulfilled" || reportsRes.status === "fulfilled") {
          setIsApiConnected(true);
        }
      } catch (err) {
        console.error("API error while generating analytics, fallback used", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalyticsData();
  }, []);

  useEffect(() => {
    const { users: apiUsers, meetings: apiMeetings, reports: apiReports } = rawData;
    const now = new Date();

    const isToday = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d.getDate() === now.getDate() &&
             d.getMonth() === now.getMonth() &&
             d.getFullYear() === now.getFullYear();
    };

    const isWithinPeriod = (dateStr, days) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      const diffTime = now - d;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= days;
    };

    // 1. Filter raw data based on tab
    let filteredUsers = [];
    let filteredMeetings = [];
    let filteredReports = [];
    let prevPeriodUsers = [];
    let prevPeriodMeetings = [];

    if (activeTab === "오늘") {
      filteredUsers = apiUsers.filter(u => isToday(u.created_at));
      filteredMeetings = apiMeetings.filter(m => isToday(m.created_at || m.start_at));
      filteredReports = apiReports.filter(r => isToday(r.created_at));

      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d.getDate() === yesterday.getDate() &&
               d.getMonth() === yesterday.getMonth() &&
               d.getFullYear() === yesterday.getFullYear();
      };
      prevPeriodUsers = apiUsers.filter(u => isYesterday(u.created_at));
      prevPeriodMeetings = apiMeetings.filter(m => isYesterday(m.created_at || m.start_at));
    } else if (activeTab === "7일") {
      filteredUsers = apiUsers.filter(u => isWithinPeriod(u.created_at, 7));
      filteredMeetings = apiMeetings.filter(m => isWithinPeriod(m.created_at || m.start_at, 7));
      filteredReports = apiReports.filter(r => isWithinPeriod(r.created_at, 7));

      prevPeriodUsers = apiUsers.filter(u => {
        if (!u.created_at) return false;
        const diffDays = (now - new Date(u.created_at)) / (1000 * 60 * 60 * 24);
        return diffDays > 7 && diffDays <= 14;
      });
      prevPeriodMeetings = apiMeetings.filter(m => {
        const val = m.created_at || m.start_at;
        if (!val) return false;
        const diffDays = (now - new Date(val)) / (1000 * 60 * 60 * 24);
        return diffDays > 7 && diffDays <= 14;
      });
    } else {
      // 30일
      filteredUsers = apiUsers.filter(u => isWithinPeriod(u.created_at, 30));
      filteredMeetings = apiMeetings.filter(m => isWithinPeriod(m.created_at || m.start_at, 30));
      filteredReports = apiReports.filter(r => isWithinPeriod(r.created_at, 30));

      prevPeriodUsers = apiUsers.filter(u => {
        if (!u.created_at) return false;
        const diffDays = (now - new Date(u.created_at)) / (1000 * 60 * 60 * 24);
        return diffDays > 30 && diffDays <= 60;
      });
      prevPeriodMeetings = apiMeetings.filter(m => {
        const val = m.created_at || m.start_at;
        if (!val) return false;
        const diffDays = (now - new Date(val)) / (1000 * 60 * 60 * 24);
        return diffDays > 30 && diffDays <= 60;
      });
    }

    // 2. Process metrics with fallbacks if database is empty (so it looks beautiful)
    let revenue = 0;
    let revenueTrend = "0%";
    let revenueTrendIsUp = true;

    if (apiMeetings.length === 0 && !isApiConnected) {
      // Fallbacks for empty database mockup
      revenue = activeTab === "오늘" ? 450000 : activeTab === "7일" ? 3250000 : 14250000;
      revenueTrend = activeTab === "오늘" ? "2.5%" : activeTab === "7일" ? "6.8%" : "12.5%";
    } else {
      // Simulated dynamic revenue: 150,000 won per meeting created
      revenue = filteredMeetings.length * 150000;
      const prevRevenue = prevPeriodMeetings.length * 150000;
      if (prevRevenue === 0) {
        revenueTrend = revenue > 0 ? "100%" : "0%";
        revenueTrendIsUp = true;
      } else {
        const growth = ((revenue - prevRevenue) / prevRevenue) * 100;
        revenueTrend = `${Math.abs(Math.round(growth))}%`;
        revenueTrendIsUp = growth >= 0;
      }
    }

    let newUsers = filteredUsers.length;
    let newUsersTrend = "0%";
    let newUsersTrendIsUp = true;

    if (apiUsers.length === 0 && !isApiConnected) {
      newUsers = activeTab === "오늘" ? 58 : activeTab === "7일" ? 412 : 1842;
      newUsersTrend = activeTab === "오늘" ? "1.8%" : activeTab === "7일" ? "4.5%" : "8.2%";
    } else {
      if (prevPeriodUsers.length === 0) {
        newUsersTrend = newUsers > 0 ? "100%" : "0%";
        newUsersTrendIsUp = true;
      } else {
        const growth = ((newUsers - prevPeriodUsers.length) / prevPeriodUsers.length) * 100;
        newUsersTrend = `${Math.abs(Math.round(growth))}%`;
        newUsersTrendIsUp = growth >= 0;
      }
    }

    let activeMeetings = filteredMeetings.length;
    if (apiMeetings.length === 0 && !isApiConnected) {
      activeMeetings = activeTab === "오늘" ? 12 : activeTab === "7일" ? 78 : 328;
    }

    const soccerCount = filteredMeetings.filter(m => (m.sport?.name || m.sport) === "축구" || (m.sport?.name || m.sport) === "풋살").length;
    const runningCount = filteredMeetings.filter(m => (m.sport?.name || m.sport) === "러닝").length;
    const tennisCount = filteredMeetings.filter(m => (m.sport?.name || m.sport) === "테니스").length;

    const soccerFallback = activeTab === "오늘" ? 6 : activeTab === "7일" ? 38 : 145;
    const runningFallback = activeTab === "오늘" ? 4 : activeTab === "7일" ? 24 : 98;
    const tennisFallback = activeTab === "오늘" ? 2 : activeTab === "7일" ? 16 : 85;

    const pendingCount = filteredReports.filter(r => r.status === "pending" || r.status === "대기 중").length;
    const resolvedCount = filteredReports.filter(r => r.status === "resolved" || r.status === "처리 완료").length;

    const pendingFallback = activeTab === "오늘" ? 1 : activeTab === "7일" ? 3 : 12;
    const resolvedFallback = activeTab === "오늘" ? 4 : activeTab === "7일" ? 15 : 45;

    setStats({
      revenue,
      revenueTrend,
      revenueTrendIsUp,
      newUsers,
      newUsersTrend,
      newUsersTrendIsUp,
      activeMeetings,
      meetingsDetails: {
        soccer: (apiMeetings.length === 0 && !isApiConnected) ? soccerFallback : soccerCount,
        running: (apiMeetings.length === 0 && !isApiConnected) ? runningFallback : runningCount,
        tennis: (apiMeetings.length === 0 && !isApiConnected) ? tennisFallback : tennisCount
      },
      reports: {
        pending: (apiReports.length === 0 && !isApiConnected) ? pendingFallback : pendingCount,
        resolved: (apiReports.length === 0 && !isApiConnected) ? resolvedFallback : resolvedCount
      }
    });

    // 3. Process Dynamic Popular Sports (Top 3)
    const sportCounts = {};
    filteredMeetings.forEach(m => {
      const sportName = m.sport?.name || m.sport || "기타";
      sportCounts[sportName] = (sportCounts[sportName] || 0) + 1;
    });

    const sortedSports = Object.entries(sportCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const top3Sports = sortedSports.slice(0, 3);
    const totalMeetingsInPeriod = filteredMeetings.length;
    
    const formattedSports = top3Sports.map((s, idx) => {
      const pct = totalMeetingsInPeriod > 0 ? Math.round((s.count / totalMeetingsInPeriod) * 100) : 0;
      return {
        rank: idx + 1,
        name: s.name,
        count: s.count,
        percentage: pct
      };
    });

    if (formattedSports.length === 0 && !isApiConnected) {
      const totalFallback = activeTab === "오늘" ? 12 : activeTab === "7일" ? 78 : 328;
      const soccerVal = activeTab === "오늘" ? 6 : activeTab === "7일" ? 38 : 145;
      const runningVal = activeTab === "오늘" ? 4 : activeTab === "7일" ? 24 : 98;
      const tennisVal = activeTab === "오늘" ? 2 : activeTab === "7일" ? 16 : 85;

      formattedSports.push(
        { rank: 1, name: "축구", count: soccerVal, percentage: Math.round(soccerVal / totalFallback * 100) },
        { rank: 2, name: "러닝", count: runningVal, percentage: Math.round(runningVal / totalFallback * 100) },
        { rank: 3, name: "테니스", count: tennisVal, percentage: Math.round(tennisVal / totalFallback * 100) }
      );
    } else if (formattedSports.length < 3) {
      const fallbacks = [
        { name: "축구", percentage: 45 },
        { name: "러닝", percentage: 30 },
        { name: "테니스", percentage: 25 }
      ];
      for (let i = formattedSports.length; i < 3; i++) {
        const fb = fallbacks[i] || fallbacks[0];
        formattedSports.push({
          rank: i + 1,
          name: fb.name,
          count: 0,
          percentage: fb.percentage
        });
      }
    }

    // Calculate Others (기타) percentage
    const pct1 = formattedSports[0]?.percentage || 0;
    const pct2 = formattedSports[1]?.percentage || 0;
    const pct3 = formattedSports[2]?.percentage || 0;
    const othersPct = Math.max(0, 100 - pct1 - pct2 - pct3);

    formattedSports.push({
      rank: 4,
      name: "기타",
      count: "-",
      percentage: othersPct
    });

    setSportPercentages(formattedSports);

    // 4. Process Popular Meetings list
    if (filteredMeetings.length > 0) {
      const sorted = [...filteredMeetings]
        .map(m => {
          const current = m.current_participants || 0;
          const max = m.max_participants || 1;
          const rate = Math.round((current / max) * 100);
          return { ...m, current, max, rate };
        })
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 4)
        .map((m, idx) => ({
          rank: idx + 1,
          title: m.title,
          location: m.location_name || "지역 정보 없음",
          rate: `${m.rate}%`,
          capacity: `${m.current}/${m.max}명`
        }));
      setTopMeetingsList(sorted);
    } else {
      setTopMeetingsList(isApiConnected ? [] : topMeetings.slice(0, 4));
    }

    // 5. System Logs
    const generatedLogs = [];
    if (filteredReports.length > 0) {
      filteredReports.slice(0, 2).forEach((r) => {
        generatedLogs.push({
          id: `report-${r.id}`,
          category: "신고 접수",
          type: "security",
          created_at: r.created_at || new Date().toISOString(),
          desc: `신고자 '${r.reporter_name || "사용자"}'님이 대상에 대해 '${r.reason || "기타"}' 사유로 신규 신고를 접수했습니다.`
        });
      });
    }
    if (filteredMeetings.length > 0) {
      filteredMeetings.slice(0, 2).forEach((m) => {
        generatedLogs.push({
          id: `meeting-${m.id}`,
          category: "모임 개설",
          type: "action",
          created_at: m.created_at || new Date().toISOString(),
          desc: `방장 '${m.host?.nickname || "방장"}'님이 신규 모임 '${m.title}'을(를) 정상 개설했습니다.`
        });
      });
    }
    if (filteredUsers.length > 0) {
      filteredUsers.slice(0, 2).forEach((u) => {
        generatedLogs.push({
          id: `user-${u.id}`,
          category: "회원 가입",
          type: "update",
          created_at: u.created_at || new Date().toISOString(),
          desc: `신규 가입 유저 '${u.nickname || u.name}'님이 SportsMate 서비스 가입을 완료했습니다.`
        });
      });
    }

    // Pad with default logs only if offline (mock mode)
    if (!isApiConnected) {
      for (let i = generatedLogs.length; i < 4; i++) {
        if (systemLogs[i]) {
          const mockLog = systemLogs[i];
          const parseTime = (str) => {
            if (!str) return 0;
            const minMatch = str.match(/^(\d+)분\s*전$/);
            if (minMatch) return parseInt(minMatch[1], 10);
            const hourMatch = str.match(/^(\d+)시간\s*전$/);
            if (hourMatch) return parseInt(hourMatch[1], 10) * 60;
            const dayMatch = str.match(/^(\d+)일\s*전$/);
            if (dayMatch) return parseInt(dayMatch[1], 10) * 60 * 24;
            return 0;
          };
          const minsAgo = parseTime(mockLog.time);
          const mockCreatedAt = new Date(Date.now() - minsAgo * 60 * 1000).toISOString();
          
          generatedLogs.push({ 
            ...mockLog, 
            id: `mock-${i}`,
            created_at: mockCreatedAt
          });
        }
      }
    }

    // Sort logs so that the newest is at the top
    generatedLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Format relative time text dynamically
    const formattedLogs = generatedLogs.slice(0, 4).map(log => {
      const getRelativeTimeText = (dateStr) => {
        if (!dateStr) return "방금";
        const d = new Date(dateStr);
        const diffMs = Math.abs(now - d);
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 1) {
          return "방금";
        }
        if (diffMins < 60) {
          return `${diffMins}분 전`;
        }
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
          return `${diffHours}시간 전`;
        }
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}일 전`;
      };
      
      return {
        ...log,
        time: getRelativeTimeText(log.created_at)
      };
    });
    setLogs(formattedLogs);

    // 6. Line chart coordinates
    let pointsCount = 30;
    let labelsX = [];
    let counts = [];

    if (activeTab === "오늘") {
      pointsCount = 24;
      counts = Array(24).fill(0);
      labelsX = ["00시", "06시", "12시", "18시", "24시"];
      
      filteredUsers.forEach(u => {
        if (u.created_at) {
          const createdDate = new Date(u.created_at);
          const hour = createdDate.getHours();
          if (hour >= 0 && hour < 24) {
            counts[hour]++;
          }
        }
      });
    } else if (activeTab === "7일") {
      pointsCount = 7;
      counts = Array(7).fill(0);
      labelsX = ["7일전", "5일전", "3일전", "오늘"];
      
      filteredUsers.forEach(u => {
        if (u.created_at) {
          const createdDate = new Date(u.created_at);
          const diffTime = Math.abs(now - createdDate);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays < 7) {
            counts[6 - diffDays]++;
          }
        }
      });
    } else {
      pointsCount = 30;
      counts = Array(30).fill(0);
      labelsX = ["1일", "8일", "15일", "22일", "30일"];
      
      filteredUsers.forEach(u => {
        if (u.created_at) {
          const createdDate = new Date(u.created_at);
          const diffTime = Math.abs(now - createdDate);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays < 30) {
            counts[29 - diffDays]++;
          }
        }
      });
    }

    // Cumulative growth path
    const cumSum = [];
    const totalCountInPeriod = counts.reduce((a, b) => a + b, 0);
    const baseline = apiUsers.length > 0 
      ? Math.max(0, apiUsers.length - totalCountInPeriod)
      : (activeTab === "오늘" ? 1780 : activeTab === "7일" ? 1430 : 0);
    
    let currentSum = baseline;
    for (let i = 0; i < pointsCount; i++) {
      currentSum += counts[i];
      cumSum.push(currentSum);
    }

    const maxCumVal = Math.max(...cumSum, 5);
    const points = cumSum.map((val, idx) => {
      const x = 40 + (idx / (pointsCount - 1)) * (480 - 40);
      const y = 165 - (val / maxCumVal) * (165 - 30);
      return { x, y };
    });

    let lineD = `M${points[0].x},${points[0].y}`;
    let areaD = `M${points[0].x},165 L${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      lineD += ` L${points[i].x},${points[i].y}`;
      areaD += ` L${points[i].x},${points[i].y}`;
    }
    areaD += ` L${points[points.length - 1].x},165 Z`;

    const yLabels = [
      `${maxCumVal}명`,
      `${Math.round(maxCumVal * 0.75)}명`,
      `${Math.round(maxCumVal * 0.5)}명`,
      `${Math.round(maxCumVal * 0.25)}명`
    ];

    setChartPaths({
      lineD,
      areaD,
      points: points.filter((_, i) => pointsCount <= 7 ? true : i % 5 === 0 || i === pointsCount - 1).map(p => ({ cx: p.x, cy: p.y })),
      yLabels,
      labelsX
    });

    // 7. Process Region Stats
    const regionCounts = {};
    filteredMeetings.forEach(m => {
      let regionName = "기타";
      const addr = m.address || m.location_name || "";
      if (addr) {
        const firstWord = addr.trim().split(/\s+/)[0];
        if (firstWord.startsWith("서울")) regionName = "서울";
        else if (firstWord.startsWith("경기")) regionName = "경기";
        else if (firstWord.startsWith("인천")) regionName = "인천";
        else if (firstWord.startsWith("부산")) regionName = "부산";
        else if (firstWord.startsWith("대구")) regionName = "대구";
        else if (firstWord.startsWith("대전")) regionName = "대전";
        else if (firstWord.startsWith("광주")) regionName = "광주";
        else if (firstWord.startsWith("울산")) regionName = "울산";
        else if (firstWord.startsWith("세종")) regionName = "세종";
        else if (firstWord.startsWith("강원")) regionName = "강원";
        else if (firstWord.startsWith("충청북") || firstWord.startsWith("충북")) regionName = "충북";
        else if (firstWord.startsWith("충청남") || firstWord.startsWith("충남")) regionName = "충남";
        else if (firstWord.startsWith("전라북") || firstWord.startsWith("전북")) regionName = "전북";
        else if (firstWord.startsWith("전라남") || firstWord.startsWith("전남")) regionName = "전남";
        else if (firstWord.startsWith("경상북") || firstWord.startsWith("경북")) regionName = "경북";
        else if (firstWord.startsWith("경상남") || firstWord.startsWith("경남")) regionName = "경남";
        else if (firstWord.startsWith("제주")) regionName = "제주";
      }
      regionCounts[regionName] = (regionCounts[regionName] || 0) + 1;
    });

    const sortedRegions = Object.entries(regionCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const topRegions = sortedRegions.filter(r => r.name !== "기타").slice(0, 3);
    const othersRegionCount = sortedRegions.find(r => r.name === "기타")?.count || 0;
    const sortedRegionTotal = filteredMeetings.length;

    const formattedRegions = topRegions.map((r, idx) => {
      const pct = sortedRegionTotal > 0 ? Math.round((r.count / sortedRegionTotal) * 100) : 0;
      return {
        rank: idx + 1,
        name: r.name,
        count: r.count,
        percentage: pct
      };
    });

    const totalPct = formattedRegions.reduce((sum, r) => sum + r.percentage, 0);
    const remainingPct = Math.max(0, 100 - totalPct);

    formattedRegions.push({
      rank: formattedRegions.length + 1,
      name: "기타",
      count: othersRegionCount || "-",
      percentage: remainingPct
    });

    if (sortedRegionTotal === 0 && !isApiConnected) {
      // Default fallbacks for empty database
      const fallbackRegions = [
        { rank: 1, name: "서울", count: activeTab === "오늘" ? 7 : activeTab === "7일" ? 43 : 180, percentage: 55 },
        { rank: 2, name: "경기", count: activeTab === "오늘" ? 3 : activeTab === "7일" ? 20 : 82, percentage: 25 },
        { rank: 3, name: "부산", count: activeTab === "오늘" ? 1 : activeTab === "7일" ? 9 : 39, percentage: 12 },
        { rank: 4, name: "기타", count: activeTab === "오늘" ? 1 : activeTab === "7일" ? 6 : 27, percentage: 8 }
      ];
      setRegionPercentages(fallbackRegions);
    } else {
      setRegionPercentages(formattedRegions);
    }

    // 8. Process Weekly Stats
    const weeklyCounts = Array(7).fill(0); // 0: Sun, 1: Mon, ... 6: Sat
    filteredMeetings.forEach(m => {
      const dateStr = m.created_at || m.start_at;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          weeklyCounts[d.getDay()]++;
        }
      }
    });

    const maxWeeklyVal = Math.max(...weeklyCounts, 1);
    const daysName = ["일", "월", "화", "수", "목", "금", "토"];
    const formattedWeekly = daysName.map((day, idx) => {
      const count = weeklyCounts[idx];
      const pct = Math.round((count / maxWeeklyVal) * 100);
      return {
        day,
        percentage: count > 0 ? pct : 0,
        count
      };
    });

    const weeklyTotal = filteredMeetings.length;
    if (weeklyTotal === 0 && !isApiConnected) {
      // Fallback values for empty state
      const fallbackWeekly = [
        { day: "일", percentage: 75, count: activeTab === "오늘" ? 3 : activeTab === "7일" ? 18 : 74 },
        { day: "월", percentage: 40, count: activeTab === "오늘" ? 1 : activeTab === "7일" ? 10 : 39 },
        { day: "화", percentage: 45, count: activeTab === "오늘" ? 1 : activeTab === "7일" ? 11 : 44 },
        { day: "수", percentage: 55, count: activeTab === "오늘" ? 2 : activeTab === "7일" ? 13 : 54 },
        { day: "목", percentage: 50, count: activeTab === "오늘" ? 2 : activeTab === "7일" ? 12 : 49 },
        { day: "금", percentage: 80, count: activeTab === "오늘" ? 3 : activeTab === "7일" ? 19 : 79 },
        { day: "토", percentage: 100, count: activeTab === "오늘" ? 4 : activeTab === "7일" ? 24 : 98 }
      ];
      setWeeklyPercentages(fallbackWeekly);
    } else {
      setWeeklyPercentages(formattedWeekly);
    }

  }, [activeTab, rawData, isApiConnected]);

  const handleFilterClick = (tab) => {
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "400px", gap: "16px" }}>
        <style>{`
          @keyframes admin-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{
          width: "48px",
          height: "48px",
          border: "4px solid #f3f3f3",
          borderTop: "4px solid #3b82f6",
          borderRadius: "50%",
          animation: "admin-spin 1s linear infinite"
        }}></div>
        <span style={{ fontSize: "16px", color: "#64748b", fontWeight: 600 }}>통계 데이터를 분석하는 중...</span>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      {/* Upper Title Description & Filter row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
          시스템의 핵심 지표와 동향을 한눈에 파악하세요.
        </p>
        <div className="analytics-chart-panel__filter-row">
          {["오늘", "7일", "30일"].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => handleFilterClick(tab)}
              className={`analytics-chart-panel__filter-btn ${activeTab === tab ? "active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Metric Widget Cards Grid (4 Columns) */}
      <section className="admin-stats-grid-4">
        {/* Card 1: Revenue Card with mini wave background graph */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">총 수익</span>
            <div className="admin-stat-card__value">
              ₩{stats.revenue.toLocaleString()}
            </div>
            <span className={`admin-stat-card__trend ${stats.revenueTrendIsUp ? "admin-stat-card__trend--up" : "admin-stat-card__trend--danger"}`}>
              {stats.revenueTrendIsUp ? "▲" : "▼"} {stats.revenueTrend} <span style={{ color: "#94a3b8" }}>{activeTab === "오늘" ? "전일 대비" : activeTab === "7일" ? "전주 대비" : "전월 대비"}</span>
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--blue">
            <DollarSign size={20} />
          </div>
          {/* Mini Wave graph SVG background */}
          <svg className="admin-stat-card__bg-svg" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0,25 Q15,10 30,22 T60,5 T90,28 T100,20 L100,30 L0,30 Z" fill="#eff6ff" />
            <path d="M0,25 Q15,10 30,22 T60,5 T90,28 T100,20" fill="none" stroke="#3b82f6" strokeWidth="1" />
          </svg>
        </div>

        {/* Card 2: New Members */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">신규 회원</span>
            <div className="admin-stat-card__value">
              {stats.newUsers.toLocaleString()}
              <span className="admin-stat-card__unit">명</span>
            </div>
            <span className={`admin-stat-card__trend ${stats.newUsersTrendIsUp ? "admin-stat-card__trend--up" : "admin-stat-card__trend--danger"}`}>
              {stats.newUsersTrendIsUp ? "▲" : "▼"} {stats.newUsersTrend} <span style={{ color: "#94a3b8" }}>{activeTab === "오늘" ? "전일 대비" : activeTab === "7일" ? "전주 대비" : "전월 대비"}</span>
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--orange">
            <UserPlus size={20} />
          </div>
        </div>

        {/* Card 3: Active Meetings with category mini badges */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">활성 모임</span>
            <div className="admin-stat-card__value">
              {stats.activeMeetings}
              <span className="admin-stat-card__unit">개</span>
            </div>
            <span className="admin-stat-card__trend" style={{ color: "#64748b", backgroundColor: "#f1f5f9", display: "inline-block", fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px" }}>
              실시간 개설 및 매칭 중
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--green">
            <Trophy size={20} />
          </div>
        </div>

        {/* Card 4: Issues Warning Card */}
        <button type="button" className="admin-stat-card" onClick={() => navigate("/admin/reports")} style={{ textAlign: "left" }}>
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">신고/이슈 현황</span>
            <div style={{ display: "flex", gap: "20px", marginTop: "4px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>대기 중인 이슈</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#ef4444" }}>
                  {stats.reports.pending}<span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b", marginLeft: "2px" }}>건</span>
                </div>
              </div>
              <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: "16px" }}>
                <div style={{ fontSize: "11px", color: "#475569", fontWeight: 700 }}>처리 완료</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>
                  {stats.reports.resolved}<span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b", marginLeft: "2px" }}>건</span>
                </div>
              </div>
            </div>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--red">
            <AlertCircle size={20} />
          </div>
        </button>
      </section>

      {/* 2. Analytical Graphs Section (Line chart & Doughnut chart) */}
      <div className="admin-grid-cols" style={{ marginBottom: "32px" }}>
        {/* Graph 1: Membership growth trends (SVG Line Chart) */}
        <section className="admin-panel-card" style={{ marginBottom: 0 }}>
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">회원 증가 추이</h2>
            <button type="button" className="admin-panel-card__more-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="admin-panel-card__body">
            <div className="svg-chart-container">
              <svg viewBox="0 0 500 220" preserveAspectRatio="none">
                <defs>
                  {/* Linear gradient for filling under chart line */}
                  <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                <line x1="40" y1="30" x2="480" y2="30" className="svg-chart__grid-line" />
                <line x1="40" y1="75" x2="480" y2="75" className="svg-chart__grid-line" />
                <line x1="40" y1="120" x2="480" y2="120" className="svg-chart__grid-line" />
                <line x1="40" y1="165" x2="480" y2="165" className="svg-chart__grid-line" />

                {/* Shaded Area Under Line */}
                <path 
                  d={chartPaths.areaD} 
                  className="svg-chart__area"
                />

                {/* Smooth curve line */}
                <path 
                  d={chartPaths.lineD} 
                  className="svg-chart__line"
                />

                {/* Axis lines */}
                <line x1="40" y1="165" x2="480" y2="165" className="svg-chart__axis-line" />
                <line x1="40" y1="30" x2="40" y2="165" className="svg-chart__axis-line" />

                {/* Y-axis Labels */}
                <text x="30" y="34" textAnchor="end" className="svg-chart__axis-text">{chartPaths.yLabels[0]}</text>
                <text x="30" y="79" textAnchor="end" className="svg-chart__axis-text">{chartPaths.yLabels[1]}</text>
                <text x="30" y="124" textAnchor="end" className="svg-chart__axis-text">{chartPaths.yLabels[2]}</text>
                <text x="30" y="169" textAnchor="end" className="svg-chart__axis-text">{chartPaths.yLabels[3]}</text>

                {/* X-axis Labels */}
                {chartPaths.labelsX && chartPaths.labelsX.map((label, index) => {
                  const x = 40 + (index / (chartPaths.labelsX.length - 1)) * (480 - 40);
                  return (
                    <text key={index} x={x} y="185" textAnchor="middle" className="svg-chart__axis-text">
                      {label}
                    </text>
                  );
                })}

                {/* Interactive Points decoration */}
                {chartPaths.points.map((p, idx) => (
                  <circle key={idx} cx={p.cx} cy={p.cy} r="5" className="svg-chart__point" />
                ))}
              </svg>
            </div>
          </div>
        </section>

        {/* Graph 2: Popular sports percentage (SVG Doughnut Chart) */}
        <section className="admin-panel-card" style={{ marginBottom: 0 }}>
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">인기 스포츠</h2>
            <button type="button" className="admin-panel-card__more-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="admin-panel-card__body" style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "16px" }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "flex-end", 
              height: "185px", 
              paddingBottom: "12px", 
              borderBottom: "2px solid #e2e8f0",
              paddingLeft: "10px",
              paddingRight: "10px"
            }}>
              {sportPercentages.map((sport, index) => {
                // Color codes based on rank
                const gradients = [
                  "linear-gradient(to top, #2563eb, #60a5fa)", // 1st: Blue
                  "linear-gradient(to top, #ea580c, #fb923c)", // 2nd: Orange
                  "linear-gradient(to top, #059669, #34d399)", // 3rd: Green
                  "linear-gradient(to top, #64748b, #94a3b8)"  // 4th/기타: Slate Gray
                ];
                const gradient = gradients[index] || gradients[0];

                return (
                  <div key={sport.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "22%" }}>
                    {/* Percentage text above the bar */}
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b" }}>
                      {sport.percentage}%
                    </span>
                    {/* Vertical Bar track */}
                    <div style={{ 
                      width: "36px", 
                      height: "145px", 
                      borderRadius: "6px 6px 0 0", 
                      backgroundColor: "rgba(241, 245, 249, 0.85)", 
                      display: "flex", 
                      flexDirection: "column", 
                      justifyContent: "flex-end", 
                      overflow: "hidden" 
                    }}>
                      {/* Vertical Bar fill */}
                      <div style={{ 
                        width: "100%", 
                        height: `${sport.percentage}%`, 
                        borderRadius: "6px 6px 0 0", 
                        background: gradient,
                        transition: "height 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend Labels row underneath the bars */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px" }}>
              {sportPercentages.map((sport, index) => {
                const colors = ["#2563eb", "#ea580c", "#059669", "#64748b"];
                const color = colors[index] || colors[0];
                return (
                  <div key={sport.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "22%", gap: "2px" }}>
                    <span style={{ 
                      fontSize: "12px", 
                      fontWeight: 800, 
                      color: color,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%"
                    }}>
                      {sport.name === "기타" ? "기타" : `${sport.rank}위 ${sport.name}`}
                    </span>
                    {sport.name !== "기타" && (
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                        {sport.count}개
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* 2.5. New Analytical Row: Region and Weekly Charts */}
      <div className="admin-grid-cols" style={{ marginBottom: "32px" }}>
        {/* Card 1: Meetings by Region (Horizontal Progress Bar Style) */}
        <section className="admin-panel-card" style={{ marginBottom: 0 }}>
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">지역별 모임 분포</h2>
            <button type="button" className="admin-panel-card__more-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="admin-panel-card__body" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {regionPercentages.map((reg, index) => {
              const colors = ["#3b82f6", "#f97316", "#10b981", "#64748b"];
              const color = colors[index] || colors[0];
              return (
                <div key={reg.name} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                    <span>{reg.rank}위 {reg.name}</span>
                    <span style={{ color }}>{reg.percentage}% ({reg.count}개)</span>
                  </div>
                  <div style={{ height: "10px", width: "100%", backgroundColor: "#f1f5f9", borderRadius: "5px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${reg.percentage}%`,
                      backgroundColor: color,
                      borderRadius: "5px",
                      transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Card 2: Weekly Activity Analysis (Vertical CSS Bar Chart) */}
        <section className="admin-panel-card" style={{ marginBottom: 0 }}>
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">요일별 활성도 분석</h2>
            <button type="button" className="admin-panel-card__more-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="admin-panel-card__body" style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "16px" }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "flex-end", 
              height: "145px", 
              paddingBottom: "12px", 
              borderBottom: "2px solid #e2e8f0"
            }}>
              {weeklyPercentages.map((week) => {
                const isWeekend = week.day === "토" || week.day === "일";
                const barColor = isWeekend ? "linear-gradient(to top, #ef4444, #f87171)" : "linear-gradient(to top, #3b82f6, #60a5fa)";
                return (
                  <div key={week.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "12%" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                      {week.count}개
                    </span>
                    <div style={{ 
                      width: "24px", 
                      height: "100px", 
                      borderRadius: "4px 4px 0 0", 
                      backgroundColor: "rgba(241, 245, 249, 0.85)", 
                      display: "flex", 
                      flexDirection: "column", 
                      justifyContent: "flex-end", 
                      overflow: "hidden" 
                    }}>
                      <div style={{ 
                        width: "100%", 
                        height: `${week.percentage}%`, 
                        borderRadius: "4px 4px 0 0", 
                        background: barColor,
                        transition: "height 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
              {weeklyPercentages.map((week) => (
                <div key={week.day} style={{ width: "12%", textAlign: "center" }}>
                  <span style={{ 
                    fontSize: "12px", 
                    fontWeight: 800, 
                    color: week.day === "토" ? "#2563eb" : week.day === "일" ? "#dc2626" : "#475569"
                  }}>
                    {week.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* 3. Bottom Grid: Top 4 active meetings and system logs */}
      <div className="admin-grid-cols">
        {/* Left Column: Popular matches Top 4 */}
        <section className="admin-panel-card">
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">인기 활성 모임 Top 4</h2>
            <Link to="/admin/meetings" className="admin-panel-card__link">
              모두 보기
            </Link>
          </div>
          <div className="admin-panel-card__body">
            <div className="admin-rank-list">
              {topMeetingsList.length === 0 ? (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: "14px" }}>
                  선택한 기간 내에 개설된 모임이 없습니다.
                </div>
              ) : (
                topMeetingsList.map((m) => (
                  <div className="admin-rank-item" key={m.rank}>
                    <div className="admin-rank-item__number">
                      {m.rank}
                    </div>
                    <div className="admin-rank-item__main">
                      <span className="admin-rank-item__title">{m.title}</span>
                      <span className="admin-rank-item__meta">{m.location}</span>
                    </div>
                    <div className="admin-rank-item__attendance">
                      <span className="admin-rank-item__rate">참석률 {m.rate}</span>
                      <span className="admin-rank-item__capa">정원 {m.capacity}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Recent system event logs */}
        <section className="admin-panel-card">
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">최근 시스템 로그</h2>
            <button type="button" className="admin-panel-card__more-btn" onClick={() => alert("로그 필터 기능 준비 중")}>
              <Filter size={16} />
            </button>
          </div>
          <div className="admin-panel-card__body">
            <div className="admin-log-list">
              {logs.length === 0 ? (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: "14px" }}>
                  선택한 기간 내에 발생한 시스템 로그가 없습니다.
                </div>
              ) : (
                logs.map((log) => (
                  <div className="admin-log-item" key={log.id}>
                    <div className="admin-log-item__dot-outer">
                      <div className={`admin-log-item__dot admin-log-item__dot--${log.type}`}></div>
                    </div>
                    <div className="admin-log-item__content">
                      <div className="admin-log-item__meta-row">
                        <span className={`admin-log-item__tag admin-log-item__tag--${log.type}`}>
                          [{log.category}]
                        </span>
                        <span className="admin-log-item__time">{log.time}</span>
                      </div>
                      <p className="admin-log-item__desc">
                        {log.desc}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminAnalyticsPage;
