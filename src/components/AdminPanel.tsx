import React, { useState, useEffect } from "react";
import { 
  X, 
  Lock, 
  Plus, 
  Trash2, 
  LogOut, 
  Tv, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  Link2, 
  Image as ImageIcon,
  BarChart3,
  Users,
  Clock,
  Smartphone,
  Laptop,
  Monitor,
  Globe
} from "lucide-react";
import { Channel } from "../types";
import { Language } from "../utils/translations";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onChannelsChanged: () => void; // call this to refresh mainstream state
}

const CATEGORIES = [
  "Bangla",
  "Sports",
  "News",
  "Movies",
  "Music",
  "Kids",
  "Entertainment",
  "Infotainment",
  "Religious",
  "Others"
];

export default function AdminPanel({ isOpen, onClose, lang, onChannelsChanged }: AdminPanelProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for channel list
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // States for introducing new channel
  const [newTvName, setNewTvName] = useState("");
  const [newStreamUrl, setNewStreamUrl] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newCategory, setNewCategory] = useState("Sports");
  const [addSuccess, setAddSuccess] = useState("");
  const [addError, setAddError] = useState("");
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Admin Panel Tab Selection and Analytics Telemetry States
  const [activeTab, setActiveTab] = useState<"streams" | "analytics">("streams");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");

  // Quick verify session token on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("madridtv-admin-token");
      if (savedToken === "admin-secret-session-token-2026") {
        setIsLoggedIn(true);
      }
    } catch (e) {
      // safe fallback
    }
  }, []);

  // Fetch admin custom channels if logged in
  const fetchAdminChannels = async () => {
    setIsLoadingChannels(true);
    setFetchError("");
    try {
      const res = await fetch("/api/admin/channels");
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.channels)) {
          setChannels(data.channels);
        } else {
          setFetchError("Failed parsing admin channels database response.");
        }
      } else {
        setFetchError("Failed accessing back-end channels resource.");
      }
    } catch (err: any) {
      setFetchError(err.message || "Network error fetching channels.");
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const fetchAnalytics = async (silent = false) => {
    if (!silent) setIsLoadingAnalytics(true);
    setAnalyticsError("");
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setAnalyticsData(data);
        } else {
          setAnalyticsError("Failed parsing analytics server response.");
        }
      } else {
        setAnalyticsError("Error response loading analytics from back-end.");
      }
    } catch (err: any) {
      setAnalyticsError(err.message || "Network failure fetching live telemetry.");
    } finally {
      if (!silent) setIsLoadingAnalytics(false);
    }
  };

  // Synchronized loaders / watchers based on tab selections
  useEffect(() => {
    if (isLoggedIn && isOpen) {
      if (activeTab === "streams") {
        fetchAdminChannels();
      } else {
        fetchAnalytics(false);
        // Live polling every 4 seconds for ticking stay-duration telemetry!
        const interval = setInterval(() => {
          fetchAnalytics(true);
        }, 4000);
        return () => clearInterval(interval);
      }
    }
  }, [isLoggedIn, isOpen, activeTab]);

  if (!isOpen) return null;

  // Sign out routine
  const handleLogout = () => {
    try {
      localStorage.removeItem("madridtv-admin-token");
    } catch (e) {}
    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
    setLoginError("");
    setChannels([]);
  };

  // Submit Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        try {
          localStorage.setItem("madridtv-admin-token", data.token);
        } catch (e) {}
        setIsLoggedIn(true);
        setLoginError("");
      } else {
        setLoginError(data.message || "Invalid administrative credentials.");
      }
    } catch (err) {
      setLoginError("Failed to connect with login server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Channel Handler
  const handleAddChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");
    
    if (!newTvName.trim() || !newStreamUrl.trim()) {
      setAddError("TV Name and M3U8 Stream Link are mandatory.");
      return;
    }

    setIsAddingChannel(true);
    try {
      const res = await fetch("/api/admin/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTvName.trim(),
          url: newStreamUrl.trim(),
          logo: newLogoUrl.trim() || undefined,
          category: newCategory
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAddSuccess(`Successfully uploaded channel "${newTvName}"!`);
        setNewTvName("");
        setNewStreamUrl("");
        setNewLogoUrl("");
        fetchAdminChannels();
        onChannelsChanged(); // notify parent
        setTimeout(() => setAddSuccess(""), 4000);
      } else {
        setAddError(data.message || "Failed uploading channel.");
      }
    } catch (err) {
      setAddError("Failed communication with backend channel server.");
    } finally {
      setIsAddingChannel(false);
    }
  };

  // Delete Channel Handler
  const handleDeleteChannel = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/channels/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (res.ok && data.success) {
        fetchAdminChannels();
        onChannelsChanged(); // notify parent
      } else {
        alert(data.message || "Failed deleting selected entry.");
      }
    } catch (err) {
      alert("Failed connecting to deletes resource endpoint.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatSecondsDetail = (sec: number) => {
    if (sec < 60) return lang === "bn" ? `${sec} সেকেন্ড` : `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (lang === "bn") {
      return `${m} মি. ${s} সে.`;
    }
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" id="admin-panel-overlay">
      
      {/* Centered Modal Backdrop Box */}
      <div 
        className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]"
        id="admin-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-lime-600 via-emerald-500 to-lime-400" />

        {/* Modal Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0" id="admin-modal-header">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-lime-500/10 rounded-xl border border-lime-500/20 flex items-center justify-center text-lime-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-white">
                {lang === "bn" ? "অ্যাডমিন কন্ট্রোল প্যানেল" : "Admin Systems & Control"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isLoggedIn 
                  ? (lang === "bn" ? "চ্যানেল আপলোড এবং মেইনটেন্যান্স পোর্টাল" : "Channel Uploads & Maintenance Portal")
                  : (lang === "bn" ? "প্রবেশের জন্য অ্যাডমিন ক্রেডেনশিয়াল ব্যবহার করুন" : "Authorized Personal Credentials Verification Portal")
                }
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            id="admin-close-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Scrollable Section */}
        <div className="flex-1 overflow-y-auto p-6" id="admin-panel-scrollable-body">
          {!isLoggedIn ? (
            /* =================== LOGIN FORM =================== */
            <form onSubmit={handleLoginSubmit} className="max-w-md mx-auto py-4 space-y-4" id="admin-login-form">
              {loginError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Username Field */}
              <div className="space-y-1.5" id="login-username-group">
                <label className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                  {lang === "bn" ? "ইমেইল বা ইউজারনেম" : "Email Username"}
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@gmail.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black border border-white/10 focus:border-lime-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-500/50 transition-all font-sans"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5" id="login-password-group">
                <label className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                  {lang === "bn" ? "পাসওয়ার্ড" : "Password"}
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-white/10 focus:border-lime-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lime-500/50 transition-all font-sans"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 bg-lime-600 hover:bg-lime-500 text-zinc-950 font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-lime-500/10 cursor-pointer flex items-center justify-center gap-2"
                id="admin-login-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>{lang === "bn" ? "যাচাই করা হচ্ছে..." : "Verifying Secure Token..."}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 fill-current text-zinc-950" />
                    <span>{lang === "bn" ? "সাইন ইন করুন" : "Secure Sign In"}</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* =================== SIGNED IN MANAGEMENT =================== */
            <div className="space-y-6" id="admin-management-dashboard">

              {/* Tab Navigation header */}
              <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5" id="admin-tab-bar">
                <button
                  type="button"
                  onClick={() => setActiveTab("streams")}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "streams"
                      ? "bg-lime-600 text-zinc-950 font-black shadow"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                  id="tab-streams-btn"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>{lang === "bn" ? "চ্যানেলসমূহ" : "Broadcast Channels"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("analytics")}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "analytics"
                      ? "bg-lime-600 text-zinc-950 font-black shadow"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                  id="tab-analytics-btn"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="flex items-center gap-1">
                    {lang === "bn" ? "লাইভ অ্যানালিটিক্স" : "Live Analytics"}
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping inline-block shrink-0" />
                  </span>
                </button>
              </div>

              {activeTab === "streams" ? (
                <div className="space-y-6">
              
              {/* Form to add a new channel */}
              <div className="p-5 bg-zinc-900/30 border border-white/5 rounded-2xl space-y-4" id="upload-channel-card-form">
                <div className="flex items-center gap-2 text-lime-400 font-bold text-sm">
                  <Plus className="w-4 h-4" />
                  <span>{lang === "bn" ? "নতুন এম৩ইউ৮ (m3u8) চ্যানেল যোগ করুন" : "Upload New M3U8 Live Stream"}</span>
                </div>

                {addSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-2 text-xs text-emerald-400 animate-slide-in">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{addSuccess}</span>
                  </div>
                )}

                {addError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-center gap-2 text-xs text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <form onSubmit={handleAddChannelSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4" id="new-channel-form">
                  {/* TV Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                      {lang === "bn" ? "টেলিভিশনের নাম (TV Channel Name) *" : "TV Name *"}
                    </label>
                    <div className="relative">
                      <Tv className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="Sports Live / BTV Live"
                        value={newTvName}
                        onChange={(e) => setNewTvName(e.target.value)}
                        className="w-full bg-black border border-white/10 focus:border-lime-500/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Channel M3U8 Stream URL */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                      {lang === "bn" ? "এম৩ইউ৮ স্ট্রিম লিঙ্ক (M3U8 Stream URL) *" : "M3U8 Stream URL *"}
                    </label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="url"
                        required
                        placeholder="https://example.com/live/stream.m3u8"
                        value={newStreamUrl}
                        onChange={(e) => setNewStreamUrl(e.target.value)}
                        className="w-full bg-black border border-white/10 focus:border-lime-500/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Logo URL (Optional) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                      {lang === "bn" ? "লোগো ইমেজ লিঙ্ক (Logo Url - ঐচ্ছিক)" : "TV Logo URL (Optional)"}
                    </label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="url"
                        placeholder="https://example.com/image.png"
                        value={newLogoUrl}
                        onChange={(e) => setNewLogoUrl(e.target.value)}
                        className="w-full bg-black border border-white/10 focus:border-lime-500/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest block">
                      {lang === "bn" ? "ক্যাটাগরি বা শ্রেণীবিভাগ" : "Genre Category"}
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-black border border-white/10 focus:border-lime-500/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Action Button */}
                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={isAddingChannel}
                      className="w-full py-2.5 bg-lime-600 hover:bg-lime-500 text-zinc-950 font-extrabold text-xs rounded-xl shadow-lg hover:shadow-lime-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isAddingChannel ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                          <span>{lang === "bn" ? "চ্যানেল আপলোড হচ্ছে..." : "Injecting Stream Pipeline..."}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 fill-current text-zinc-950" />
                          <span>{lang === "bn" ? "চ্যানেল যোগ করুন (Apply Feature Upload)" : "Features Upload Channel"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Uploaded channels list */}
              <div className="space-y-3" id="active-custom-list-block">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest">
                    {lang === "bn" ? "আপনার আপলোড করা চ্যানেলসমূহ" : "Uploaded Static Feature Streams"}
                  </h3>
                  <span className="p-1 px-2.5 bg-zinc-900 border border-white/10 rounded-full text-[10px] font-mono text-lime-400 font-bold">
                    {channels.length} {lang === "bn" ? "চ্যানেল" : "Channels Active"}
                  </span>
                </div>

                {isLoadingChannels ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-8 h-8 text-lime-500 animate-spin" />
                    <p className="text-xs text-slate-500 mt-2 font-mono">Synchronizing live records...</p>
                  </div>
                ) : fetchError ? (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-center text-xs">
                    {fetchError}
                  </div>
                ) : channels.length === 0 ? (
                  <div className="py-10 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                    <Tv className="w-8 h-8 text-slate-700 mb-2" />
                    <p className="text-xs text-slate-400 font-bold font-display">
                      {lang === "bn" ? "কোন কাস্টম চ্যানেল পাওয়া যায়নি" : "No Custom Channels Uploaded Yet"}
                    </p>
                    <p className="text-[10px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                      {lang === "bn" 
                        ? "উপরের ফর্মটি ব্যবহার করে টিভি নাম এবং m3u8 স্ট্রিম লিঙ্ক দিয়ে আপনার প্রথম চ্যানেলটি সাকসেসফুলি যোগ করুন।" 
                        : "Use the constructor form above to declare your first live IPTV broadcasting server instantly!"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 divide-y divide-white/5 border border-white/5 bg-zinc-900/20 rounded-2xl overflow-hidden" id="admin-channel-list-table">
                    {channels.map((chan) => (
                      <div key={chan.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Channel Logo */}
                          <div className="w-10 h-10 bg-black/60 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                            {chan.logo ? (
                              <img 
                                src={chan.logo} 
                                alt={chan.name} 
                                className="object-contain w-full h-full p-1"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://upload.wikimedia.org/wikipedia/commons/a/aa/FIFA_logo_without_background.svg";
                                }}
                              />
                            ) : (
                              <Tv className="w-4 h-4 text-slate-500" />
                            )}
                          </div>

                          {/* Channel Meta */}
                          <div className="min-w-0">
                            <span className="text-[9px] font-extrabold uppercase font-mono px-1.5 py-0.5 bg-lime-500/10 border border-lime-500/20 text-lime-400 rounded">
                              {chan.category}
                            </span>
                            <h4 className="text-xs font-bold text-white truncate mt-1">{chan.name}</h4>
                            <p className="text-[10px] text-slate-500 truncate font-mono mt-0.5 max-w-xs md:max-w-md">{chan.url}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <button
                          onClick={() => handleDeleteChannel(chan.id, chan.name)}
                          disabled={deletingId === chan.id}
                          className="p-2 border border-rose-500/20 text-rose-450 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer shrink-0"
                          title="Delete channel"
                        >
                          {deletingId === chan.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
          ) : (
            /* =================== LIVE DETAILED USER ANALYTICS DASHBOARD =================== */
            <div className="space-y-5 animate-fade-in animate-once duration-300" id="analytics-telemetry-panel">
              {isLoadingAnalytics && !analyticsData ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-10 h-10 text-lime-500 animate-spin" />
                  <p className="text-xs text-slate-400 mt-3 font-mono">Connecting to real-time analytics stream...</p>
                </div>
              ) : analyticsError ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 rounded-xl text-center">
                  {analyticsError}
                </div>
              ) : !analyticsData ? (
                <p className="text-xs text-slate-500 text-center py-10 font-mono">No telemetry logged yet.</p>
              ) : (
                <>
                  {/* Four Quick Bento Stats Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    
                    {/* 1. Concurrent Users */}
                    <div className="bg-zinc-900/40 border border-white/5 p-3 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                          {lang === "bn" ? "লাইভ ভিজিটর" : "Active Users"}
                        </span>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white font-mono tracking-tight animate-pulse">
                          {analyticsData.activeUsers}
                        </span>
                        <span className="text-[9px] text-slate-400 font-sans">{lang === "bn" ? "অনলাইন" : "online"}</span>
                      </div>
                    </div>

                    {/* 2. Total Cumulative unique hits */}
                    <div className="bg-zinc-900/40 border border-white/5 p-3 rounded-2xl flex flex-col justify-between shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                          {lang === "bn" ? "মোট ভিজিটর" : "Total Hits"}
                        </span>
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-lime-400 font-mono tracking-tight">
                          {analyticsData.totalVisitors.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-500 font-sans">{lang === "bn" ? "ইউনিক" : "visits"}</span>
                      </div>
                    </div>

                    {/* 3. Average Webpage stay-time */}
                    <div className="bg-zinc-900/40 border border-white/5 p-3 rounded-2xl flex flex-col justify-between shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                          {lang === "bn" ? "গড় অবস্থানকাল" : "Avg Stay Time"}
                        </span>
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div className="mt-2">
                        <span className="text-[13px] font-black text-white font-mono whitespace-nowrap">
                          {formatSecondsDetail(analyticsData.avgStayTime)}
                        </span>
                      </div>
                    </div>

                    {/* 4. Geography Countries */}
                    <div className="bg-zinc-900/40 border border-white/5 p-3 rounded-2xl flex flex-col justify-between shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                          {lang === "bn" ? "সক্রিয় অঞ্চল" : "Regions"}
                        </span>
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div className="mt-2">
                        <span className="text-xs font-bold text-slate-300">
                          {Object.keys(analyticsData.countryBreakdown).length} {lang === "bn" ? "টি দেশ" : "Countries"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Distribution statistics split layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Left Column: Sourced country analytics with progress bars */}
                    <div className="p-4 bg-zinc-900/30 border border-white/5 rounded-2xl space-y-3">
                      <h4 className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-white/5">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{lang === "bn" ? "দেশ ভিত্তিক রিপোর্ট" : "Geographic Breakdown"}</span>
                      </h4>
                      
                      <div className="space-y-3 max-h-[150px] overflow-y-auto pr-1">
                        {Object.entries(analyticsData.countryBreakdown)
                          .sort((a: any, b: any) => b[1] - a[1])
                          .map(([countryName, val]: any) => {
                            const pct = analyticsData.activeUsers > 0 
                              ? Math.round((val / analyticsData.activeUsers) * 100) 
                              : 0;
                            return (
                              <div key={countryName} className="space-y-1 text-xs">
                                <div className="flex items-center justify-between text-slate-300 font-medium">
                                  <span>{countryName}</span>
                                  <span className="font-mono text-slate-400 text-[11px]">{val} {lang === "bn" ? "জন" : "users"} ({pct}%)</span>
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 rounded-full transition-all duration-500" 
                                    style={{ width: `${pct}%` }} 
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Right Column: Sourced device types */}
                    <div className="p-4 bg-zinc-900/30 border border-white/5 rounded-2xl space-y-3">
                      <h4 className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-white/5">
                        <Smartphone className="w-3.5 h-3.5 text-lime-400" />
                        <span>{lang === "bn" ? "ডিভাইস ভিত্তিক রিপোর্ট" : "Device Diagnostics"}</span>
                      </h4>

                      <div className="space-y-3 max-h-[150px] overflow-y-auto pr-1">
                        {["Mobile", "Desktop", "Tablet", "Smart TV"].map((dev) => {
                          const val = analyticsData.deviceBreakdown[dev] || 0;
                          const pct = analyticsData.activeUsers > 0
                            ? Math.round((val / analyticsData.activeUsers) * 100)
                            : 0;
                          
                          return (
                            <div key={dev} className="space-y-1 text-xs">
                              <div className="flex items-center justify-between text-slate-300">
                                <span className="flex items-center gap-2 font-medium">
                                  {dev === "Desktop" && <Monitor className="w-3.5 h-3.5 text-slate-400" />}
                                  {dev === "Mobile" && <Smartphone className="w-3.5 h-3.5 text-slate-400" />}
                                  {dev === "Tablet" && <Laptop className="w-3.5 h-3.5 text-slate-400" />}
                                  {dev === "Smart TV" && <Tv className="w-3.5 h-3.5 text-slate-400" />}
                                  <span>{dev}</span>
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">{val} ({pct}%)</span>
                              </div>
                              <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5">
                                <div 
                                  className="h-full bg-gradient-to-r from-lime-500 to-emerald-400 rounded-full transition-all duration-500" 
                                  style={{ width: `${pct}%` }} 
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Immersive active live concurrent session records */}
                  <div className="space-y-2" id="live-concurrent-logs-block">
                    <div className="flex items-center justify-between border-b border-white/5 pb-1 gap-2">
                      <span className="text-[10px] font-black uppercase font-mono tracking-wider text-slate-400">
                        {lang === "bn" ? "সরাসরি কানেক্টেড ইউজার সেশন লগ" : "Active Live Sessions Console"}
                      </span>
                      <span className="text-[9px] text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded border border-lime-500/20 font-mono font-black animate-pulse">
                        ● {lang === "bn" ? "লাইভ আপডেট হচ্ছে" : "LIVE TELEMETRY ACTIVE"}
                      </span>
                    </div>

                    <div className="border border-white/5 bg-zinc-950/40 rounded-2xl overflow-hidden shadow-inner max-h-[170px] overflow-y-auto">
                      <div className="grid grid-cols-4 bg-zinc-900/60 p-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-white/5 sticky top-0 z-10">
                        <div>{lang === "bn" ? "ইউজার আইডি" : "SESSION USER"}</div>
                        <div>{lang === "bn" ? "ডিভাইস ও আইপি" : "DEVICE & MASKED IP"}</div>
                        <div>{lang === "bn" ? "অঞ্চল" : "GEOGRAPHY"}</div>
                        <div className="text-right">{lang === "bn" ? "অবস্থানকাল" : "STAY DURATION"}</div>
                      </div>

                      <div className="divide-y divide-white/5 text-[11px] text-slate-300">
                        {analyticsData.activeSessionsList.map((s: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-4 p-2.5 hover:bg-white/5 items-center transition-all">
                            <div className="truncate font-mono flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.isReal ? "bg-red-500 animate-pulse" : "bg-lime-500"}`} />
                              <span className={s.isReal ? "text-white font-bold" : "text-slate-400"}>
                                {s.sid}
                              </span>
                            </div>
                            <div className="truncate text-slate-400 font-mono flex items-center gap-1">
                              <span className="text-white bg-white/5 px-1 rounded text-[9px]">{s.device}</span>
                              <span>{s.ip}</span>
                            </div>
                            <div className="truncate text-slate-350">{s.country}</div>
                            <div className="text-right font-mono text-lime-400 font-extrabold text-[11px]">
                              {formatSecondsDetail(s.stay)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
            </div>
          )}
        </div>

        {/* Modal Footer with sign-out option */}
        <div className="p-4 border-t border-white/5 bg-zinc-950 flex items-center justify-between shrink-0" id="admin-modal-footer">
          <p className="text-[10px] text-zinc-500 font-mono">
            Madridtvlive Panel v2.0
          </p>

          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="px-4 py-1.5 border border-rose-500/20 hover:bg-rose-500/10 text-rose-500 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              id="admin-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === "bn" ? "লগআউট" : "Log Out Admin"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
