import { useState, useEffect, useMemo } from "react";
import { 
  Tv, 
  Menu, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  Loader2, 
  RefreshCw,
  Info
} from "lucide-react";
import { Channel } from "./types";
import Sidebar from "./components/Sidebar";
import LivePlayer from "./components/LivePlayer";
import Dashboard from "./components/Dashboard";

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

  // 1. Fetch channels from server-side api
  const fetchChannels = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
        // Flush memory cache on back-end
        const resp = await fetch("/api/channels/refresh", { method: "POST" });
        if (!resp.ok) throw new Error("Server failed to refresh source links.");
      } else {
        setIsFetching(true);
      }
      setErrorMessage("");

      const resp = await fetch("/api/channels");
      if (!resp.ok) {
        throw new Error(`Platform failed to fetch playlists: status ${resp.status}`);
      }
      
      const resData = await resp.json();
      if (resData && resData.channels && Array.isArray(resData.channels)) {
        setChannels(resData.channels);
      } else {
        throw new Error("Invalid playlist channels payload format.");
      }
    } catch (e: any) {
      console.error(e);
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
      if (currentCategory === "featured") return channel.isFeatured;
      if (currentCategory === "favorites") return favorites.includes(channel.id);
      if (currentCategory === "history") return history.includes(channel.id);
      if (currentCategory !== "all" && channel.category !== currentCategory) return false;
      return true;
    });
  }, [channels, currentCategory, favorites, history]);

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
          
          {/* Mobile Header bar */}
          <header className="flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-xl border-b border-white/10 md:hidden z-10" id="mobile-top-bar">
            <button
              onClick={() => setSidebarOpenOnMobile(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              id="mobile-menu-trigger"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-orange-600 rounded flex items-center justify-center font-bold text-xs text-white shadow-md shadow-orange-950/40 font-display">
                M
              </div>
              <span className="font-bold text-sm tracking-tight font-display text-white">Madrid<span className="text-orange-500">tvlive</span></span>
            </div>

            <div className="w-5" /> {/* Balance spacer */}
          </header>

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
                    <LivePlayer
                      channel={selectedChannel}
                      isFavorite={favorites.includes(selectedChannel.id)}
                      onToggleFavorite={() => handleToggleFavorite(selectedChannel.id)}
                      onPrevChannel={currentFilteredList.length > 1 ? handlePrevChannel : undefined}
                      onNextChannel={currentFilteredList.length > 1 ? handleNextChannel : undefined}
                    />
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
                />
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
