import { useState, useEffect, useMemo } from "react";
import { 
  Tv, 
  Menu, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  Loader2, 
  RefreshCw,
  Info,
  Search,
  Globe,
  Users,
  Eye
} from "lucide-react";
import { Channel } from "./types";
import Sidebar from "./components/Sidebar";
import LivePlayer from "./components/LivePlayer";
import Dashboard from "./components/Dashboard";
import { fetchChannelsClientSide } from "./utils/playlistClient";
import { Language, useTranslation } from "./utils/translations";

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [currentCategory, setCurrentCategory] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [sidebarOpenOnMobile, setSidebarOpenOnMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMiniPlayerActive, setIsMiniPlayerActive] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [lang, setLang] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem("iptv-lang");
      if (stored === "en" || stored === "bn") return stored;

      // Fast instant detection based on Browser locale or Timezone (Dhaka)
      const isBnLocale = navigator.languages 
        ? navigator.languages.some(l => l.toLowerCase().includes('bn')) 
        : navigator.language?.toLowerCase().includes('bn');
      const isDhakaTz = Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase().includes('dhaka');

      if (isBnLocale || isDhakaTz) {
        return "bn";
      }
      return "en";
    } catch (e) {
      return "en";
    }
  });

  const [visitorCount, setVisitorCount] = useState<{ total: number; active: number }>({ total: 12450, active: 234 });

  // 1.5 Fetch and poll visitor statistics
  useEffect(() => {
    const fetchVisitors = async (increment = false) => {
      try {
        const res = await fetch(`/api/visitors${increment ? "?inc=true" : ""}`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.total === "number" && typeof data.active === "number") {
            setVisitorCount({ total: data.total, active: data.active });
          }
        }
      } catch (err) {
        console.warn("Failed to fetch visitor statistics:", err);
      }
    };

    // Increment visitors total count only once per browser session
    let alreadyVisited = false;
    try {
      alreadyVisited = !!sessionStorage.getItem("iptv-visited");
    } catch (e) {
      // ignore storage access issues
    }

    if (!alreadyVisited) {
      fetchVisitors(true);
      try {
        sessionStorage.setItem("iptv-visited", "true");
      } catch (e) {}
    } else {
      fetchVisitors(false);
    }

    // Periodic polling for active live viewers count every 20 seconds
    const interval = setInterval(() => {
      fetchVisitors(false);
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const { t } = useTranslation(lang);

  const handleToggleLang = (selected: Language) => {
    setLang(selected);
    try {
      localStorage.setItem("iptv-lang", selected);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to dynamically set the 7th channel of Sports category as featured
  const enhanceChannelsWithFeaturedSports = (channelsList: Channel[]): Channel[] => {
    if (!channelsList || channelsList.length === 0) return channelsList;
    const sportsList = channelsList.filter(c => c.category === "Sports");
    let sports7thId: string | null = null;
    if (sportsList.length >= 7) {
      sports7thId = sportsList[6].id;
    }
    return channelsList.map(c => {
      if (sports7thId && c.id === sports7thId) {
        return { ...c, isFeatured: true };
      }
      return c;
    });
  };

  // 1. Fetch channels from server-side api with modern client-side fallback support for static hosting (Vercel)
  const fetchChannels = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
        // Flush memory cache on back-end
        try {
          const resp = await fetch("/api/channels/refresh", { method: "POST" });
          if (!resp.ok) throw new Error("Server failed to refresh source links.");
        } catch (err) {
          console.warn("Backend refresh endpoint is unavailable, performing direct client-side fetch instead.");
          const clientChannels = await fetchChannelsClientSide(true);
          setChannels(enhanceChannelsWithFeaturedSports(clientChannels));
          return;
        }
      } else {
        setIsFetching(true);
      }
      setErrorMessage("");

      try {
        const resp = await fetch("/api/channels");
        if (resp.ok) {
          const resData = await resp.json();
          if (resData && resData.channels && Array.isArray(resData.channels)) {
            setChannels(enhanceChannelsWithFeaturedSports(resData.channels));
            return;
          }
        }
        throw new Error(`Platform failed to fetch playlists: status ${resp?.status || "Unknown"}`);
      } catch (srvError) {
        console.warn("Express backend API /api/channels is unavailable or returned error. Falling back to direct client-side extraction.", srvError);
        // Direct browser fallback to raw channels to ensure continuous play in Vercel, Netlify, or static server setups
        const clientChannels = await fetchChannelsClientSide(forceRefresh);
        setChannels(enhanceChannelsWithFeaturedSports(clientChannels));
      }
    } catch (e: any) {
      console.error("Critical: Both server-side API and client-side playlist extraction failed:", e);
      setErrorMessage(e.message || "Failed to establish connections with stream provider.");
    } finally {
      setIsFetching(false);
      setIsRefreshing(false);
    }
  };

  // 2. Load lists on mounting
  useEffect(() => {
    fetchChannels();

    // Recover favorites from localStorage
    try {
      const storedFavs = localStorage.getItem("iptv-favorites");
      if (storedFavs) {
        setFavorites(JSON.parse(storedFavs));
      }
    } catch (err) {
      console.error("Failed to parse stored favorites:", err);
    }

    // Recover history list
    try {
      const storedHistory = localStorage.getItem("iptv-history");
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (err) {
      console.error("Failed to parse stored watch history:", err);
    }

    // Detect location using IP Geolocation
    const detectLocationAndSetLang = async () => {
      try {
        const stored = localStorage.getItem("iptv-lang");
        if (stored) return; // Respect any existing manual selection
        
        const res = await fetch("https://ipapi.co/json/");
        if (res.ok) {
          const data = await res.json();
          if (data && (data.country_code === "BD" || data.country === "BD" || data.country_name?.toLowerCase() === "bangladesh")) {
            setLang("bn");
            localStorage.setItem("iptv-lang", "bn");
            return;
          }
        }
      } catch (err) {
        try {
          const fbRes = await fetch("https://freeipapi.com/api/json");
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            if (fbData && (fbData.countryCode === "BD" || fbData.countryName?.toLowerCase() === "bangladesh")) {
              setLang("bn");
              localStorage.setItem("iptv-lang", "bn");
            }
          }
        } catch (fadeErr) {
          console.warn("All location resolution fallbacks failed:", fadeErr);
        }
      }
    };
    detectLocationAndSetLang();
  }, []);

  // 2.5 Auto-deep-link support for shared channel parameters
  useEffect(() => {
    if (channels.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const urlChannelId = params.get("channelId") || params.get("channel");
      if (urlChannelId) {
        const matchingChannel = channels.find((c) => c.id === urlChannelId);
        if (matchingChannel) {
          setSelectedChannel(matchingChannel);
        }
      }
    }
  }, [channels]);

  // 2.6 Toggle theater mode off with Escape key and reset on clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsTheaterMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!selectedChannel) {
      setIsMiniPlayerActive(false);
      setIsTheaterMode(false);
    }
  }, [selectedChannel]);

  // 2.7 Scroll-triggered Picture-in-Picture: automatically float player when scrolling down
  useEffect(() => {
    if (!selectedChannel) {
      setIsMiniPlayerActive(false);
      return;
    }

    const handleScroll = () => {
      // If user scrolls past 350px, float the player at bottom-right automatically
      if (window.scrollY > 350) {
        setIsMiniPlayerActive(true);
      } else {
        setIsMiniPlayerActive(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [selectedChannel]);

  // 3. Keep favorites in sync with local storage
  const handleToggleFavorite = (channelId: string) => {
    const nextFavorites = favorites.includes(channelId)
      ? favorites.filter((id) => id !== channelId)
      : [...favorites, channelId];
    
    setFavorites(nextFavorites);
    localStorage.setItem("iptv-favorites", JSON.stringify(nextFavorites));
  };

  // 4. Update play history
  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    
    // Push unique items onwards
    const nextHistory = [channel.id, ...history.filter((id) => id !== channel.id)].slice(0, 25);
    setHistory(nextHistory);
    localStorage.setItem("iptv-history", JSON.stringify(nextHistory));
  };

  // 5. Navigate Channels within selected grid context (Prev / Next inside core player UI)
  const currentFilteredList = useMemo(() => {
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

      // 2. Search query check
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
  }, [channels, currentCategory, favorites, history, searchQuery]);

  const handlePrevChannel = () => {
    if (!selectedChannel || currentFilteredList.length <= 1) return;
    const currentIndex = currentFilteredList.findIndex((c) => c.id === selectedChannel.id);
    const nextIndex = currentIndex <= 0 ? currentFilteredList.length - 1 : currentIndex - 1;
    setSelectedChannel(currentFilteredList[nextIndex]);
  };

  const handleNextChannel = () => {
    if (!selectedChannel || currentFilteredList.length <= 1) return;
    const currentIndex = currentFilteredList.findIndex((c) => c.id === selectedChannel.id);
    const nextIndex = currentIndex >= currentFilteredList.length - 1 ? 0 : currentIndex + 1;
    setSelectedChannel(currentFilteredList[nextIndex]);
  };

  return (
    <div className="flex h-screen bg-[#050505] text-slate-100 overflow-hidden font-sans relative" id="iptv-player-container-root">
      
      {/* Atmosphere Ambient Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" id="ambient-immersive-backdrop">
        <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-lime-950/15 rounded-full blur-[110px] -mr-36 -mt-36" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-950/10 rounded-full blur-[100px] -ml-20 -mb-20" />
      </div>

      {/* Sidebar Component */}
      <div className="relative z-10 flex h-full w-full overflow-hidden" id="immersive-layout-content-wrap">
        <div className={`transition-all duration-500 flex h-full shrink-0 ${isTheaterMode && selectedChannel ? "opacity-0 blur-lg pointer-events-none overflow-hidden w-0 md:-mr-64" : ""}`}>
          <Sidebar
            currentCategory={currentCategory}
            setCurrentCategory={setCurrentCategory}
            channels={channels}
            favorites={favorites}
            history={history}
            isOpenOnMobile={sidebarOpenOnMobile}
            setIsOpenOnMobile={setSidebarOpenOnMobile}
            lang={lang}
          />
        </div>

        {/* Main Stream Platform Panel */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10" id="iptv-main-stream-view">
          
          {/* Global Header Bar */}
          <header className={`flex items-center justify-between gap-4 px-4 md:px-8 border-b border-white/10 z-20 shrink-0 transition-all duration-500 ${isTheaterMode && selectedChannel ? "opacity-10 py-1 blur-[2px] pointer-events-none" : "bg-black/40 backdrop-blur-xl py-3.5"}`} id="global-header-bar">
            <div className="flex items-center gap-3 md:gap-4">
              {/* Mobile menu trigger */}
              <button
                onClick={() => setSidebarOpenOnMobile(true)}
                className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 md:hidden transition-colors"
                id="mobile-menu-trigger"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              {/* App Identity */}
              <div className="flex items-center gap-2 mr-1 sm:mr-3">
                <div className="w-7 h-7 bg-lime-500 rounded flex items-center justify-center font-bold text-xs text-zinc-950 shadow-md shadow-lime-950/40 font-display">
                  M
                </div>
                <span className="font-bold text-sm md:text-base tracking-tight font-display text-white">
                  Madrid<span className="text-lime-400">tvlive</span>
                </span>
              </div>

              {/* Elegant Language Switcher UI Element (Positioned on Top Left) */}
              <div className="flex items-center bg-black/60 border border-white/10 rounded-xl p-0.5 shrink-0" id="header-language-switcher">
                <button
                  type="button"
                  onClick={() => handleToggleLang("en")}
                  className={`px-2 py-1 text-[10px] font-mono font-bold tracking-wide transition-all uppercase rounded-lg cursor-pointer ${
                    lang === "en"
                      ? "bg-lime-500/15 border border-lime-500/30 text-lime-400 shadow-sm"
                      : "border border-transparent text-slate-400 hover:text-white"
                  }`}
                  title="Switch to English"
                >
                  EN
                </button>
                <div className="w-px h-3 bg-white/10" />
                <button
                  type="button"
                  onClick={() => handleToggleLang("bn")}
                  className={`px-2 py-1 text-[10px] font-mono font-bold tracking-wide transition-all uppercase rounded-lg cursor-pointer ${
                    lang === "bn"
                      ? "bg-lime-500/15 border border-lime-500/30 text-lime-400 shadow-sm"
                      : "border border-transparent text-slate-400 hover:text-white"
                  }`}
                  title="বাংলায় পরিবর্তন করুন"
                >
                  বাংলা
                </button>
              </div>

              {/* Elegant Visitor and Live Viewers Widget */}
              <div className="flex items-center gap-1.5 shrink-0" id="header-visitor-widget">
                {/* Live Viewers Indicator */}
                <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1 text-[10px] font-mono font-bold rounded-xl shadow-sm uppercase tracking-wider">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                  </span>
                  <span>
                    {visitorCount.active < 1000 ? `${visitorCount.active}K+` : `${(visitorCount.active / 1000).toFixed(1)}M+`}
                    <span className="hidden md:inline ml-1 text-[9px] text-rose-400/80 font-bold font-sans">
                      {t("liveViewers")}
                    </span>
                  </span>
                </div>

                {/* Total Visitors Indicator */}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1 text-[10px] font-mono font-medium rounded-xl shadow-sm">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold">
                    {visitorCount.total < 1000 ? `${visitorCount.total}K+` : `${(visitorCount.total / 1000).toFixed(1)}K+`}
                    <span className="hidden md:inline ml-1 text-[9px] text-slate-500 font-medium font-sans">
                      {t("totalVisitors")}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Global Search Bar (Language Switcher removed from right) */}
            <div className="flex items-center gap-3" id="header-right-controls-container">
              <div className="relative flex-1 min-w-[120px] sm:min-w-[200px]" id="global-search-container">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 focus:border-lime-500/80 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50 transition-all font-sans"
                  id="global-search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors text-xs font-bold leading-none"
                    title="Clear search"
                    id="global-search-clear"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Subtle Now Playing Scrolling Ticker */}
          <div className={`border-b border-white/5 px-4 md:px-8 flex items-center gap-3 overflow-hidden text-xs shrink-0 select-none z-15 transition-all duration-500 ${isTheaterMode && selectedChannel ? "opacity-10 py-1 blur-[2px] pointer-events-none" : "bg-zinc-950/90 py-2.5"}`} id="now-playing-sub-ticker">
            <div className="flex items-center gap-1.5 shrink-0 bg-lime-500/15 border border-lime-500/30 text-lime-400 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-500 live-pulse" />
              {t("nowPlaying")}
            </div>
            
            <div className="relative flex-1 overflow-hidden" id="ticker-scroll-wrapper">
              <div className="animate-ticker-scroll inline-flex whitespace-nowrap gap-12 text-slate-400 font-mono text-[11px] cursor-help">
                {selectedChannel ? (
                  <>
                    <span className="inline-flex items-center gap-1">
                      {lang === "bn" ? "লাইভ সম্প্রচার:" : "Broadcasting Live:"} <strong className="text-white font-bold">{selectedChannel.name}</strong> 
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "ক্যাটাগরি:" : "Category:"} <span className="text-lime-400 font-extrabold uppercase text-[9.5px] px-1 bg-lime-500/10 border border-lime-500/20 rounded">{selectedChannel.category}</span>
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "উৎস:" : "Source:"} <span className="text-slate-300 font-semibold">{selectedChannel.originalGroup || "Global Stream"}</span>
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "ফরম্যাট:" : "Format:"} <span className="text-emerald-400 font-mono font-semibold">{lang === "bn" ? "লাইভ আইপিটিভি" : "Live IPTV (HLS Playback)"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {lang === "bn" ? "লাইভ সম্প্রচার:" : "Broadcasting Live:"} <strong className="text-white font-bold">{selectedChannel.name}</strong> 
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "ক্যাটাগরি:" : "Category:"} <span className="text-lime-400 font-extrabold uppercase text-[9.5px] px-1 bg-lime-500/10 border border-lime-500/20 rounded">{selectedChannel.category}</span>
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "উৎস:" : "Source:"} <span className="text-slate-300 font-semibold">{selectedChannel.originalGroup || "Global Stream"}</span>
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "ফরম্যাট:" : "Format:"} <span className="text-emerald-400 font-mono font-semibold">{lang === "bn" ? "লাইভ আইপিটিভি" : "Live IPTV (HLS Playback)"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {lang === "bn" ? "লাইভ সম্প্রচার:" : "Broadcasting Live:"} <strong className="text-white font-bold">{selectedChannel.name}</strong> 
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "ক্যাটাগরি:" : "Category:"} <span className="text-lime-400 font-extrabold uppercase text-[9.5px] px-1 bg-lime-500/10 border border-lime-500/20 rounded">{selectedChannel.category}</span>
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "উৎস:" : "Source:"} <span className="text-slate-300 font-semibold">{selectedChannel.originalGroup || "Global Stream"}</span>
                      <span className="text-zinc-700 mx-1">•</span> {lang === "bn" ? "ফরম্যাট:" : "Format:"} <span className="text-emerald-400 font-mono font-semibold">{lang === "bn" ? "লাইভ আইপিটিভি" : "Live IPTV (HLS Playback)"}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span>{t("welcomeTitle")} • {t("welcomeSubtitle")}</span>
                    <span>{t("welcomeTitle")} • {t("welcomeSubtitle")}</span>
                    <span>{t("welcomeTitle")} • {t("welcomeSubtitle")}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Inner Body rendering container status */}
          {isFetching ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" id="platform-fetching-loader">
              <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
              <span className="text-sm font-semibold font-display tracking-tight text-slate-300 mt-4 animate-pulse">
                {lang === "bn" ? "চ্যানেল তথ্য লোড হচ্ছে..." : "Buffering Channel Playlists..."}
              </span>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                {lang === "bn" 
                  ? "ক্যাটাগরিগুলো বিন্যাস করার জন্য সার্ভারের সাথে সংযোগ স্থাপন করা হচ্ছে। অনুগ্রহ করে একটু অপেক্ষা করুন।" 
                  : "Establishing server handshakes to compile categories from git index feeds. Thank you for your patience."
                }
              </p>
            </div>
          ) : errorMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" id="platform-error-prompt">
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 animate-bounce">
                <WifiOff className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold font-display text-white">
                {lang === "bn" ? "প্লেলিস্ট সংযোগ অফলাইন" : "Playlist Connection Offline"}
              </h2>
              <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                {errorMessage}. {lang === "bn" 
                  ? "গিটহাব রিপোজিটরির পাবলিক ফাইলগুলো সাময়িকভাবে এপিআই সীমাবদ্ধতার কারণে সংযোগহীন হতে পারে।" 
                  : "The public raw files inside the GitHub repository could be temporarily unreachable due to API bottlenecks."
                }
              </p>
              <button
                onClick={() => fetchChannels()}
                className="mt-6 flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-lg shadow-brand-900/40 transition-all duration-200"
                id="platform-retry-fetch-btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === "bn" ? "পুনরায় সংযোগ করুন" : "Retry Client Synchronization"}</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden" id="inner-active-platform-views">
              
              {/* If a channel is actively selected for live play */}
              {selectedChannel ? (
                <div 
                  className={`flex-1 flex flex-col overflow-y-auto transition-all duration-500 ${isTheaterMode ? "bg-[#030303]" : ""}`} 
                  id="split-active-player-and-dashboard"
                  onClick={() => {
                    if (isTheaterMode) {
                      setIsTheaterMode(false);
                    }
                  }}
                >
                  {/* Theater Mode Top Banner Hint */}
                  {isTheaterMode && (
                    <div 
                      className="w-full py-2 bg-black/60 border-b border-white/5 flex items-center justify-center gap-2 text-[11px] font-sans text-slate-400 select-none animate-fade-in pointer-events-none sticky top-0 z-30"
                      id="theater-mode-top-banner"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635] animate-pulse" />
                      <span>
                        {lang === "bn" 
                          ? "থিয়েটার মোড সক্রিয় • থিয়েটার মোড বন্ধ করতে প্লেয়ারের বাইরে যেকোনো জায়গায় ক্লিক করুন অথবা ESC চাপুন" 
                          : "Theater Mode Active • Click anywhere around the player or press ESC to exit"
                        }
                      </span>
                    </div>
                  )}

                  {/* Spaced active video panel container */}
                  <div 
                    className={`shrink-0 mx-auto w-full transition-all duration-500 ${
                      isTheaterMode 
                        ? "p-4 md:py-10 md:px-16 max-w-6xl relative z-50 scale-[1.02]" 
                        : "p-4 md:p-8 max-w-5xl relative z-10"
                    }`}
                    id="player-view-wrapper"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isMiniPlayerActive ? (
                      <div className="bg-gradient-to-br from-zinc-900/60 to-black/40 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden" id="pip-active-placeholder">
                        {/* Soft ambient lemon theme highlight */}
                        <div className="absolute top-0 right-0 w-[40%] h-[150%] bg-lime-500/5 blur-3xl -mr-10 -mt-10 rounded-full z-0 pointer-events-none" />
                        
                        <div className="flex items-center gap-4 relative z-10" id="pip-placeholder-meta">
                           <div className="w-12 h-12 bg-lime-500/10 rounded-2xl border border-lime-500/20 flex items-center justify-center text-lime-400 shrink-0">
                            <Tv className="w-6 h-6 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold font-display text-white">
                              {lang === "bn" ? "পিকচার-ইন-পিকচার সক্রিয় রয়েছে" : "Picture-in-Picture Active"}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-md font-sans leading-relaxed">
                              {lang === "bn" 
                                ? `"${selectedChannel.name}" এখন ভাঁসমান ভিডিও প্লেয়ারে চলছে। আপনি এখন নির্দ্বিধায় নিচের অন্যান্য ক্যাটাগরিগুলো ব্রাউজ ও অনুসন্ধান করতে পারেন!` 
                                : `"${selectedChannel.name}" is playing in a floating video overlay. Swipe, search, and browse categories below freely!`
                              }
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setIsMiniPlayerActive(false)}
                          className="px-5 py-2.5 bg-lime-550 bg-lime-600 hover:bg-lime-500 text-zinc-950 font-extrabold rounded-xl text-xs hover:scale-102 hover:shadow-lime-500/15 transition-all shadow-lg shadow-lime-950/20 relative z-10 shrink-0"
                          id="pip-restore-btn"
                        >
                          {lang === "bn" ? "প্লেয়ার রিস্টোর করুন" : "Restore Player Inline"}
                        </button>
                      </div>
                    ) : (
                      <LivePlayer
                        channel={selectedChannel}
                        isFavorite={favorites.includes(selectedChannel.id)}
                        onToggleFavorite={() => handleToggleFavorite(selectedChannel.id)}
                        onPrevChannel={currentFilteredList.length > 1 ? handlePrevChannel : undefined}
                        onNextChannel={currentFilteredList.length > 1 ? handleNextChannel : undefined}
                        isMini={false}
                        onToggleMini={() => setIsMiniPlayerActive(true)}
                        isTheaterMode={isTheaterMode}
                        onToggleTheater={() => setIsTheaterMode(!isTheaterMode)}
                        historyIds={history}
                        channels={channels}
                        onSelectChannel={handleSelectChannel}
                        lang={lang}
                      />
                    )}
                  </div>

                  {/* Sub-directories listing below to encourage seamless surf flipping */}
                  <div className={`border-t border-white/10 bg-black/40 pb-10 transition-all duration-500 ${isTheaterMode ? "opacity-[0.02] filter blur-[4px] pointer-events-none max-h-0 overflow-hidden" : ""}`} id="sub-listing-bottom-shelf">
                    <Dashboard
                      channels={channels}
                      favorites={favorites}
                      history={history}
                      currentCategory={currentCategory}
                      selectedChannel={selectedChannel}
                      onSelectChannel={handleSelectChannel}
                      onToggleFavorite={handleToggleFavorite}
                      onRefreshFeed={() => fetchChannels(true)}
                      isRefreshing={isRefreshing}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      setCurrentCategory={setCurrentCategory}
                      lang={lang}
                    />
                  </div>
                </div>
              ) : (
                /* Standard Dashboard Home screens */
                <Dashboard
                  channels={channels}
                  favorites={favorites}
                  history={history}
                  currentCategory={currentCategory}
                  selectedChannel={null}
                  onSelectChannel={handleSelectChannel}
                  onToggleFavorite={handleToggleFavorite}
                  onRefreshFeed={() => fetchChannels(true)}
                  isRefreshing={isRefreshing}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  setCurrentCategory={setCurrentCategory}
                  lang={lang}
                />
              )}

              {/* Draggable/Fixed Floating Mini-Player Container with high-end dropshadow */}
              {isMiniPlayerActive && selectedChannel && (
                <div 
                  className="fixed bottom-6 right-6 w-72 sm:w-[360px] md:w-[420px] aspect-video z-50 shadow-2xl rounded-2xl border border-white/15 bg-zinc-950 overflow-hidden transition-all animate-slide-in duration-300"
                  id="floating-mini-player-dock"
                  style={{
                    boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.95)"
                  }}
                >
                  <LivePlayer
                    channel={selectedChannel}
                    isFavorite={favorites.includes(selectedChannel.id)}
                    onToggleFavorite={() => handleToggleFavorite(selectedChannel.id)}
                    onPrevChannel={currentFilteredList.length > 1 ? handlePrevChannel : undefined}
                    onNextChannel={currentFilteredList.length > 1 ? handleNextChannel : undefined}
                    isMini={true}
                    onToggleMini={() => setIsMiniPlayerActive(false)}
                    historyIds={history}
                    channels={channels}
                    onSelectChannel={handleSelectChannel}
                    lang={lang}
                  />
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
