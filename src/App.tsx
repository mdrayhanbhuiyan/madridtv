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
  Search
} from "lucide-react";
import { Channel } from "./types";
import Sidebar from "./components/Sidebar";
import LivePlayer from "./components/LivePlayer";
import Dashboard from "./components/Dashboard";
import { fetchChannelsClientSide } from "./utils/playlistClient";

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
          setChannels(clientChannels);
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
            setChannels(resData.channels);
            return;
          }
        }
        throw new Error(`Platform failed to fetch playlists: status ${resp?.status || "Unknown"}`);
      } catch (srvError) {
        console.warn("Express backend API /api/channels is unavailable or returned error. Falling back to direct client-side extraction.", srvError);
        // Direct browser fallback to raw channels to ensure continuous play in Vercel, Netlify, or static server setups
        const clientChannels = await fetchChannelsClientSide(forceRefresh);
        setChannels(clientChannels);
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
  }, []);

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
        <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-orange-950/20 rounded-full blur-[110px] -mr-36 -mt-36" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-950/10 rounded-full blur-[100px] -ml-20 -mb-20" />
      </div>

      {/* Sidebar Component */}
      <div className="relative z-10 flex h-full w-full overflow-hidden" id="immersive-layout-content-wrap">
        <Sidebar
          currentCategory={currentCategory}
          setCurrentCategory={setCurrentCategory}
          channels={channels}
          favorites={favorites}
          history={history}
          isOpenOnMobile={sidebarOpenOnMobile}
          setIsOpenOnMobile={setSidebarOpenOnMobile}
        />

        {/* Main Stream Platform Panel */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10" id="iptv-main-stream-view">
          
          {/* Global Header Bar */}
          <header className="flex items-center justify-between gap-4 px-4 md:px-8 py-3.5 bg-black/40 backdrop-blur-xl border-b border-white/10 z-20 shrink-0" id="global-header-bar">
            <div className="flex items-center gap-3">
              {/* Mobile menu trigger */}
              <button
                onClick={() => setSidebarOpenOnMobile(true)}
                className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 md:hidden transition-colors"
                id="mobile-menu-trigger"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              {/* App Identity */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-orange-600 rounded flex items-center justify-center font-bold text-xs text-white shadow-md shadow-orange-950/40 font-display">
                  M
                </div>
                <span className="font-bold text-sm md:text-base tracking-tight font-display text-white">
                  Madrid<span className="text-orange-500">tvlive</span>
                </span>
              </div>
            </div>

            {/* Global Search Bar */}
            <div className="relative flex-1 max-w-[160px] sm:max-w-xs md:max-w-sm" id="global-search-container">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/50 border border-white/10 focus:border-orange-500/80 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all font-sans"
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
          </header>

          {/* Subtle Now Playing Scrolling Ticker */}
          <div className="bg-zinc-950/90 border-b border-white/5 py-2.5 px-4 md:px-8 flex items-center gap-3 overflow-hidden text-xs shrink-0 select-none z-15" id="now-playing-sub-ticker">
            <div className="flex items-center gap-1.5 shrink-0 bg-orange-500/15 border border-orange-500/30 text-orange-400 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 live-pulse" />
              Now Playing
            </div>
            
            <div className="relative flex-1 overflow-hidden" id="ticker-scroll-wrapper">
              <div className="animate-ticker-scroll inline-flex whitespace-nowrap gap-12 text-slate-400 font-mono text-[11px] cursor-help">
                {selectedChannel ? (
                  <>
                    <span className="inline-flex items-center gap-1">
                      Broadcasting Live: <strong className="text-white font-bold">{selectedChannel.name}</strong> 
                      <span className="text-zinc-700 mx-1">•</span> Category: <span className="text-orange-400 font-extrabold uppercase text-[9.5px] px-1 bg-orange-500/10 border border-orange-500/20 rounded">{selectedChannel.category}</span>
                      <span className="text-zinc-700 mx-1">•</span> Source: <span className="text-slate-300 font-semibold">{selectedChannel.originalGroup || "Global Stream"}</span>
                      <span className="text-zinc-700 mx-1">•</span> Format: <span className="text-emerald-400 font-mono font-semibold">Live IPTV (HLS Playback)</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      Broadcasting Live: <strong className="text-white font-bold">{selectedChannel.name}</strong> 
                      <span className="text-zinc-700 mx-1">•</span> Category: <span className="text-orange-400 font-extrabold uppercase text-[9.5px] px-1 bg-orange-500/10 border border-orange-500/20 rounded">{selectedChannel.category}</span>
                      <span className="text-zinc-700 mx-1">•</span> Source: <span className="text-slate-300 font-semibold">{selectedChannel.originalGroup || "Global Stream"}</span>
                      <span className="text-zinc-700 mx-1">•</span> Format: <span className="text-emerald-400 font-mono font-semibold">Live IPTV (HLS Playback)</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      Broadcasting Live: <strong className="text-white font-bold">{selectedChannel.name}</strong> 
                      <span className="text-zinc-700 mx-1">•</span> Category: <span className="text-orange-400 font-extrabold uppercase text-[9.5px] px-1 bg-orange-500/10 border border-orange-500/20 rounded">{selectedChannel.category}</span>
                      <span className="text-zinc-700 mx-1">•</span> Source: <span className="text-slate-300 font-semibold">{selectedChannel.originalGroup || "Global Stream"}</span>
                      <span className="text-zinc-700 mx-1">•</span> Format: <span className="text-emerald-400 font-mono font-semibold">Live IPTV (HLS Playback)</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span>Welcome to Madridtvlive Premium • Select any channel below to immediately trigger seamless live stream feeds</span>
                    <span>Welcome to Madridtvlive Premium • Select any channel below to immediately trigger seamless live stream feeds</span>
                    <span>Welcome to Madridtvlive Premium • Select any channel below to immediately trigger seamless live stream feeds</span>
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
                Buffering Channel Playlists...
              </span>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                Establishing server handshakes to compile categories from git index feeds. Thank you for your patience.
              </p>
            </div>
          ) : errorMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" id="platform-error-prompt">
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 animate-bounce">
                <WifiOff className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold font-display text-white">Playlist Connection Offline</h2>
              <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                {errorMessage}. The public raw files inside the GitHub repository could be temporarily unreachable due to API bottlenecks.
              </p>
              <button
                onClick={() => fetchChannels()}
                className="mt-6 flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-lg shadow-brand-900/40 transition-all duration-200"
                id="platform-retry-fetch-btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Client Synchronization</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden" id="inner-active-platform-views">
              
              {/* If a channel is actively selected for live play */}
              {selectedChannel ? (
                <div className="flex-1 flex flex-col overflow-y-auto" id="split-active-player-and-dashboard">
                   {/* Spaced active video panel container */}
                  <div className="p-4 md:p-8 shrink-0 max-w-5xl mx-auto w-full" id="player-view-wrapper">
                    {isMiniPlayerActive ? (
                      <div className="bg-gradient-to-br from-zinc-900/60 to-black/40 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden" id="pip-active-placeholder">
                        {/* Soft ambient orange theme highlight */}
                        <div className="absolute top-0 right-0 w-[40%] h-[150%] bg-orange-500/5 blur-3xl -mr-10 -mt-10 rounded-full z-0 pointer-events-none" />
                        
                        <div className="flex items-center gap-4 relative z-10" id="pip-placeholder-meta">
                          <div className="w-12 h-12 bg-orange-500/10 rounded-2xl border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                            <Tv className="w-6 h-6 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold font-display text-white">Picture-in-Picture Active</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-md font-sans leading-relaxed">
                              "{selectedChannel.name}" is playing in a floating video overlay. Swipe, search, and browse categories below freely!
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setIsMiniPlayerActive(false)}
                          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl text-xs hover:scale-102 hover:shadow-orange-500/15 transition-all shadow-lg shadow-orange-950/20 relative z-10 shrink-0"
                          id="pip-restore-btn"
                        >
                          Restore Player Inline
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
                      />
                    )}
                  </div>

                  {/* Sub-directories listing below to encourage seamless surf flipping */}
                  <div className="border-t border-white/10 bg-black/40 pb-10" id="sub-listing-bottom-shelf">
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
