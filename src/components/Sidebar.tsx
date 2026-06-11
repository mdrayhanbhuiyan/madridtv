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
  
  // Calculate channel counts per category
  const getCategoryCount = (category: string) => {
    if (category === "all") return channels.length;
    if (category === "featured") return channels.filter(c => c.isFeatured).length;
    if (category === "favorites") return favorites.length;
    if (category === "history") return history.length;
    return channels.filter(c => c.category === category).length;
  };

  const navItems = [
    { id: "all", name: "All Channels", icon: Tv },
    { id: "featured", name: "Featured Channels", icon: Sparkles, color: "text-amber-400" },
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
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border-r border-white/10 text-slate-100 font-sans" id="iptv-sidebar">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-6 py-7 border-b border-white/10" id="sidebar-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-orange-950/40 font-display">
            M
          </div>
          <div>
            <h1 className="text-lg font-bold font-display tracking-tight text-white leading-none">Madrid<span className="text-orange-500">tvlive</span></h1>
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm ${
                      isActive 
                        ? 'bg-white/10 text-orange-400 font-semibold' 
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-slate-400 group-hover:text-white'}`} />
                      <span>{item.name}</span>
                    </div>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-orange-500/20 text-orange-400 font-bold' : 'bg-white/5 text-gray-500 group-hover:bg-white/10 group-hover:text-gray-300'
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm ${
                      isActive 
                        ? 'bg-white/10 text-orange-400 font-semibold' 
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-slate-400 group-hover:text-white'}`} />
                      <span>{cat.name}</span>
                    </div>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-orange-500/20 text-orange-400 font-bold' : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-gray-300'
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
      <div className="p-4 mx-3 mb-2 bg-gradient-to-br from-orange-600/15 to-transparent border border-orange-500/20 rounded-2xl">
        <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mb-1 font-mono">Active Plan</p>
        <p className="text-xs font-semibold text-white font-display">Premium Lifetime Access</p>
        <div className="mt-2.5 h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full w-full bg-orange-500 rounded-full"></div>
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
            className="text-orange-400 hover:text-orange-300 hover:underline font-sans font-medium"
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
            className="w-72 h-full"
            onClick={(e) => e.stopPropagation()}
            id="sidebar-drawer-mobile"
          >
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
