import React, { useState, useMemo } from "react";
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
  Grid
} from "lucide-react";
import { Channel } from "../types";
import ChannelCard from "./ChannelCard";

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
}

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
  setSearchQuery
}: DashboardProps) {
  const [showOnlyFeatured, setShowOnlyFeatured] = useState(false);

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
    // Pick first featured channel or a standard BTV/Somoy TV channel
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
              <span>Only Featured</span>
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
            <span>Update List</span>
          </button>
        </div>
      </div>

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
              {currentCategory === "all" ? "Channel Directory" : `${currentCategory} Selection`}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono font-medium">
            Found {filteredChannels.length} channels
          </span>
        </div>

        {/* Empty status message */}
        {filteredChannels.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl" id="grid-empty-container">
            <Tv className="w-10 h-10 text-slate-600 animate-bounce mb-3" />
            <p className="text-sm text-slate-400 font-semibold font-display">No Channels Found</p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Could not match any channel listings in <span className="font-mono text-slate-400 font-semibold uppercase">"{currentCategory}"</span> matching that query.
            </p>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="mt-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                id="clear-search-btn"
              >
                Clear Search Query
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

    </div>
  );
}
