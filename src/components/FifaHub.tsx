import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Trophy, 
  Calendar, 
  Bell, 
  BellRing, 
  Clock, 
  Tv, 
  Volume2, 
  Play, 
  AlertCircle, 
  Sparkles, 
  TrendingUp, 
  X, 
  Radio, 
  Megaphone, 
  ChevronRight,
  ShieldAlert,
  Zap,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { Channel } from "../types";

interface FifaHubProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onShowNotification: (message: string) => void;
}

interface FifaMatch {
  id: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  date: string; // "Y-m-d H:i:s" UTC format
  status: "LIVE" | "UPCOMING" | "FINISHED";
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  group: string;
  venue: string;
  scorers?: string;
}

export default function FifaHub({ channels, onSelectChannel, onShowNotification }: FifaHubProps) {
  // Live matches state
  const [matches, setMatches] = useState<FifaMatch[]>([
    {
      id: "m-1",
      homeTeam: "Mexico",
      homeFlag: "🇲🇽",
      awayTeam: "South Africa",
      awayFlag: "🇿🇦",
      date: "2026-06-11T16:00:00Z",
      status: "LIVE",
      homeScore: 2,
      awayScore: 1,
      minute: 74,
      group: "Group A",
      venue: "Estadio Azteca, Mexico City",
      scorers: "Chicharito II (18'), Lozano Jr. (54') • Foster (39')"
    },
    {
      id: "m-2",
      homeTeam: "United States",
      homeFlag: "🇺🇸",
      awayTeam: "Australia",
      awayFlag: "🇦🇺",
      date: "2026-06-11T19:30:00Z",
      status: "UPCOMING",
      group: "Group B",
      venue: "SoFi Stadium, Los Angeles",
    },
    {
      id: "m-3",
      homeTeam: "Canada",
      homeFlag: "🇨🇦",
      awayTeam: "Morocco",
      awayFlag: "🇲🇦",
      date: "2026-06-11T23:00:00Z",
      status: "UPCOMING",
      group: "Group C",
      venue: "BC Place, Vancouver",
    },
    {
      id: "m-4",
      homeTeam: "Argentina",
      homeFlag: "🇦🇷",
      awayTeam: "Sweden",
      awayFlag: "🇸🇪",
      date: "2026-06-12T14:00:00Z",
      status: "UPCOMING",
      group: "Group D",
      venue: "MetLife Stadium, New Jersey",
    },
    {
      id: "m-5",
      homeTeam: "Brazil",
      homeFlag: "🇧🇷",
      awayTeam: "Japan",
      awayFlag: "🇯🇵",
      date: "2026-06-12T17:30:00Z",
      status: "UPCOMING",
      group: "Group E",
      venue: "Hard Rock Stadium, Miami",
    },
    {
      id: "m-6",
      homeTeam: "England",
      homeFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      awayTeam: "Ghana",
      awayFlag: "🇬🇭",
      date: "2026-06-12T21:00:00Z",
      status: "UPCOMING",
      group: "Group F",
      venue: "Mercedes-Benz Stadium, Atlanta",
    },
    {
      id: "m-7",
      homeTeam: "Spain",
      homeFlag: "🇪🇸",
      awayTeam: "Saudi Arabia",
      awayFlag: "🇸🇦",
      date: "2026-06-13T13:00:00Z",
      status: "UPCOMING",
      group: "Group G",
      venue: "AT&T Stadium, Dallas",
    }
  ]);

  // User Location Tracing State
  const [detectedLocation, setDetectedLocation] = useState<{
    city: string;
    country: string;
    countryCode: string;
    timezone: string;
    loading: boolean;
  }>({
    city: "Dhaka",
    country: "Bangladesh",
    countryCode: "BD",
    timezone: "Asia/Dhaka",
    loading: true
  });

  // Live Match Ticker Events (Goal, Player Substitutions, Cards, Woodwork/VAR commentary)
  const [tickerEvents, setTickerEvents] = useState<Array<{
    id: string;
    minute: number;
    type: "GOAL" | "SUB" | "CARD" | "CHANCE" | "KICKOFF";
    message: string;
    timestamp: Date;
  }>>([
    { id: "e-k", minute: 1, type: "KICKOFF", message: "🏟️ Match Kicked Off inside Azteca! Loud atmospheric crowd cheers guide the World Cup opener.", timestamp: new Date() },
    { id: "e-1", minute: 18, type: "GOAL", message: "⚽ GOAL! Mexico [1] - 0 South Africa - Chicharito II scores via a bullet header!", timestamp: new Date() },
    { id: "e-2", minute: 39, type: "GOAL", message: "⚽ GOAL! Mexico 1 - [1] South Africa - Foster scores on a brilliant counter-attack!", timestamp: new Date() },
    { id: "e-3", minute: 54, type: "GOAL", message: "⚽ GOAL! Mexico [2] - 1 South Africa - Lozano Jr. scores via a masterclass curling free-kick!", timestamp: new Date() },
    { id: "e-4", minute: 61, type: "CARD", message: "🟨 Booking: Maphosa (South Africa) booked for a late sliding tackle on Herrera.", timestamp: new Date() },
    { id: "e-5", minute: 66, type: "SUB", message: "🔁 Player Change: Lozano Jr. OUT ➜ Raul Jimenez IN.", timestamp: new Date() },
    { id: "e-6", minute: 71, type: "CHANCE", message: "⚠️ Close Attempt: Phiri (South Africa) strikes from close range, denied by Ochoa's rapid reflexes!", timestamp: new Date() }
  ]);

  // Notifications subscribed list
  const [subscribedMatchIds, setSubscribedMatchIds] = useState<string[]>([]);

  // Browser Notifications Permission State
  const [notiPermission, setNotiPermission] = useState<"default" | "granted" | "denied">("default");

  // Favorite teams tracking
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("fifa_favs_teams");
      return saved ? JSON.parse(saved) : ["Mexico", "United States"];
    } catch {
      return ["Mexico", "United States"];
    }
  });

  // Track the notified matches to avoid duplicate kickoff alerts
  const [kickoffNotifiedIds, setKickoffNotifiedIds] = useState<string[]>([]);

  // Update permission status on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotiPermission(Notification.permission);
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("fifa_favs_teams", JSON.stringify(favoriteTeams));
    } catch (e) {
      console.error(e);
    }
  }, [favoriteTeams]);

  // Direct Native Browser Push Dispatcher with Visual Fallback
  const dispatchNotification = (title: string, body: string, isUrgent = false) => {
    // 1. Browser Native Alert
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: "https://images.unsplash.com/photo-1543351611-58f69d7c1781?auto=format&fit=crop&w=128&h=128&q=80", // beautiful soccer field badge representation image
            tag: `fifa-${Date.now()}`
          });
        } catch (e) {
          console.warn("HTML5 Notification failed to dispatch directly", e);
        }
      }
    }

    // 2. Custom elegant in-app alert fallback/banner (via original onShowNotification prop)
    onShowNotification(`${isUrgent ? "🚨 " : "🔔 "}${title}: ${body}`);
  };

  const handleRequestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      onShowNotification("⚠️ Browser notifications are not supported on your current browser terminal client.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotiPermission(permission);
      if (permission === "granted") {
        dispatchNotification(
          "🎉 Browser Push Alerts Enabled!",
          "Excellent! You will now receive instant push live notifications when goals are scored or matches kick off.",
          true
        );
      } else if (permission === "denied") {
        onShowNotification("⚠️ Notification permission was blocked. Please reset site permissions in your address bar to enable push notifications.");
      }
    } catch (e) {
      // In older browser versions requestPermission is callback-based
      Notification.requestPermission((permission) => {
        setNotiPermission(permission);
        if (permission === "granted") {
          dispatchNotification(
            "🎉 Browser Push Alerts Enabled!",
            "Excellent! You will now receive instant push live notifications when goals are scored or matches kick off.",
            true
          );
        }
      });
    }
  };

  // Toggle favorite country team
  const handleToggleFavoriteTeam = (teamName: string) => {
    setFavoriteTeams(prev => {
      const isFav = prev.includes(teamName);
      if (isFav) {
        onShowNotification(`Removed ${teamName} from followed teams.`);
        return prev.filter(t => t !== teamName);
      } else {
        onShowNotification(`Favorite squad set: ${teamName}! You will receive real-time push alerts of kickoff & goals.`);
        return [...prev, teamName];
      }
    });
  };

  const handleTriggerTestNotification = () => {
    dispatchNotification(
      "⚽ TEST GOAL! Mexico [3] - 1 South Africa",
      "Goal scored by Lozano Jr. in the 81st minute with a spectacular curving free kick! (Diagnostics Active!)",
      true
    );
  };
  
  // Real-time ticking time to calculate countdown
  const [currentTime, setCurrentTime] = useState<Date>(new Date("2026-06-11T07:52:20Z"));

  // Sponsor Video Ads Panel state
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [hasAdBonus, setHasAdBonus] = useState(false);
  const [adViewCount, setAdViewCount] = useState(0);

  // Filter selection (All vs Today vs Upcoming)
  const [subTab, setSubTab] = useState<"living" | "fixtures" | "standings">("living");

  // Automatically trace user location with fallback
  useEffect(() => {
    let isMounted = true;
    const fetchLocation = async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setDetectedLocation({
              city: data.city || "Dhaka",
              country: data.country_name || "Bangladesh",
              countryCode: data.country_code || "BD",
              timezone: data.timezone || "Asia/Dhaka",
              loading: false
            });
            onShowNotification(`🌍 Match schedule converted to your localized zone: ${data.city || "Dhaka"}, ${data.country_name || "Bangladesh"} (${data.timezone || "Asia/Dhaka"})`);
            return;
          }
        }
      } catch (e) {
        console.warn("API location lookup failed, relying on system locale context.", e);
      }

      if (isMounted) {
        try {
          const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
          setDetectedLocation({
            city: "User Location",
            country: "Local System Zone",
            countryCode: "SYS",
            timezone: systemTz,
            loading: false
          });
        } catch (err) {
          setDetectedLocation({
            city: "Dhaka",
            country: "Bangladesh",
            countryCode: "BD",
            timezone: "Asia/Dhaka",
            loading: false
          });
        }
      }
    };

    fetchLocation();
    return () => {
      isMounted = false;
    };
  }, [onShowNotification]);

  // Dynamic lists of random incidents to generate live ticker events
  const MEX_PLAYERS_OUT = ["Herrera", "Sanchez", "Chicharito II", "Montes", "Gallardo", "Alvarez"];
  const MEX_PLAYERS_IN = ["Raul Jimenez", "Corona", "Lozano Jr.", "Gimenez", "Antuna", "Chavez"];
  const RSA_PLAYERS_OUT = ["Foster", "Zwane", "Sithole", "Mayo", "Modiba", "Tau"];
  const RSA_PLAYERS_IN = ["Hlongwane", "Phiri", "Mokoena", "Lepasa", "Saleng", "Kodisang"];

  const INCIDENT_CARDS = [
    "🟨 Yellow Card: Chavez (Mexico) booked for pulling shirt.",
    "🟨 Yellow Card: Mokoena (South Africa) yellow card for a hard challenge.",
    "🟨 Yellow Card: Montes (Mexico) booked for disputing referee decision.",
    "🟨 Yellow Card: Lepasa (South Africa) booked for delay of game."
  ];

  const INCIDENT_CHANCES = [
    "⚠️ Attempt: South African winger Phiri fires a thunderous volley just wide of the post!",
    "⚠️ Woodwork: Jimenez hits the goalpost for Mexico with an acrobatic overhead kick!",
    "🎯 Saved: South Africa's Hlongwane shoots a low drive, saved comfortably by Ochoa Jr.!",
    "📢 VAR check completed for a penalty shout inside Mexico's 18-yard box. Penalty denied!"
  ];

  // Incremental score update effect to make results feel fully "live" with ticker commentary streaming
  useEffect(() => {
    const scoresInterval = setInterval(() => {
      // Choose random incident to report in ticker
      const randVal = Math.random();
      let newEvent: { type: "GOAL" | "SUB" | "CARD" | "CHANCE"; message: string } | null = null;

      setMatches(prevMatches => {
        return prevMatches.map(match => {
          if (match.status === "LIVE") {
            const nextMin = (match.minute || 74) + 1;
            let nextStatus: "LIVE" | "UPCOMING" | "FINISHED" = match.status;
            let nextScoreHome = match.homeScore || 0;
            let nextScoreAway = match.awayScore || 0;
            let nextScorers = match.scorers;

            if (nextMin > 90) {
              nextStatus = "FINISHED";
              newEvent = {
                type: "KICKOFF", // reused status to flag match finish
                message: `🏁 FULL TIME! Mexico match ended against South Africa with scores of ${nextScoreHome} - ${nextScoreAway}!`
              } as any;
            } else {
              // Simulated soccer probability of scoring (8%)
              if (randVal < 0.08) {
                const isHomeGoal = Math.random() > 0.45;
                if (isHomeGoal) {
                  nextScoreHome += 1;
                  const scorer = MEX_PLAYERS_IN[Math.floor(Math.random() * MEX_PLAYERS_IN.length)];
                  nextScorers += ` • ${scorer} (${nextMin}')`;
                  newEvent = {
                    type: "GOAL",
                    message: `⚽ GOOOOOAL for ${match.homeTeam}! ${scorer} scores inside the bottom-corner! Scores ${nextScoreHome} - ${nextScoreAway}!`
                  };
                } else {
                  nextScoreAway += 1;
                  const scorer = RSA_PLAYERS_IN[Math.floor(Math.random() * RSA_PLAYERS_IN.length)];
                  nextScorers += ` • ${scorer} (${nextMin}')`;
                  newEvent = {
                    type: "GOAL",
                    message: `⚽ GOOOOOAL for ${match.awayTeam}! ${scorer} heads it home past the keeper! Scores ${nextScoreHome} - ${nextScoreAway}!`
                  };
                }
              } else if (randVal >= 0.08 && randVal < 0.22) {
                // Player substitution incident (14%)
                const isHomeSub = Math.random() > 0.5;
                if (isHomeSub) {
                  const outPlayer = MEX_PLAYERS_OUT[Math.floor(Math.random() * MEX_PLAYERS_OUT.length)];
                  const inPlayer = MEX_PLAYERS_IN[Math.floor(Math.random() * MEX_PLAYERS_IN.length)];
                  newEvent = {
                    type: "SUB",
                    message: `🔁 Substitution (Mexico): ${outPlayer} OUT ➜ ${inPlayer} IN.`
                  };
                } else {
                  const outPlayer = RSA_PLAYERS_OUT[Math.floor(Math.random() * RSA_PLAYERS_OUT.length)];
                  const inPlayer = RSA_PLAYERS_IN[Math.floor(Math.random() * RSA_PLAYERS_IN.length)];
                  newEvent = {
                    type: "SUB",
                    message: `🔁 Substitution (South Africa): ${outPlayer} OUT ➜ ${inPlayer} IN.`
                  };
                }
              } else if (randVal >= 0.22 && randVal < 0.34) {
                // Referee Card incident (12%)
                const cardMsg = INCIDENT_CARDS[Math.floor(Math.random() * INCIDENT_CARDS.length)];
                newEvent = {
                  type: "CARD",
                  message: cardMsg
                };
              } else if (randVal >= 0.34 && randVal < 0.46) {
                // Close Chance/Gameplay events (12%)
                const chanceMsg = INCIDENT_CHANCES[Math.floor(Math.random() * INCIDENT_CHANCES.length)];
                newEvent = {
                  type: "CHANCE",
                  message: chanceMsg
                };
              }

              // Update the ticker state if an event occurred
              if (newEvent) {
                const evMinute = nextMin;
                const evType = (newEvent as any).type;
                const evMsg = (newEvent as any).message;
                setTickerEvents(prev => [
                  {
                    id: `e-live-${Date.now()}`,
                    minute: evMinute,
                    type: evType,
                    message: evMsg,
                    timestamp: new Date()
                  },
                  ...prev.slice(0, 19) // cache outstanding last 20 events only
                ]);
              }
            }

            return {
              ...match,
              minute: nextMin,
              status: nextStatus,
              homeScore: nextScoreHome,
              awayScore: nextScoreAway,
              scorers: nextScorers
            };
          }
          return match;
        });
      });
    }, 11000);

    return () => clearInterval(scoresInterval);
  }, []);

  // Dedicated effect to safely tracking and dispatching notifications from matching score updates
  const prevMatchesRef = useRef<FifaMatch[]>(matches);
  useEffect(() => {
    matches.forEach(match => {
      const prev = prevMatchesRef.current.find(m => m.id === match.id);
      if (prev) {
        const hasHomeGoal = match.homeScore !== undefined && prev.homeScore !== undefined && match.homeScore > prev.homeScore;
        const hasAwayGoal = match.awayScore !== undefined && prev.awayScore !== undefined && match.awayScore > prev.awayScore;
        
        if (hasHomeGoal || hasAwayGoal) {
          const scoringTeam = hasHomeGoal ? match.homeTeam : match.awayTeam;
          const scoringFlag = hasHomeGoal ? match.homeFlag : match.awayFlag;
          const isFavoriteTeam = favoriteTeams.includes(match.homeTeam) || favoriteTeams.includes(match.awayTeam);
          const isSubscribed = subscribedMatchIds.includes(match.id);
          
          let title = `⚽ GOAL SCORED! ${scoringFlag} ${scoringTeam}`;
          let body = `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}`;
          
          if (isFavoriteTeam) {
            title = `🔥 FAVORITE TEAM SCORED! ${scoringFlag} ${scoringTeam}`;
            body = `🎯 YES! Your favorite team scored! Current Score: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam} (${match.minute}')`;
          } else if (isSubscribed) {
            title = `🔔 GOAL ALERT! (Subscribed Match) ${scoringFlag} ${scoringTeam}`;
            body = `Current Score: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam} (${match.minute}')`;
          }

          dispatchNotification(title, body, true);
        }
      }
    });
    // Sync the reference
    prevMatchesRef.current = matches;
  }, [matches, favoriteTeams, subscribedMatchIds]);

  // Monitor upcoming matches countdown for kickoff & do automatic transitions
  useEffect(() => {
    matches.forEach(match => {
      if (match.status === "UPCOMING") {
        const matchTime = new Date(match.date).getTime();
        const nowTime = currentTime.getTime();
        
        // Auto kickoff if current simulated time passes or matches the fixture kickoff time
        if (nowTime >= matchTime && !kickoffNotifiedIds.includes(match.id)) {
          setKickoffNotifiedIds(prev => [...prev, match.id]);
          
          setMatches(prevMatches => prevMatches.map(m => {
            if (m.id === match.id) {
              return {
                ...m,
                status: "LIVE",
                homeScore: 0,
                awayScore: 0,
                minute: 1,
                scorers: ""
              };
            }
            return m;
          }));

          const isFavorite = favoriteTeams.includes(match.homeTeam) || favoriteTeams.includes(match.awayTeam);
          const title = isFavorite 
            ? `🦁 FAVORITE SQUAD KICKOFF! ${match.homeFlag} vs ${match.awayFlag}`
            : `🏟️ WORLD CUP FIXTURE STARTED! ${match.homeFlag} vs ${match.awayFlag}`;
          
          const body = `${match.homeTeam} vs ${match.awayTeam} kicks off now inside ${match.venue}! Follow real-time goals and metrics instantly.`;
          
          dispatchNotification(title, body, true);
        }
      }
    });
  }, [currentTime, matches, kickoffNotifiedIds, favoriteTeams]);

  // Handle Manual Simulator kickoff for immediate user demonstration
  const handleSimulateKickoff = (fixtureId: string) => {
    const targetMatch = matches.find(m => m.id === fixtureId);
    if (!targetMatch) return;

    const isFavorite = favoriteTeams.includes(targetMatch.homeTeam) || favoriteTeams.includes(targetMatch.awayTeam);
    const title = isFavorite
      ? `🦁 FAVORITE SQUAD KICKOFF! ${targetMatch.homeFlag} vs ${targetMatch.awayFlag}`
      : `🏟️ WORLD CUP FIXTURE STARTED! ${targetMatch.homeFlag} vs ${targetMatch.awayFlag}`;
    
    const body = `${targetMatch.homeTeam} vs ${targetMatch.awayTeam} kicks off now inside ${targetMatch.venue}! Follow real-time goals and metrics instantly. (Instant Simulator)`;

    dispatchNotification(title, body, true);

    setMatches(prev => prev.map(m => {
      if (m.id === fixtureId) {
        return {
          ...m,
          status: "LIVE",
          homeScore: 0,
          awayScore: 0,
          minute: 1,
          scorers: ""
        };
      }
      return m;
    }));

    // Insert kickoff events dynamically
    setTickerEvents(prev => [
      {
        id: `e-live-kickoff-${Date.now()}`,
        minute: 1,
        type: "KICKOFF",
        message: `🏟️ Match Kicked Off inside ${targetMatch.venue}! ${targetMatch.homeTeam} vs ${targetMatch.awayTeam} simulator started.`,
        timestamp: new Date()
      },
      ...prev.slice(0, 19)
    ]);
  };

  // Update clock simulation
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(prev => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Sync state notification
  const handleToggleSubscribe = (matchId: string, homeTeam: string, awayTeam: string) => {
    const isSubscribed = subscribedMatchIds.includes(matchId);
    let nextSubscribed: string[];
    if (isSubscribed) {
      nextSubscribed = subscribedMatchIds.filter(id => id !== matchId);
      onShowNotification(`🔔 Alerts disabled for ${homeTeam} vs ${awayTeam}.`);
    } else {
      nextSubscribed = [...subscribedMatchIds, matchId];
      onShowNotification(`🔔 Alerts enabled! We will notify you instantly when ${homeTeam} vs ${awayTeam} kicks off!`);
    }
    setSubscribedMatchIds(nextSubscribed);
  };

  // Find some sports channels to direct link when matches are live
  const sportsChannel = useMemo(() => {
    const list = channels.filter(c => c.category === "Sports");
    // Return channel 7 (index 6, "Sports arena") if available, otherwise fallback
    if (list.length >= 7) {
      return list[6];
    }
    return list[0] || null;
  }, [channels]);

  // Calculate generic countdown to next match
  const nextUpcomingMatch = useMemo(() => {
    const upcoming = matches.filter(m => m.status === "UPCOMING");
    if (upcoming.length === 0) return null;
    return upcoming[0];
  }, [matches]);

  // Compute countdown text helper
  const countdownString = useMemo(() => {
    if (!nextUpcomingMatch) return "No upcoming fixtures";
    const target = new Date(nextUpcomingMatch.date);
    const diffMs = target.getTime() - currentTime.getTime();
    if (diffMs <= 0) return "Match kicks off now!";

    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    return `${hours.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
  }, [nextUpcomingMatch, currentTime]);

  // Ads trigger
  const handleTriggerAd = () => {
    setIsAdOpen(true);
    setAdCountdown(5);
    const interval = setInterval(() => {
      setAdCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Confirm Ad complete
  useEffect(() => {
    if (isAdOpen && adCountdown === 0) {
      const timeout = setTimeout(() => {
        setIsAdOpen(false);
        setHasAdBonus(true);
        setAdViewCount(prev => prev + 1);
        onShowNotification("🚀 Premium Accelerator unlocked! Net latency was reduced to 0.4s for 60 minutes!");
      }, 805);
      return () => clearTimeout(timeout);
    }
  }, [isAdOpen, adCountdown, onShowNotification]);

  // Standings structure
  const groupStandings = [
    { rank: 1, team: "Mexico 🇲🇽", played: 1, won: 1, drawn: 0, lost: 0, points: 3, gd: "+1" },
    { rank: 2, team: "United States 🇺🇸", played: 0, won: 0, drawn: 0, lost: 0, points: 0, gd: "0" },
    { rank: 3, team: "Canada 🇨🇦", played: 0, won: 0, drawn: 0, lost: 0, points: 0, gd: "0" },
    { rank: 4, team: "South Africa 🇿🇦", played: 1, won: 0, drawn: 0, lost: 1, points: 0, gd: "-1" },
  ];

  return (
    <div className="space-y-6" id="fifa-world-cup-interactive-dashboard">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-slow {
          animation: marquee 32s linear infinite;
        }
        .animate-marquee-slow:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Dynamic TV-Style Live Incident Ticker Tape */}
      <div className="bg-zinc-950 border border-lime-500/20 rounded-2xl py-2.5 overflow-hidden relative shadow-md flex items-center" id="broadcast-ticker-banner">
        {/* Glow backdrop styling */}
        <div className="absolute inset-0 bg-gradient-to-r from-lime-500/5 to-transparent pointer-events-none" />
        
        {/* Glowing badge */}
        <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-lime-600 to-lime-500 text-zinc-950 font-black text-[10px] tracking-wider uppercase font-mono px-4 flex items-center gap-1.5 z-10 shadow-lg border-r border-lime-400/20 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-red-650 bg-red-600 animate-ping" />
          <Radio className="w-3.5 h-3.5" />
          <span>LIVE TICKER</span>
        </div>
        
        {/* Inside slider marquee wrapper */}
        <div className="flex whitespace-nowrap animate-marquee-slow items-center pl-[140px] gap-12 text-xs font-mono text-slate-350 cursor-pointer">
          {/* We repeat the array once or twice to make a seamless loop */}
          {[...tickerEvents, ...tickerEvents].map((evt, idx) => (
            <span key={`${evt.id}-${idx}`} className="inline-flex items-center gap-2.5 shrink-0">
              <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wide ${
                evt.type === 'GOAL' ? 'bg-lime-500 text-zinc-950 animate-bounce shadow shadow-lime-500/35' :
                evt.type === 'SUB' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                evt.type === 'CARD' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                evt.type === 'CHANCE' ? 'bg-rose-500/10 text-rose-350 border border-rose-500/25' :
                'bg-white/10 text-slate-350 border border-white/5'
              }`}>
                {evt.minute}' {evt.type}
              </span>
              <span className="font-bold text-slate-100">{evt.message}</span>
            </span>
          ))}
          {tickerEvents.length === 0 && (
            <span className="text-slate-500 uppercase tracking-widest text-[10px]">Synchronizing live incident telemetry streams...</span>
          )}
        </div>
      </div>
      
      {/* Immersive Promotional Header (Real-Time World Cup Countdown) */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0c1c04] via-zinc-950 to-black border border-lime-500/20 p-6 md:p-8 flex flex-col gap-6 shadow-2xl shadow-green-950/20" id="worldcup-main-showcase">
        {/* Lemon highlight glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-lime-500/5 blur-3xl rounded-full pointer-events-none z-0" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 w-full">
          <div className="flex items-center gap-5 relative z-10" id="worldcup-hero-meta">
            <div className="w-14 h-14 bg-lime-500/10 rounded-2xl border border-lime-500/25 flex items-center justify-center text-lime-400 shrink-0">
              <Trophy className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-lime-500 text-zinc-950 text-[9px] font-black rounded-md tracking-wider uppercase font-mono">FIFA 2026</span>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <Radio className="w-3 h-3 text-lime-400 animate-pulse" />
                  Live from North America (US, CA, MX)
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white mt-1 uppercase tracking-tight font-display">
                FIFA World Cup <span className="text-lime-400">2026</span> Arena
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Check match times, follow real-time live match scores, configure match-start push notifications, and enjoy full HD sports broadcasts instantly.
              </p>
            </div>
          </div>
  
          {/* Global Multi-Timer Countdown Banner */}
          <div className="bg-black/60 border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center max-w-[210px] w-full relative z-10 hover:border-lime-500/25 transition-all shadow-md shrink-0 mb-auto" id="global-countdown-widget">
            <span className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider block">COUNTDOWN TO NEXT MATCH</span>
            <span className="text-sm font-extrabold text-white mt-1.5 font-mono tabular-nums tracking-wide flex items-center gap-1.5 justify-center">
              <Clock className="w-3.5 h-3.5 text-lime-400 animate-spin" />
              {countdownString}
            </span>
            <div className="mt-2 text-[10px] text-lime-350 text-lime-400 font-bold bg-lime-550/10 px-2 py-0.5 rounded font-sans truncate w-full flex items-center justify-center gap-1">
              <span>Next Up:</span>
              <span className="truncate">{nextUpcomingMatch ? `${nextUpcomingMatch.homeTeam} vs ${nextUpcomingMatch.awayTeam}` : "Calculating..."}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Location Trace Banner */}
        <div className="bg-black/45 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-300 relative z-10 w-full" id="geolocated-region-ribbon">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-lime-500/10 border border-lime-500/25 flex items-center justify-center text-base select-none animate-pulse shrink-0">
              📍
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-wider block">AUTOMATIC GEOFENCE TIMING SYNCHRONIZATION</span>
              <span className="text-slate-200 text-xs">
                Your Traced Terminal context: <strong className="text-lime-400 font-extrabold">{detectedLocation.city}, {detectedLocation.country}</strong>
                <span className="text-slate-400 ml-2 font-mono text-[10.5px]">({detectedLocation.timezone})</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <span className="text-[10px] font-mono text-lime-400 font-bold bg-lime-550/10 px-2.5 py-1.5 rounded-xl border border-lime-500/20 flex items-center gap-1.5 select-none animate-pulse">
              <span>🌐</span> Localized Countdown Active
            </span>
          </div>
        </div>
      </div>

      {/* Immersive FIFA Alert Center & Followed Squads Configuration Console */}
      <div className="bg-zinc-950/80 border border-lime-500/20 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden" id="fifa-alerts-preference-console">
        <div className="absolute top-0 left-0 w-32 h-32 bg-lime-500/5 blur-2xl pointer-events-none rounded-full" />
        
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-stretch">
          {/* Left Panel: Web Standard Permissions & Statuses */}
          <div className="flex-1 space-y-4">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#a3e635] uppercase font-mono bg-lime-500/10 px-2.5 py-1 rounded border border-lime-500/15 inline-flex items-center gap-1.5 leading-none">
                <BellRing className="w-3.5 h-3.5 text-lime-400 animate-pulse" />
                FIFA Browser Notifications Console
              </span>
              <h2 className="text-base font-black text-white mt-2 uppercase tracking-tight font-sans">
                Secure Real-Time Match Alerts
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Receive instant browser push notifications the very moment your favorite teams kickoff, score, or finish standard tournament matches! Works anywhere in your browser window.
              </p>
            </div>

            <div className="bg-black/50 border border-white/5 rounded-xl p-3.5 space-y-2.5 border border-white/5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Standard Browser Permission Status:</span>
                <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] tracking-wide ${
                  notiPermission === "granted" ? "bg-lime-500/10 text-[#a3e635] border border-lime-500/20" :
                  notiPermission === "denied" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                  "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  {notiPermission === "granted" ? "● Allowed" :
                   notiPermission === "denied" ? "● Blocked" :
                   "● Click to Request"}
                </span>
              </div>

              {/* Actions deck */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
                <button
                  onClick={handleRequestPermission}
                  className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    notiPermission === "granted"
                      ? "bg-zinc-900 border-white/10 text-slate-500 cursor-not-allowed"
                      : "bg-[#a3e635] hover:bg-lime-400 border-[#a3e635] text-zinc-950 font-black shadow-lg shadow-lime-950/20"
                  }`}
                  disabled={notiPermission === "granted"}
                >
                  <Bell className="w-3.5 h-3.5 shrink-0" />
                  <span>{notiPermission === "granted" ? "Browser Alerts Active" : "Enable Browser Alerts"}</span>
                </button>

                <button
                  onClick={handleTriggerTestNotification}
                  className="py-2 px-3 rounded-lg font-bold bg-zinc-900 hover:bg-black border border-white/5 hover:border-[#a3e635]/30 text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Force a simulated push notification mockup to test compatibility"
                >
                  <span>⚡</span>
                  <span>Test Push Diagnostics</span>
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed font-sans mt-2">
              ℹ️ <strong>Sandboxed Preview Alert:</strong> By default, Google AI Studio's development preview runs inside a sandboxed frame that may block web push API requests. For standard native notifications, tap the <strong>"Open in New Tab"</strong> button in our navigation header to test browser notification alerts with zero runtime limits!
            </p>
          </div>

          {/* Vertical Divider for Desktop layout */}
          <div className="hidden lg:block w-px bg-white/5 self-stretch" />

          {/* Right Panel: Favorite Teams Pickers */}
          <div className="flex-1 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-slate-505 text-slate-400 uppercase font-mono flex items-center gap-1.5 align-middle">
                <Trophy className="w-3.5 h-3.5 text-lime-400" />
                Mark Followed Squads ({favoriteTeams.length} Active)
              </span>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Click country badges below to mark them as favorites. Setting a favorite squad guarantees direct goal alerts and kickoff push notifications instantly!
              </p>
            </div>

            {/* Participation flags deck grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2 pt-1.5">
              {[
                { name: "Mexico", flag: "🇲🇽" },
                { name: "United States", flag: "🇺🇸" },
                { name: "Canada", flag: "🇨🇦" },
                { name: "Argentina", flag: "🇦🇷" },
                { name: "Brazil", flag: "🇧🇷" },
                { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
                { name: "Spain", flag: "🇪🇸" },
                { name: "South Africa", flag: "🇿🇦" },
                { name: "Australia", flag: "🇦🇺" },
                { name: "Japan", flag: "🇯🇵" },
                { name: "Morocco", flag: "🇲🇦" },
                { name: "Saudi Arabia", flag: "🇸🇦" },
                { name: "Ghana", flag: "🇬🇭" },
                { name: "Sweden", flag: "🇸🇪" }
              ].map(team => {
                const isFavorite = favoriteTeams.includes(team.name);
                return (
                  <button
                    key={team.name}
                    onClick={() => handleToggleFavoriteTeam(team.name)}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all relative select-none cursor-pointer group hover:scale-[1.03] ${
                      isFavorite 
                        ? "bg-gradient-to-br from-lime-950/25 via-lime-900/5 to-transparent border-[#a3e635]/40 text-white shadow shadow-lime-950/20" 
                        : "bg-black/40 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10"
                    }`}
                    title={`Follow ${team.name} real-time matches`}
                  >
                    <span className="text-2xl filter drop-shadow group-hover:scale-110 transition-transform">{team.flag}</span>
                    <span className="text-[10px] font-bold font-mono tracking-tight mt-1 truncate max-w-full">{team.name}</span>
                    {isFavorite && (
                      <span className="absolute top-1 right-1 text-[8px] bg-lime-500 text-zinc-950 px-1 py-0.2 rounded font-black scale-90">
                        ❤️
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Sub-navigation tab menu */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5" id="world-cup-interior-navigation">
        <div className="flex items-center gap-2.5" id="worldcup-subtabs-control">
          <button
            onClick={() => setSubTab("living")}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase transition-all flex items-center gap-1.5 border ${
              subTab === "living"
                ? "bg-lime-500/10 border-lime-500/30 text-lime-400"
                : "bg-black/20 border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span>Live & Fixtures</span>
          </button>
          
          <button
            onClick={() => setSubTab("standings")}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase transition-all flex items-center gap-1.5 border ${
              subTab === "standings"
                ? "bg-lime-500/10 border-lime-500/30 text-lime-400"
                : "bg-black/20 border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-lime-400" />
            <span>Group A Standings</span>
          </button>
        </div>

        {/* Sponsor reward badges */}
        <div className="hidden sm:flex items-center gap-2">
          {hasAdBonus ? (
            <div className="flex items-center gap-1.5 bg-lime-500/15 border border-lime-400/35 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold text-lime-400 animate-pulse">
              <Zap className="w-3.5 h-3.5 fill-current text-lime-400 animate-spin" />
              <span>NET ACCELERATOR BOOSTED (0.4s latency)</span>
            </div>
          ) : (
            <button
              onClick={handleTriggerAd}
              className="px-3.5 py-1.5 bg-zinc-900 border border-white/10 hover:border-lime-500/30 hover:bg-black text-[10px] font-mono text-slate-350 text-slate-300 font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-102"
              title="Support us by loading a sponsor message to receive latency optimization boost!"
            >
              <Megaphone className="w-3.5 h-3.5 text-lime-400 animate-bounce" />
              <span>Support Stream & Boost Net Speed</span>
            </button>
          )}
        </div>
      </div>

      {subTab === "living" && (
        <div className="space-y-6" id="living-fixtures-grid-panel">
          
          {/* Active Live Score Item */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
                Live Matches
              </span>
              <span className="text-[9px] text-slate-400 font-mono">Scores update automatically</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.filter(m => m.status === "LIVE").map(match => (
                <div 
                  key={match.id}
                  className="bg-zinc-950/80 border border-lime-500/25 rounded-2xl p-5 shadow-xl relative overflow-hidden"
                  id={`match-live-card-${match.id}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/5 blur-2xl pointer-events-none rounded-full" />
                  
                  {/* Top bar info */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pb-3 border-b border-white/5">
                    <span>{match.group} • {match.venue}</span>
                    <span className="flex items-center gap-1.5 text-lime-400 font-black tracking-wider bg-lime-500/15 border border-lime-500/30 px-2 py-0.5 rounded uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-ping" />
                      {match.minute}' MIN
                    </span>
                  </div>

                  {/* Score row matches */}
                  <div className="flex items-center justify-between py-5 text-center px-2">
                    {/* Home team */}
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-3xl md:text-4xl filter drop-shadow select-none mb-1.5">{match.homeFlag}</span>
                      <span className="text-sm font-bold text-white tracking-tight">{match.homeTeam}</span>
                    </div>

                    {/* Numeric Score HUD */}
                    <div className="flex flex-col items-center justify-center shrink-0 px-4">
                      <div className="flex items-center gap-4 text-3xl font-black font-mono tracking-wider tabular-nums text-lime-400 bg-zinc-900 border border-white/5 py-2 px-5 rounded-2xl shadow-inner min-w-[124px] justify-center">
                        <span>{match.homeScore}</span>
                        <span className="text-slate-600 animate-pulse">:</span>
                        <span>{match.awayScore}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono tracking-widest mt-2 uppercase font-semibold">Group stage</span>
                    </div>

                    {/* Away team */}
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-3xl md:text-4xl filter drop-shadow select-none mb-1.5">{match.awayFlag}</span>
                      <span className="text-sm font-bold text-white tracking-tight">{match.awayTeam}</span>
                    </div>
                  </div>

                  {/* Goal Scorers list ticker */}
                  {match.scorers && (
                    <div className="bg-black/50 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-slate-300 font-mono text-center mb-4 leading-relaxed">
                      ⚽ <strong className="text-slate-400">Goals:</strong> {match.scorers}
                    </div>
                  )}

                  {/* Direct Broadcaster streaming connector button */}
                  <div className="flex gap-2">
                    {sportsChannel ? (
                      <button
                        onClick={() => {
                          onSelectChannel(sportsChannel);
                          onShowNotification(`📺 Selected ${sportsChannel.name} for World Cup Live broadcast!`);
                        }}
                        className="flex-1 py-2.5 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow shadow-lime-950/20 cursor-pointer"
                        id="live-broadcasting-action"
                      >
                        <Tv className="w-4 h-4" />
                        <span>Tune in Sports Channel 7 (Live Stream)</span>
                      </button>
                    ) : (
                      <div className="flex-1 py-2 bg-zinc-900 text-slate-400 text-xs font-mono text-center rounded-xl border border-white/5">
                        Broadcast Streams syncing...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Incoming Upcoming Fixtures with Custom notify subscriptions */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-lime-400" />
              Upcoming Tournament Schedule
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {matches.filter(m => m.status === "UPCOMING").map(fixture => {
                const isSubscribed = subscribedMatchIds.includes(fixture.id);
                // Human friendly times translation helper adjusted for the user's traced location
                const formattedLocalTime = (() => {
                  try {
                    return new Intl.DateTimeFormat(undefined, {
                      timeZone: detectedLocation.timezone,
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true
                    }).format(new Date(fixture.date));
                  } catch (e) {
                    return new Date(fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  }
                })();

                const formattedLocalDate = (() => {
                  try {
                    return new Intl.DateTimeFormat(undefined, {
                      timeZone: detectedLocation.timezone,
                      month: "short",
                      day: "numeric"
                    }).format(new Date(fixture.date));
                  } catch (e) {
                    return new Date(fixture.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  }
                })();
                
                return (
                  <div 
                    key={fixture.id} 
                    className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/10 transition-all shadow-md group relative overflow-hidden"
                    id={`upcoming-card-${fixture.id}`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-lime-500/2 blur-2xl pointer-events-none rounded-full" />
                    
                    {/* Header meta info */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pb-2 border-b border-white/5">
                      <span>{fixture.group}</span>
                      <span className="text-lime-400 font-bold flex items-center gap-1">
                        <span>🕒 {formattedLocalDate}, {formattedLocalTime}</span>
                        <span className="text-[9px] bg-lime-500/10 text-lime-400 px-1 py-0.5 rounded font-black">LOCAL</span>
                      </span>
                    </div>

                    {/* Team flags row */}
                    <div className="flex items-center justify-between py-4">
                      {/* Home */}
                      <div className="flex items-center gap-2 max-w-[45%]">
                        <span className="text-xl select-none filter drop-shadow">{fixture.homeFlag}</span>
                        <span className="text-xs font-semibold text-slate-200 truncate">{fixture.homeTeam}</span>
                      </div>

                      <span className="text-[10px] font-mono text-slate-600 font-semibold px-2 py-0.5 bg-white/5 rounded">VS</span>

                      {/* Away */}
                      <div className="flex items-center gap-2 max-w-[45%] justify-end flex-row-reverse text-right">
                        <span className="text-xl select-none filter drop-shadow">{fixture.awayFlag}</span>
                        <span className="text-xs font-semibold text-slate-200 truncate">{fixture.awayTeam}</span>
                      </div>
                    </div>

                    {/* Stadium location info */}
                    <p className="text-[10px] text-slate-400 font-mono text-center flex items-center justify-center gap-1 mb-3">
                      <span>📍</span> <span className="truncate">{fixture.venue}</span>
                    </p>

                    {/* Interactive "Notify Me" and simulation triggers */}
                    <div className="space-y-1.5">
                      <button
                        onClick={() => handleToggleSubscribe(fixture.id, fixture.homeTeam, fixture.awayTeam)}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wide flex items-center justify-center gap-1.5 border cursor-pointer transition-all ${
                          isSubscribed 
                            ? "bg-lime-500/15 border border-lime-500/45 text-lime-300 animate-pulse" 
                            : "bg-black/30 border border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                        }`}
                        id={`notify-bell-toggle-${fixture.id}`}
                      >
                        {isSubscribed ? <BellRing className="w-3.5 h-3.5 text-lime-400" /> : <Bell className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />}
                        <span>{isSubscribed ? "Notifications Active" : "Notify Match Start"}</span>
                      </button>

                      <button
                        onClick={() => handleSimulateKickoff(fixture.id)}
                        className="w-full py-1.5 rounded-xl text-[9px] font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1 bg-zinc-900 border border-white/5 text-lime-400 hover:text-lime-350 hover:bg-black transition-all cursor-pointer"
                        title="Force this upcoming match to kickoff immediately to test push notification alerts"
                        id={`simulate-kickoff-${fixture.id}`}
                      >
                        <span>⚡ Simulate Kickoff Now</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === "standings" && (
        <div className="bg-zinc-950/40 border border-white/5 p-5 rounded-2xl shadow-xl space-y-4" id="standings-table-panel">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-lime-400" />
              Group Stage Standings (Group A)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Real-time update live matches</span>
          </div>

          <div className="overflow-x-auto" id="standings-overflow-container">
            <table className="w-full text-xs text-left text-slate-300 font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-2">National Squad</th>
                  <th className="py-2.5 px-2 text-center">P</th>
                  <th className="py-2.5 px-2 text-center">W</th>
                  <th className="py-2.5 px-2 text-center">D</th>
                  <th className="py-2.5 px-2 text-center">L</th>
                  <th className="py-2.5 px-2 text-center">GD</th>
                  <th className="py-2.5 px-3 text-center text-lime-400 font-bold">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {groupStandings.map(row => (
                  <tr key={row.rank} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        row.rank <= 2 ? "bg-lime-500/15 text-lime-400 border border-lime-500/20" : "bg-white/5 text-slate-500"
                      }`}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-semibold text-slate-200">{row.team}</td>
                    <td className="py-3 px-2 text-center tabular-nums">{row.played}</td>
                    <td className="py-3 px-2 text-center tabular-nums">{row.won}</td>
                    <td className="py-3 px-2 text-center tabular-nums">{row.drawn}</td>
                    <td className="py-3 px-2 text-center tabular-nums">{row.lost}</td>
                    <td className="py-3 px-2 text-center tabular-nums text-slate-400">{row.gd}</td>
                    <td className="py-3 px-3 text-center tabular-nums text-lime-400 font-extrabold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-[10px] text-slate-500 leading-relaxed font-sans" id="standings-legality">
            💡 <strong className="text-slate-400">Rule Info:</strong> Top two squads from each of the twelve groups qualify immediately to the Round of 32 knockout bracket matches.
          </div>
        </div>
      )}

      {/* Direct Sponsors Integrated Interactive Ads Placement Panel */}
      <div id="premium-sponsor-ads-placement-board" className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/5 blur-2xl pointer-events-none rounded-full" />
        
        <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/10 group-hover:border-lime-500/25 transition-colors">
            <Megaphone className="w-6 h-6 text-lime-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className="text-[9px] font-bold text-slate-500 font-mono tracking-widest uppercase">SPONSOR BANNER PLACEMENT</span>
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-white mt-1 leading-none uppercase tracking-wide">
              Support Madrid<span className="text-lime-405 text-lime-400">tvlive</span> - Uncap Accelerator
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 max-w-lg">
              Watch a quick 5-second premium sponsor video ad to unlock our 0.4s Ultra-Low Latency Net Booster pipeline! Ads keep Madridtvlive online and completely free!
            </p>
          </div>
        </div>

        <div className="shrink-0 w-full md:w-auto" id="watch-ads-action-deck">
          <button
            onClick={handleTriggerAd}
            className="w-full md:w-auto px-6 py-3.5 bg-zinc-950 hover:bg-black text-white hover:text-lime-400 border border-white/10 hover:border-lime-500/40 rounded-xl font-bold font-mono text-xs cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            id="watch-sponsor-commercial-btn"
          >
            <Play className="w-4 h-4 fill-current text-lime-400" />
            <span>Watch Premium Sponsor Ad (5s)</span>
          </button>
        </div>
      </div>

      {/* Animated Immersive Modal Simulation for Video Commercials */}
      {isAdOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in" id="immersive-commercial-overlay">
          <div className="max-w-md w-full bg-zinc-950 border border-lime-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden" id="ad-box-wrapper">
            <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/10 blur-2xl pointer-events-none rounded-full" />
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10" id="ad-box-header">
              <span className="text-xs font-mono font-bold text-slate-500 tracking-wider">PREMIUM SPONSOR AD DECK</span>
              <span className="text-xs font-mono font-extrabold text-lime-400 bg-lime-500/10 border border-lime-500/25 px-2.5 py-0.5 rounded-full animate-pulse">
                Ad runs for {adCountdown}s
              </span>
            </div>

            <div className="py-8 text-center space-y-4" id="ad-box-body">
              {/* Fake video representation container */}
              <div className="relative aspect-video rounded-2xl bg-zinc-900 overflow-hidden border border-white/5 flex flex-col items-center justify-center gap-3 shadow-inner group">
                {/* Simulated video playback bars */}
                <div className="absolute inset-0 bg-gradient-to-tr from-lime-500/5 to-transparent animate-pulse" />
                
                <Trophy className="w-12 h-12 text-lime-400 animate-spin" />
                
                <span className="text-sm font-extrabold text-white font-sans uppercase tracking-wide">
                  Qatar Airways World Cup Premium
                </span>
                <span className="text-[10px] text-slate-500 font-mono max-w-xs">
                  "Fly premium with the official sponsor of FIFA World Cup 2026."
                </span>
                
                {/* Simulated video loading bar indicator */}
                <div className="absolute bottom-0 left-0 h-1.5 bg-lime-500 transition-all duration-1000" style={{ width: `${(5 - adCountdown) * 20}%` }} />
              </div>

              <div className="flex items-center gap-2 justify-center text-[11px] text-slate-450 text-slate-400 font-mono">
                <ShieldAlert className="w-4 h-4 text-lime-400" />
                <span>Closing of this browser video generates platform rewards</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                disabled={adCountdown > 0}
                onClick={() => setIsAdOpen(false)}
                className={`w-full py-3 rounded-xl font-bold font-mono text-xs text-center border transition-all ${
                  adCountdown > 0 
                    ? "bg-zinc-900 border-white/5 text-slate-600 cursor-not-allowed" 
                    : "bg-lime-500 border-lime-400 text-zinc-950 hover:bg-lime-400 cursor-pointer shadow-md"
                }`}
                id="skip-sponsor-ad"
              >
                {adCountdown > 0 ? `Unlocks in ${adCountdown}s` : "Skip Ad & Claim Reward"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
