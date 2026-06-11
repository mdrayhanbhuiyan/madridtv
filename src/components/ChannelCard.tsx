import React, { useState } from "react";
import { Play, Heart, Star, Tv } from "lucide-react";
import { Channel } from "../types";

export function getCategoryBadgeStyles(category: string): string {
  const cat = (category || "").trim().toLowerCase();
  switch (cat) {
    case "bangla":
      return "bg-cyan-500/10 border-cyan-500/20 text-cyan-400";
    case "sports":
      return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    case "news":
      return "bg-red-500/10 border-red-500/20 text-red-400";
    case "entertainment":
      return "bg-purple-500/10 border-purple-500/20 text-purple-400";
    case "movies":
      return "bg-amber-500/10 border-amber-500/20 text-amber-400";
    case "music":
      return "bg-pink-500/10 border-pink-500/20 text-pink-400";
    case "kids":
      return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
    case "religious":
      return "bg-teal-500/10 border-teal-500/20 text-teal-400";
    default:
      return "bg-white/5 border-white/5 text-slate-400";
  }
}

export function getCategoryGradient(category: string): string {
  const cat = (category || "").trim().toLowerCase();
  switch (cat) {
    case "bangla":
      return "from-cyan-950 via-zinc-900 to-zinc-950";
    case "sports":
      return "from-emerald-950 via-zinc-900 to-zinc-950";
    case "news":
      return "from-rose-955 via-zinc-900 to-zinc-950";
    case "entertainment":
      return "from-purple-950 via-zinc-900 to-zinc-950";
    case "movies":
      return "from-amber-950 via-zinc-900 to-zinc-950";
    case "music":
      return "from-pink-950 via-zinc-900 to-zinc-950";
    case "kids":
      return "from-yellow-950 via-zinc-900 to-zinc-950";
    case "religious":
      return "from-teal-950 via-zinc-900 to-zinc-950";
    default:
      return "from-zinc-800 via-zinc-900 to-zinc-950";
  }
}

interface ChannelCardProps {
  channel: Channel;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: any) => void;
}

export default function ChannelCard({
  channel,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite
}: ChannelCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  // Generate a random pleasant pastel color background for logo fallbacks
  const getFallbackBgClass = (name: string) => {
    const chars = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
    const bgs = [
      "from-rose-500/20 to-red-500/20 text-rose-300 border-rose-500/30",
      "from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30",
      "from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30",
      "from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30",
      "from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-500/30",
      "from-fuchsia-500/20 to-pink-500/20 text-fuchsia-300 border-fuchsia-500/30"
    ];
    return bgs[chars % bgs.length];
  };

  const initial = channel.name.slice(0, 2).toUpperCase();
  const isLogoValid = !imageFailed && channel.logo;
  const gradientClass = getCategoryGradient(channel.category);

  return (
    <div 
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-1.5 border backdrop-blur-xl ${
        isActive 
          ? "bg-zinc-950/80 glow-active-premium border-orange-500" 
          : "bg-zinc-950/40 border-white/5 hover:bg-zinc-900/40 glow-hover-premium hover:border-orange-500/20"
      }`}
      id={`channel-card-${channel.id}`}
    >
      {/* Featured Accent Corner Tag */}
      {channel.isFeatured && (
        <div className="absolute top-3 left-3 z-20 bg-orange-600/90 text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1 font-mono shadow-md backdrop-blur-lg border border-orange-400/25">
          <Star className="w-2.5 h-2.5 fill-current animate-pulse text-amber-300" />
          <span>Featured</span>
        </div>
      )}

      {/* 16:9 Thumbnail Preview Container */}
      <div className={`relative w-full aspect-video flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradientClass} border-b border-white/5`}>
        {/* Ambient Glow Backdrop (Blurred Logo) */}
        {isLogoValid ? (
          <img 
            src={channel.logo}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-125 select-none transition-transform duration-700 group-hover:scale-150"
          />
        ) : (
          <div className="absolute inset-0 bg-radial-gradient from-white/5 to-transparent opacity-60" />
        )}

        {/* Outer overlay visual depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/10 to-transparent z-10" />

        {/* Channel Logo or Centered Graphic */}
        <div className="relative z-10 px-4 py-2 flex items-center justify-center w-full h-full max-h-[70%]">
          {isLogoValid ? (
            <img 
              src={channel.logo}
              alt={channel.name}
              referrerPolicy="no-referrer"
              className="max-w-[70%] max-h-16 object-contain rounded-lg filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] transform transition-transform duration-500 group-hover:scale-110"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br font-extrabold text-sm font-display tracking-wider border shadow-lg ${getFallbackBgClass(channel.name)}`}>
              {initial}
            </div>
          )}
        </div>

        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-15 flex items-center justify-center backdrop-blur-[2px]">
          <div className="w-11 h-11 bg-orange-500 text-white rounded-full flex items-center justify-center scale-75 group-hover:scale-100 transition-all duration-300 shadow-xl shadow-orange-500/40 border border-orange-450">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Badge: Live Indicator */}
        <div className="absolute bottom-2.5 left-3 z-15 flex items-center gap-1.5">
          {isActive ? (
            <span className="flex items-center gap-1.5 text-[9px] font-bold text-red-400 font-mono bg-red-950/60 px-2 py-0.5 rounded-md border border-red-500/40 backdrop-blur-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse animate-ping"></span>
              LIVE PLAYER
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-bold text-slate-300 font-mono bg-black/60 px-2 py-0.5 rounded-md border border-white/5 backdrop-blur-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-450 bg-slate-400"></span>
              STREAM READY
            </span>
          )}
        </div>
      </div>

      {/* Bottom Profile Details Panel */}
      <div className="p-4 flex flex-col justify-between gap-3 bg-zinc-950/60 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight line-clamp-1 font-sans group-hover:text-orange-400 transition-colors">
            {channel.name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[9.5px] font-mono font-semibold tracking-wider px-2 py-0.5 rounded-md uppercase border backdrop-blur-md ${getCategoryBadgeStyles(channel.category)}`}>
              {channel.category}
            </span>
          </div>
        </div>

        {/* Footer Info Area */}
        <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]" title={channel.originalGroup}>
            {channel.originalGroup || "Live Broadcast"}
          </span>
          
          <button
            onClick={onToggleFavorite}
            aria-label="Toggle Favorite"
            className={`p-1.5 rounded-lg border transition-all duration-200 ${
              isFavorite 
                ? "bg-rose-500/15 border-rose-500/40 text-rose-400 hover:bg-rose-500/25" 
                : "bg-black/50 border-white/5 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-white/5"
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
