import React, { useState, useRef } from "react";
import { 
  Tv, 
  Sparkles, 
  Heart, 
  History, 
  Trophy, 
  Newspaper, 
  Film, 
  Music, 
  Smile, 
  Compass, 
  Grid,
  ChevronRight,
  ChevronLeft,
  X
} from "lucide-react";
import { Channel } from "../types";

interface SidebarProps {
  currentCategory: string;
  setCurrentCategory: (cat: string) => void;
  channels: Channel[];
  favorites: string[];
  history: string[];
  isOpenOnMobile: boolean;
  setIsOpenOnMobile: (open: boolean) => void;
}

export default function Sidebar({
  currentCategory,
  setCurrentCategory,
  channels,
  favorites,
  history,
  isOpenOnMobile,
  setIsOpenOnMobile
}: SidebarProps) {
  
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [sidebarOffset, setSidebarOffset] = useState(0);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  const handleSidebarTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    setIsDraggingSidebar(true);
    setSidebarOffset(0);
  };

  const handleSidebarTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = touchStartRef.current.x - currentX;
    const diffY = Math.abs(touchStartRef.current.y - currentY);

    // If the touch movement is primarily vertical, ignore drag to support native vertical scrolling
    if (diffY > Math.abs(diffX) * 1.5 && !isDraggingSidebar) {
      setIsDraggingSidebar(false);
      setSidebarOffset(0);
      touchStartRef.current = null;
      return;
    }

    // Only swipe left to dismiss!
    if (diffX > 0) {
      setSidebarOffset(-diffX);
    } else {
      setSidebarOffset(0);
    }
  };

  const handleSidebarTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const currentX = e.changedTouches[0].clientX;
    const currentY = e.changedTouches[0].clientY;
    const diffX = touchStartRef.current.x - currentX;
    const diffY = Math.abs(touchStartRef.current.y - currentY);

    setIsDraggingSidebar(false);
    // If swiped more than 60px horizontally and primarily horizontal:
    if (diffX > 60 && diffX > diffY) {
      setIsOpenOnMobile(false);
    }
    setSidebarOffset(0);
    touchStartRef.current = null;
  };

  // Calculate channel counts per category
  const getCategoryCount = (category: string) => {
    if (category === "all") return channels.length;
    if (category === "featured") return channels.filter(c => c.isFeatured).length;
    if (category === "fifa_2026") return "LIVE";
    if (category === "favorites") return favorites.length;
    if (category === "history") return history.length;
    return channels.filter(c => c.category === category).length;
  };

  const navItems = [
    { id: "all", name: "All Channels", icon: Tv },
    { id: "featured", name: "Featured Channels", icon: Sparkles, color: "text-lime-400" },
    { id: "fifa_2026", name: "FIFA World Cup 2026", icon: Trophy, color: "text-lime-400" },
    { id: "favorites", name: "My Favorites", icon: Heart, color: "text-rose-500" },
    { id: "history", name: "Watch History", icon: History, color: "text-blue-400" },
  ];

  const contentCategories = [
    { id: "Bangla", name: "Bangla Media", icon: Grid },
    { id: "Sports", name: "Sports Arena", icon: Trophy },
    { id: "News", name: "News 24/7", icon: Newspaper },
    { id: "Entertainment", name: "Entertainment", icon: Film },
    { id: "Movies", name: "Movies & Cinema", icon: Film },
    { id: "Music", name: "Music Hits", icon: Music },
    { id: "Kids", name: "Kids Zone", icon: Smile },
    { id: "Religious", name: "Religious", icon: Compass },
    { id: "Others", name: "Others", icon: Grid }
  ];

  const handleCategorySelect = (id: string) => {
    setCurrentCategory(id);
    setIsOpenOnMobile(false); // Close sidebar on mobile select
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-zinc-950/60 backdrop-blur-2xl border-r border-white/5 text-slate-100 font-sans shadow-2xl relative overflow-hidden" id="iptv-sidebar">
      {/* Top ambient luxury background aura */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-lime-500/5 blur-3xl pointer-events-none rounded-full" />
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-6 py-7 border-b border-white/10" id="sidebar-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-lime-500 rounded-lg flex items-center justify-center font-bold text-lg text-zinc-950 shadow-lg shadow-lime-950/40 font-display">
            M
          </div>
          <div>
            <h1 className="text-lg font-bold font-display tracking-tight text-white leading-none">Madrid<span className="text-lime-400">tvlive</span></h1>
            <span className="text-[10px] text-slate-400 font-mono">Live Streams Player</span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpenOnMobile(false)}
          className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          id="sidebar-close-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7" id="sidebar-groups">
        {/* Core Quick Access lists */}
        <div>
          <span className="px-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono">Quick Access</span>
          <ul className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentCategory === item.id;
              const count = getCategoryCount(item.id);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleCategorySelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm cursor-pointer ${
                      isActive 
                        ? 'bg-white/10 text-lime-400 font-bold border border-lime-500/25 shadow-md glow-lemon/10' 
                        : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-lime-400' : 'text-slate-400 group-hover:text-white'}`} />
                      <span>{item.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg border transition-all ${
                      isActive ? 'bg-lime-500/30 border-lime-500/40 text-lime-350 text-lime-300 font-black' : 'bg-white/5 border-white/5 text-gray-500 group-hover:bg-white/10 group-hover:text-gray-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Channels by Genres */}
        <div>
          <span className="px-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono">Genres / Categories</span>
          <ul className="mt-2 space-y-1">
            {contentCategories.map((cat) => {
              const Icon = cat.icon;
              const isActive = currentCategory === cat.id;
              const count = getCategoryCount(cat.id);
              if (count === 0 && !isActive) return null; // Hide empty categories unless selected

              return (
                <li key={cat.id}>
                  <button
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm cursor-pointer ${
                      isActive 
                        ? 'bg-white/10 text-lime-400 font-bold border border-lime-500/25 shadow-md glow-lemon/10' 
                        : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-lime-400' : 'text-slate-400 group-hover:text-white'}`} />
                      <span>{cat.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg border transition-all ${
                      isActive ? 'bg-lime-500/30 border-lime-500/40 text-lime-350 text-lime-300 font-black' : 'bg-white/5 border-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-gray-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Premium Lifetime Feature Panel */}
      <div className="p-4 mx-3 mb-2 bg-gradient-to-br from-lime-500/10 via-lime-950/20 to-black/40 border border-lime-500/25 rounded-2xl shadow-xl glow-lemon/15 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-lime-500/10 blur-2xl pointer-events-none rounded-full" />
        <p className="text-[9px] text-lime-400 font-bold uppercase tracking-widest mb-1 font-mono">Active Privilege</p>
        <p className="text-xs font-bold text-white font-sans flex items-center gap-1.5 uppercase tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-lime-400 fill-current animate-pulse" />
          <span>Premium Lifetime Access</span>
        </p>
        <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-lime-600 to-lime-400 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-white/10 bg-black/20 text-[11px] text-slate-500 flex flex-col gap-1.5" id="sidebar-footer">
        <div className="flex items-center justify-between">
          <span>Developer ID</span>
          <a 
            href="https://www.facebook.com/mdrayhanOfficial/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-lime-400 hover:text-lime-300 hover:underline font-sans font-medium"
          >
            Rayhan Official
          </a>
        </div>
        <div className="text-[9px] text-slate-600 font-mono text-center mt-1">
          Streams updated dynamically
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar Overlay container */}
      <div className="hidden md:block w-72 h-screen shrink-0 sticky top-0" id="sidebar-wrapper-desktop">
        <SidebarContent />
      </div>

      {/* Mobile Drawer Backdrop */}
      {isOpenOnMobile && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpenOnMobile(false)}
          id="sidebar-backdrop-mobile"
        >
          <div 
            className="w-72 h-full touch-pan-y"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleSidebarTouchStart}
            onTouchMove={handleSidebarTouchMove}
            onTouchEnd={handleSidebarTouchEnd}
            style={{
              transform: isDraggingSidebar ? `translateX(${sidebarOffset}px)` : 'none',
              transition: isDraggingSidebar ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            id="sidebar-drawer-mobile"
          >
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
