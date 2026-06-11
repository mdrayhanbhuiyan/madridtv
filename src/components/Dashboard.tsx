import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { 
  Play, 
  Search, 
  Tv, 
  Star, 
  RefreshCw, 
  Flame, 
  History, 
  TrendingUp, 
  Heart,
  Grid,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Bell,
  BellRing,
  Clock,
  Sparkles,
  Trophy
} from "lucide-react";
import { Channel } from "../types";
import ChannelCard from "./ChannelCard";
import FifaHub from "./FifaHub";
import { Language, useTranslation } from "../utils/translations";

interface DashboardProps {
  channels: Channel[];
  favorites: string[];
  history: string[];
  currentCategory: string;
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onRefreshFeed: () => void;
  isRefreshing: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setCurrentCategory?: (category: string) => void;
  lang?: Language;
}

const COMING_SOON_MATCHES = [
  {
    id: "m-2",
    homeTeam: "United States",
    homeFlag: "🇺🇸",
    awayTeam: "Australia",
    awayFlag: "🇦🇺",
    date: "2026-06-11T19:30:00Z",
    group: "Group B",
    venue: "SoFi Stadium, Los Angeles",
    bgImage: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "m-3",
    homeTeam: "Canada",
    homeFlag: "🇨🇦",
    awayTeam: "Morocco",
    awayFlag: "🇲🇦",
    date: "2026-06-11T23:00:00Z",
    group: "Group C",
    venue: "BC Place, Vancouver",
    bgImage: "https://images.unsplash.com/photo-1431324155629-1a6edd1dee50?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "m-4",
    homeTeam: "Argentina",
    homeFlag: "🇦🇷",
    awayTeam: "Sweden",
    awayFlag: "🇸🇪",
    date: "2026-06-12T14:00:00Z",
    group: "Group D",
    venue: "MetLife Stadium, New Jersey",
    bgImage: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "m-5",
    homeTeam: "Brazil",
    homeFlag: "🇧🇷",
    awayTeam: "Japan",
    awayFlag: "🇯🇵",
    date: "2026-06-12T17:30:00Z",
    group: "Group E",
    venue: "Hard Rock Stadium, Miami",
    bgImage: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=600"
  }
];



export default function Dashboard({
  channels,
  favorites,
  history,
  currentCategory,
  selectedChannel,
  onSelectChannel,
  onToggleFavorite,
  onRefreshFeed,
  isRefreshing,
  searchQuery,
  setSearchQuery,
  setCurrentCategory,
  lang = "en"
}: DashboardProps) {
  const { t } = useTranslation(lang);
  const [showOnlyFeatured, setShowOnlyFeatured] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const getCategoryDisplayName = (catId: string) => {
    if (catId === "all") return t("allChannels");
    if (catId === "featured") return t("featuredChannels");
    if (catId === "fifa_2026") return t("fifaCup");
    if (catId === "favorites") return t("myFavorites");
    if (catId === "history") return t("watchHistory");

    if (catId === "Bangla") return t("Bangla");
    if (catId === "Sports") return t("Sports");
    if (catId === "News") return t("News");
    if (catId === "Movies") return t("Movies");
    if (catId === "Music") return t("Music");
    if (catId === "Kids") return t("Kids");
    if (catId === "Religious") return t("ReligiousLabel");
    if (catId === "Others") return t("OthersLabel");

    return catId;
  };

  const showNotification = useCallback((msg: string) => {
    // Safely defer parent state updates to protect against React layout rendering conflicts
    setTimeout(() => {
      setNotification(msg);
    }, 0);
    // Auto clear notification after 5 seconds
    setTimeout(() => {
      setNotification((current) => current === msg ? null : current);
    }, 5000);
  }, []);

  // 1. Featured Highlights Carousel hooks and states
  const sliderRef = useRef<HTMLDivElement>(null);
  const scrollFeatured = (direction: "left" | "right") => {
    if (sliderRef.current) {
      const amt = direction === "left" ? -380 : 380;
      sliderRef.current.scrollBy({ left: amt, behavior: "smooth" });
    }
  };

  const featuredChannels = useMemo(() => {
    const featured = channels.filter(c => c.isFeatured);
    if (featured.length > 0) return featured.slice(0, 10);
    // Fallback if no channels are explicitly flagged: pick some top priority channels
    return channels.slice(0, 8);
  }, [channels]);

  // 2. Coming Soon Matches timers & notifications
  const [now, setNow] = useState(new Date("2026-06-11T08:30:00Z")); // Preset to Simulated World Cup kickoff window
  const [subscribedMatchIds, setSubscribedMatchIds] = useState<string[]>([]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(prev => new Date(prev.getTime() + 60000));
    }, 30000); // simulated clock progression
    return () => clearInterval(timer);
  }, []);

  const handleToggleSubscribeMatch = (matchId: string, home: string, away: string) => {
    setSubscribedMatchIds(prev => {
      const active = prev.includes(matchId);
      if (active) {
        showNotification(`🔕 Alert disabled for ${home} vs ${away}.`);
        return prev.filter(id => id !== matchId);
      } else {
        showNotification(`🔔 Real-time match alert active! We'll push standard alarms and notifications as soon as ${home} vs ${away} starts.`);
        return [...prev, matchId];
      }
    });
  };

  const matchSliderRef = useRef<HTMLDivElement>(null);
  const scrollMatches = (direction: "left" | "right") => {
    if (matchSliderRef.current) {
      const amt = direction === "left" ? -340 : 340;
      matchSliderRef.current.scrollBy({ left: amt, behavior: "smooth" });
    }
  };

  // Group channels by current category selection and search query
  const filteredChannels = useMemo(() => {
    return channels.filter((channel) => {
      // 1. Category check
      if (currentCategory === "featured") {
        if (!channel.isFeatured) return false;
      } else if (currentCategory === "favorites") {
        if (!favorites.includes(channel.id)) return false;
      } else if (currentCategory === "history") {
        if (!history.includes(channel.id)) return false;
      } else if (currentCategory !== "all" && channel.category !== currentCategory) {
        return false;
      }

      // 2. Extra toggle featured check
      if (showOnlyFeatured && !channel.isFeatured) {
        return false;
      }

      // 3. Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          channel.name.toLowerCase().includes(q) ||
          channel.originalGroup.toLowerCase().includes(q) ||
          channel.category.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [channels, currentCategory, favorites, history, showOnlyFeatured, searchQuery]);

  // Determine a featured banner channel to highlight of the day
  const spotlightChannel = useMemo(() => {
    // Select the 7th channel of "Sports Arena" (category: "Sports")
    const sportsList = channels.filter(c => c.category === "Sports");
    if (sportsList.length >= 7) {
      return sportsList[6];
    } else if (sportsList.length > 0) {
      return sportsList[sportsList.length - 1];
    }
    
    // Fallback: Pick first featured channel or a standard BTV/Somoy TV channel
    const featuredList = channels.filter(c => c.isFeatured);
    if (featuredList.length > 0) return featuredList[0];
    
    const banglaList = channels.filter(c => c.category === "Bangla");
    if (banglaList.length > 0) return banglaList[0];
    
    return channels[0] || null;
  }, [channels]);

  // Resolve recently watched channel items
  const recentChannels = useMemo(() => {
    return history
      .map(id => channels.find(c => c.id === id))
      .filter((c): c is Channel => !!c)
      .slice(0, 5);
  }, [history, channels]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-8 font-sans" id="dashboard-root">
      
      {/* Search Header panel bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-black/40 p-5 rounded-2xl border border-white/5 backdrop-blur-2xl shadow-xl shadow-black/60 glow-hover-premium relative overflow-hidden" id="dashboard-search-bar-header">
        <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/5 blur-2xl pointer-events-none rounded-full" />
        <div className="relative flex-1" id="search-input-group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-lime-400/80" />
          <input
            type="text"
            placeholder={`Search from ${channels.length} channels... (e.g., "Somoy News", "Sports", "Bangla")`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950/60 border border-white/5 focus:border-lime-500/60 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-lime-500/40 transition-all font-sans"
            id="search-input-field"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0 relative z-10" id="filter-actions">
          {/* Quick toggle featured filter */}
          {currentCategory !== "featured" && (
            <button
              onClick={() => setShowOnlyFeatured(!showOnlyFeatured)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 uppercase tracking-wide ${
                showOnlyFeatured 
                  ? "bg-lime-500/25 border-lime-500/50 text-lime-300 font-bold glow-lemon/30" 
                  : "bg-black/40 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Star className={`w-3.5 h-3.5 text-lime-400 ${showOnlyFeatured ? "fill-current" : ""}`} />
              <span>{t("onlyFeatured")}</span>
            </button>
          )}

          {/* Refresh stream button */}
          <button
            onClick={onRefreshFeed}
            disabled={isRefreshing}
            className={`flex items-center gap-2 bg-black/40 hover:bg-white/5 border border-white/5 text-slate-300 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold select-none transition-all duration-200 uppercase tracking-wide ${
              isRefreshing ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Refresh stream list from GitHub"
            id="force-refresh-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-lime-500 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{t("refreshFeed")}</span>
          </button>
        </div>
      </div>

      {/* Floating notification alert */}
      {notification && (
        <div className="fixed bottom-6 left-6 z-[100] bg-zinc-950/95 border border-lime-500/40 text-slate-100 text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-slide-in font-sans leading-relaxed" style={{ maxWidth: "340px", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.8)" }}>
          <div className="w-6 h-6 rounded-full bg-lime-500/15 border border-lime-500/35 flex items-center justify-center text-lime-400 shrink-0 select-none animate-pulse">
            🔔
          </div>
          <span className="flex-1 text-[11px] font-medium leading-normal">{notification}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs font-bold leading-none px-1">✕</button>
        </div>
      )}

      {currentCategory === "fifa_2026" && !searchQuery.trim() ? (
        <FifaHub 
          channels={channels}
          onSelectChannel={onSelectChannel}
          onShowNotification={showNotification}
        />
      ) : (
        <>
          {/* 1. FEATURED HIGHLIGHTS (Horizontal scrolling with cinematic thumbnails) */}
          {!selectedChannel && currentCategory === "all" && !searchQuery.trim() && featuredChannels.length > 0 && (
            <div className="space-y-4" id="premium-highlights-carousel-block">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#a3e635] animate-pulse" />
                  <h2 className="text-xs font-black tracking-widest text-[#a3e635] uppercase font-mono bg-lime-500/10 px-2.5 py-1 rounded border border-lime-500/15">
                    {t("featuredHighlights")}
                  </h2>
                </div>
                
                {/* Scrolling navigation buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => scrollFeatured("left")}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-[#a3e635]/30 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollFeatured("right")}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-[#a3e635]/30 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Horizontal scroll container */}
              <div 
                ref={sliderRef}
                className="flex items-stretch gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth no-scrollbar"
                style={{ scrollbarWidth: "none" }}
              >
                {featuredChannels.map((chan) => (
                  <div
                    key={`highlight-${chan.id}`}
                    className="w-[240px] sm:w-[280px] shrink-0 snap-start"
                  >
                    <ChannelCard
                      channel={chan}
                      isActive={selectedChannel?.id === chan.id}
                      isFavorite={favorites.includes(chan.id)}
                      onSelect={() => onSelectChannel(chan)}
                      onToggleFavorite={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(chan.id);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. COMING SOON MATCHES CALENDAR SECTION */}
          {!selectedChannel && currentCategory === "all" && !searchQuery.trim() && (
            <div className="space-y-4" id="dashboard-upcoming-matches-block">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h2 className="text-xs font-black tracking-widest text-[#a3e635] uppercase font-mono bg-lime-500/10 px-2.5 py-1 rounded border border-lime-500/15">
                    {t("upcomingMatches")}
                  </h2>
                </div>
                
                <div className="flex items-center gap-2">
                  {setCurrentCategory && (
                    <button
                      onClick={() => setCurrentCategory("fifa_2026")}
                      className="text-[9.5px] sm:text-[10px] font-bold text-[#a3e635] bg-lime-500/10 hover:bg-lime-500/15 px-2.5 py-1.5 rounded-lg border border-lime-500/15 transition-all flex items-center gap-1 cursor-pointer font-mono"
                    >
                      {lang === "bn" ? "ম্যাচ সেন্টারে যান" : "ENTER MATCH CENTER"}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Scrolling navigation buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => scrollMatches("left")}
                      className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-[#a3e635]/30 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => scrollMatches("right")}
                      className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-[#a3e635]/30 hover:bg-black text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Horizontal Scroll Containers for matches */}
              <div 
                ref={matchSliderRef}
                className="flex items-stretch gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth no-scrollbar"
                style={{ scrollbarWidth: "none" }}
              >
                {COMING_SOON_MATCHES.map((match) => {
                  const matchTime = new Date(match.date).getTime();
                  const diff = matchTime - now.getTime();
                  const isSubscribed = subscribedMatchIds.includes(match.id);
                  
                  let countdownText = "Kickoff imminent";
                  if (diff > 0) {
                    const hours = Math.floor(diff / 3600000);
                    const minutes = Math.floor((diff % 3600000) / 60000);
                    countdownText = lang === "bn" ? `${hours} ঘণ্টা ${minutes} মিনিট বাকি` : `${hours}h ${minutes}m left`;
                  } else {
                    countdownText = lang === "bn" ? "খুব শীঘ্রই শুরু হবে" : "Kickoff imminent";
                  }

                  return (
                    <div
                      key={`coming-${match.id}`}
                      className="w-[280px] sm:w-[320px] shrink-0 relative rounded-2xl overflow-hidden bg-black/60 border border-white/5 hover:border-[#a3e635]/20 transition-all p-4 flex flex-col justify-between shadow-xl snap-start group"
                    >
                      {/* Sub-card decorative wallpaper overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-black/80 z-0" />
                      <img 
                        src={match.bgImage} 
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-15 grayscale transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Top Row: Meta information */}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-[9px] font-bold font-mono tracking-wide text-slate-400 bg-white/5 px-2 py-0.5 rounded uppercase border border-white/5">
                          {match.group}
                        </span>
                        
                        <span className="text-[10px] font-mono font-bold text-[#a3e635] bg-lime-500/10 px-2 py-0.5 rounded border border-lime-500/10 flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3 text-lime-400" />
                          <span>{countdownText}</span>
                        </span>
                      </div>

                      {/* Main Team Battle Cards Row */}
                      <div className="relative z-10 py-4 flex items-center justify-between select-none">
                        {/* Home team */}
                        <div className="flex flex-col items-center flex-1 max-w-[100px] text-center">
                          <span className="text-3xl filter shadow hover:scale-110 transition-transform">{match.homeFlag}</span>
                          <span className="text-[11px] font-black font-sans text-white mt-1.5 truncate max-w-full leading-tight">
                            {match.homeTeam}
                          </span>
                        </div>

                        {/* VS Indicator line */}
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black font-mono text-lime-400 px-2 py-1 rounded-full bg-lime-500/10 border border-lime-500/15">
                            VS
                          </span>
                        </div>

                        {/* Away team */}
                        <div className="flex flex-col items-center flex-1 max-w-[100px] text-center">
                          <span className="text-3xl filter shadow hover:scale-110 transition-transform">{match.awayFlag}</span>
                          <span className="text-[11px] font-black font-sans text-white mt-1.5 truncate max-w-full leading-tight">
                            {match.awayTeam}
                          </span>
                        </div>
                      </div>

                      {/* Lower actions deck */}
                      <div className="relative z-10 pt-3 border-t border-white/5 flex items-center justify-between gap-2.5">
                        <div className="truncate flex flex-col">
                          <span className="text-[8px] font-bold font-mono text-slate-500 uppercase tracking-widest block">{lang === "bn" ? "ভ্যানু" : "VENUE"}</span>
                          <span className="text-[10.5px] text-slate-300 truncate max-w-[125px] block font-sans font-medium">
                            {match.venue}
                          </span>
                        </div>

                        <button
                          onClick={() => handleToggleSubscribeMatch(match.id, match.homeTeam, match.awayTeam)}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-bold font-mono uppercase tracking-wide flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                            isSubscribed
                              ? "bg-lime-500/15 border-lime-500/35 text-lime-300 animate-pulse"
                              : "bg-zinc-900 border-white/5 text-slate-400 hover:text-white hover:bg-black"
                          }`}
                          title={isSubscribed ? "Matches Alarmed" : "Enable kickoff alerts"}
                        >
                          {isSubscribed ? <BellRing className="w-3 h-3 text-lime-400" /> : <Bell className="w-3 h-3 text-slate-400" />}
                          <span>{isSubscribed ? (lang === "bn" ? "অ্যালার্ট সক্রিয়" : "Notified") : (lang === "bn" ? "জানানো হোক" : "Notify Me")}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hero Welcome Banner Spotlight - only visible if NO channel is selected and we are on standard categories */}
          {!selectedChannel && spotlightChannel && currentCategory === "all" && !searchQuery && (
            <div 
              className="relative rounded-3xl overflow-hidden bg-black/98 border border-lime-500/20 min-h-[360px] p-6 md:p-10 flex flex-col justify-end shadow-2xl shadow-lime-950/10 group glow-lemon/20"
              id="spotlight-promotional-banner"
            >
              {/* Background image & Ambient Gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,12,0.95)] via-[rgba(10,10,12,0.7)] to-transparent z-10" />
              <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center opacity-30 grayscale-[0.25] transition-transform duration-700 group-hover:scale-105" />
              
              <div className="relative z-20 flex flex-col md:flex-row items-center gap-6 md:gap-10">
                {/* Visual poster card */}
                <div className="w-28 h-28 md:w-36 md:h-36 bg-black/80 p-3 border border-lime-500/20 rounded-2xl shrink-0 flex items-center justify-center glow-lemon/15 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-lime-500/5 to-transparent blur-xl pointer-events-none" />
                  {spotlightChannel.logo ? (
                    <img 
                      src={spotlightChannel.logo} 
                      alt={spotlightChannel.name}
                      referrerPolicy="no-referrer"
                      className="max-w-[85%] max-h-[85%] object-contain rounded-2xl relative z-10 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Tv className="w-10 h-10 text-lime-400 animate-pulse relative z-10" />
                  )}
                </div>

                {/* Descriptive body */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-red-650 text-[10px] font-black rounded tracking-widest uppercase text-white bg-red-600 font-mono shadow">Live</span>
                    <span className="text-[11px] font-mono tracking-wider text-lime-400 bg-lime-500/10 border border-lime-500/30 px-2.5 py-0.5 rounded-full uppercase font-bold">
                      Featured Broadcast
                    </span>
                  </div>
                  
                  <h1 className="text-3xl md:text-4xl font-extrabold font-display tracking-tight premium-text-gradient-lemon pb-1">
                    {spotlightChannel.name}
                  </h1>
                  
                  <p className="text-xs md:text-sm text-slate-300 mt-2 max-w-xl font-sans leading-relaxed">
                    Tune in to this highly-rated live broadcast stream. Sourced from group <span className="text-lime-400 font-mono font-medium">{spotlightChannel.originalGroup}</span>. Play live streams instantly inside our optimized video player.
                  </p>
                  
                  <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <button
                      onClick={() => onSelectChannel(spotlightChannel)}
                      className="px-8 py-3.5 bg-gradient-to-r from-lime-600 to-lime-500 hover:from-lime-500 hover:to-lime-400 text-zinc-950 font-extrabold rounded-xl flex items-center gap-3 hover:scale-105 transition-all text-xs select-none shadow-lg shadow-lime-600/25 border border-lime-400/20 cursor-pointer"
                      id="spotlight-watch-now-btn"
                    >
                      <Play className="w-3.5 h-3.5 fill-current text-zinc-950" />
                      Stream Now
                    </button>
                    <button
                      onClick={() => onToggleFavorite(spotlightChannel.id)}
                      className={`px-5 py-3.5 rounded-xl border font-bold text-xs select-none transition-all cursor-pointer ${
                        favorites.includes(spotlightChannel.id)
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                          : "bg-zinc-950/80 backdrop-blur-md text-white border border-white/10 hover:bg-zinc-900"
                      }`}
                      id="spotlight-favorite-btn"
                    >
                      {favorites.includes(spotlightChannel.id) ? "Favorited" : "Add Favorite"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recently Played Tray (Only visible if history features items and we are looking at standard screens) */}
          {!selectedChannel && recentChannels.length > 0 && currentCategory === "all" && !searchQuery && (
            <div id="recently-played-shelf" className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-lime-500 animate-pulse" />
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase font-mono">Resume Watching</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {recentChannels.map(rc => (
                  <div
                    key={`recent-${rc.id}`}
                    onClick={() => onSelectChannel(rc)}
                    className="flex items-center gap-3 bg-zinc-950/40 hover:bg-zinc-900/40 border border-white/5 rounded-xl p-2.5 cursor-pointer select-none transition-all group glow-hover-premium backdrop-blur-md"
                  >
                    <div className="w-10 h-10 bg-black/60 p-1 border border-white/5 rounded-lg shrink-0 flex items-center justify-center">
                      {rc.logo ? (
                        <img 
                          src={rc.logo} 
                          alt=""
                          referrerPolicy="no-referrer"
                          className="max-w-[85%] max-h-[85%] object-contain rounded-md"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Tv className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-lime-400 transition-colors truncate">
                        {rc.name}
                      </div>
                      <span className="text-[9px] text-slate-400 truncate block font-mono uppercase bg-white/5 px-1 py-0.2 rounded mt-0.5 text-center">
                        {rc.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Grid Channel Index Panel */}
          <div className="space-y-4" id="channels-main-grid-area">
            <div className="flex items-center justify-between border-b border-white/10 pb-3" id="grid-header">
              <div className="flex items-center gap-2.5">
                <Grid className="w-4.5 h-4.5 text-lime-500" />
                <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase font-mono">
                  {getCategoryDisplayName(currentCategory)}
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-mono font-medium">
                {lang === "bn" 
                  ? `ক্রাইটেরিয়া অনুযায়ী ${filteredChannels.length}টি চ্যানেল পাওয়া গেছে` 
                  : `Found ${filteredChannels.length} channels`
                }
              </span>
            </div>

            {/* Empty status message */}
            {filteredChannels.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl" id="grid-empty-container">
                <Tv className="w-10 h-10 text-slate-600 animate-bounce mb-3" />
                <p className="text-sm text-slate-400 font-semibold font-display">
                  {lang === "bn" ? "কোনো চ্যানেল পাওয়া যায়নি" : "No Channels Found"}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  {lang === "bn" 
                    ? `আপনার খোঁজা নামের কোনো চ্যানেল "${getCategoryDisplayName(currentCategory)}" ক্যাটাগরিতে খুঁজে পাওয়া যায়নি।` 
                    : `Could not match any channel listings in "${getCategoryDisplayName(currentCategory)}" matching that query.`
                  }
                </p>
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="mt-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    id="clear-search-btn"
                  >
                    {lang === "bn" ? "অনুসন্ধান মুছুন" : "Clear Search Query"}
                  </button>
                )}
              </div>
            )}

            {/* Bento grid container layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5" id="bento-channel-grid">
              {filteredChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isActive={selectedChannel?.id === channel.id}
                  isFavorite={favorites.includes(channel.id)}
                  onSelect={() => onSelectChannel(channel)}
                  onToggleFavorite={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(channel.id);
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
