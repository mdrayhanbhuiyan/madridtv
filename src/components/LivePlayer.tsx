import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  RefreshCw, 
  Tv, 
  Expand, 
  Zap, 
  AlertTriangle,
  Loader2,
  Heart,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Timer,
  Keyboard,
  Info,
  Activity,
  Flame,
  Eye
} from "lucide-react";
import { Channel } from "../types";
import { getCategoryBadgeStyles } from "./ChannelCard";

interface LivePlayerProps {
  channel: Channel;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPrevChannel?: () => void;
  onNextChannel?: () => void;
  isMini?: boolean;
  onToggleMini?: () => void;
}

const FILTER_PRESETS = [
  { id: "none", name: "Original Style", css: "none" },
  { id: "vivid", name: "Vivid Glow", css: "contrast(1.18) saturate(1.2)" },
  { id: "warm", name: "Warm Cinema", css: "sepia(0.18) contrast(1.02) saturate(1.08)" },
  { id: "midnight", name: "Cozy Moonlight", css: "brightness(0.72) contrast(1.05)" },
  { id: "cyber", name: "Cyberpunk Saturation", css: "contrast(1.2) hue-rotate(15deg) saturate(1.35)" }
];

export default function LivePlayer({
  channel,
  isFavorite,
  onToggleFavorite,
  onPrevChannel,
  onNextChannel,
  isMini = false,
  onToggleMini
}: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"contain" | "cover" | "stretch">("contain");
  const [latencyInfo, setLatencyInfo] = useState<string>("Normal");
  const [retryCount, setRetryCount] = useState(0);

  // --- PREMIUM EXTENDED FACILITIES ---
  const [eqFilter, setEqFilter] = useState("none");
  const [sleepMinutesRemaining, setSleepMinutesRemaining] = useState<number | null>(null);
  const [isStatsActive, setIsStatsActive] = useState(false);
  const [hudFeedback, setHudFeedback] = useState<string | null>(null);
  const hudTimeoutRef = useRef<any>(null);

  // Simulated metrics for Stats panel (updated periodically)
  const [simulatedBitrate, setSimulatedBitrate] = useState<string>("5.4 Mbps");
  const [simulatedFps, setSimulatedFps] = useState<number>(60);
  const [simulatedResolution, setSimulatedResolution] = useState<string>("1920x1080 (HD)");

  const showHotkeyFeedback = (msg: string) => {
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    setHudFeedback(msg);
    hudTimeoutRef.current = setTimeout(() => {
      setHudFeedback(null);
    }, 1500);
  };

  // Swipe gesture tracking states
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const hasSwipedRef = useRef(false);
  const swipedRecentlyRef = useRef(false);

  const handlePlayerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    hasSwipedRef.current = false;
    setIsSwiping(true);
    setSwipeDelta(0);
  };

  const handlePlayerTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartXRef.current;
    const deltaY = currentY - touchStartYRef.current;

    // Reject vertical scrolling/swiping so standard scroll works
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && !hasSwipedRef.current) {
      setIsSwiping(false);
      setSwipeDelta(0);
      return;
    }

    if (Math.abs(deltaX) > 10) {
      hasSwipedRef.current = true;
      // Prevent browser default scroll
      if (e.cancelable) {
        e.preventDefault();
      }
    }

    setSwipeDelta(deltaX);
  };

  const handlePlayerTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const threshold = 75; // px required for channel switch
    if (Math.abs(swipeDelta) > threshold) {
      // Swiping right (swipeDelta > 0) -> previous channel
      if (swipeDelta > 0 && onPrevChannel) {
        swipedRecentlyRef.current = true;
        onPrevChannel();
        setTimeout(() => { swipedRecentlyRef.current = false; }, 200);
      }
      // Swiping left (swipeDelta < 0) -> next channel
      else if (swipeDelta < 0 && onNextChannel) {
        swipedRecentlyRef.current = true;
        onNextChannel();
        setTimeout(() => { swipedRecentlyRef.current = false; }, 200);
      }
    } else if (hasSwipedRef.current) {
      // Just clear swiping state with temporary click guard
      swipedRecentlyRef.current = true;
      setTimeout(() => { swipedRecentlyRef.current = false; }, 200);
    }
    setSwipeDelta(0);
  };

  // Check PiP capability on mount
  useEffect(() => {
    const video = document.createElement("video");
    const hasStandardPip = "pictureInPictureEnabled" in document && (document as any).pictureInPictureEnabled;
    const hasSafariPip = "webkitSupportsPresentationMode" in video && 
                         (video as any).webkitSupportsPresentationMode("picture-in-picture");
    if (hasStandardPip || hasSafariPip) {
      setPipSupported(true);
    }
  }, []);

  // Facility 1: Sleep Timer Countdown Effect
  useEffect(() => {
    if (sleepMinutesRemaining === null) return;
    if (sleepMinutesRemaining <= 0) {
      const video = videoRef.current;
      if (video) {
        video.pause();
        setIsPlaying(false);
      }
      setSleepMinutesRemaining(null);
      showHotkeyFeedback("Standby (Timer Expired)");
      return;
    }

    const interval = setInterval(() => {
      setSleepMinutesRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          const video = videoRef.current;
          if (video) {
            video.pause();
            setIsPlaying(false);
          }
          showHotkeyFeedback("Standby (Timer Expired)");
          return null;
        }
        return prev - 1;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [sleepMinutesRemaining]);

  // Facility 2: Real-time Stats telemetry alterations (makes the "Stats for Nerds" panel breathe live data!)
  useEffect(() => {
    const interval = setInterval(() => {
      const randomValue = (4.5 + Math.random() * 1.5).toFixed(1);
      setSimulatedBitrate(`${randomValue} Mbps`);
      setSimulatedFps(Math.random() > 0.5 ? 60 : 59);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Facility 3: Full standard keyboard hotkeys with elegant on-screen overlay feedback
  useEffect(() => {
    if (isMini) return; // Disable hotkey intercepts for the background mini overlay

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting triggers if typing in search feeds or sliders
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      const video = videoRef.current;

      switch (e.key.toLowerCase()) {
        case " ": // Space bar
          e.preventDefault();
          if (video) {
            if (isPlaying) {
              video.pause();
              setIsPlaying(false);
              showHotkeyFeedback("Paused");
            } else {
              video.play()
                .then(() => {
                  setIsPlaying(true);
                  showHotkeyFeedback("Playing");
                })
                .catch(() => {});
            }
          }
          break;

        case "m": // Mute sound
          e.preventDefault();
          setIsMuted((prev) => {
            const nextMuted = !prev;
            if (video) {
              video.muted = nextMuted;
              video.volume = nextMuted ? 0 : volume;
            }
            showHotkeyFeedback(nextMuted ? "Muted" : `Volume ${Math.round(volume * 100)}%`);
            return nextMuted;
          });
          break;

        case "f": // Fullscreen
          e.preventDefault();
          toggleFullscreen();
          showHotkeyFeedback(document.fullscreenElement ? "Window Mode" : "Fullscreen Mode");
          break;

        case "p": // Picture-in-picture
          e.preventDefault();
          handlePipClick();
          showHotkeyFeedback("Picture-in-picture Toggle");
          break;

        case "s": // Sleep timer rotation
          e.preventDefault();
          setSleepMinutesRemaining((prev) => {
            if (prev === null) {
              showHotkeyFeedback("Sleep Timer: 1 Min demo");
              return 1;
            }
            if (prev === 1) {
              showHotkeyFeedback("Sleep Timer: 15 Mins");
              return 15;
            }
            if (prev === 15) {
              showHotkeyFeedback("Sleep Timer: 30 Mins");
              return 30;
            }
            if (prev === 30) {
              showHotkeyFeedback("Sleep Timer: 60 Mins");
              return 60;
            }
            showHotkeyFeedback("Sleep Timer Stopped");
            return null;
          });
          break;

        case "e": // Equalizer visual filters rotation
          e.preventDefault();
          setEqFilter((prev) => {
            const currentIndex = FILTER_PRESETS.findIndex(item => item.id === prev);
            const nextIndex = (currentIndex + 1) % FILTER_PRESETS.length;
            const nextPreset = FILTER_PRESETS[nextIndex];
            showHotkeyFeedback(`EQ Preset: ${nextPreset.name}`);
            return nextPreset.id;
          });
          break;

        case "n": // Stats toggle
          e.preventDefault();
          setIsStatsActive((prev) => {
            showHotkeyFeedback(!prev ? "Telemetry Stats Activated" : "Telemetry Stats Closed");
            return !prev;
          });
          break;

        case "arrowleft": // Previous channel
          if (onPrevChannel) {
            e.preventDefault();
            onPrevChannel();
            showHotkeyFeedback("Previous Channel");
          }
          break;

        case "arrowright": // Next channel
          if (onNextChannel) {
            e.preventDefault();
            onNextChannel();
            showHotkeyFeedback("Next Channel");
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isMuted, volume, onPrevChannel, onNextChannel, eqFilter, isMini]);

  // Synchronize Picture-in-Picture event listeners and active state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => {
      setIsPipActive(true);
    };

    const handleLeavePiP = () => {
      setIsPipActive(false);
    };

    const handleWebkitPiP = () => {
      if ((video as any).webkitPresentationMode) {
        setIsPipActive((video as any).webkitPresentationMode === "picture-in-picture");
      }
    };

    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);
    video.addEventListener("webkitpresentationmodechanged", handleWebkitPiP);

    // Initial check just in case
    if (document.pictureInPictureElement === video) {
      setIsPipActive(true);
    }

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video.removeEventListener("leavepictureinpicture", handleLeavePiP);
      video.removeEventListener("webkitpresentationmodechanged", handleWebkitPiP);
    };
  }, [channel.url]); // Re-subscribe when the video element/channel source is updated to keep state perfectly in-sync

  // Initialize and handle HLS.js streaming lifecycle
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    setIsLoading(true);
    setHasError(false);
    setIsPlaying(false);
    setIsMetadataLoaded(false);

    const handleLoadedMetadata = () => {
      setIsMetadataLoaded(true);
      setIsLoading(false);
      video.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Auto-play blocked by browser policy:", err);
          setIsPlaying(false);
        });
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleError = () => {
      // Direct native fallback element errors
      if (video.error && retryCount < 3) {
        console.warn(`Native player error detected. Retrying count: ${retryCount}...`);
        setRetryCount(prev => prev + 1);
        video.load();
      } else {
        setHasError(true);
        setIsLoading(false);
      }
    };

    // 1. Browser Native HLS Support (e.g., Safari, iOS Safari, or macOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = channel.url;
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("waiting", handleWaiting);
      video.addEventListener("error", handleError);
    } 
    // 2. Fallback to raw hls.js (Chrome, Firefox, Edge, Android, etc.)
    else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        backBufferLength: 10,
      });

      hls.loadSource(channel.url);
      hls.attachMedia(video);

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("waiting", handleWaiting);
      video.addEventListener("error", handleError);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("Auto-play blocked inside manifest parsed:", err);
            setIsPlaying(false);
          });
      });

      hls.on(Hls.Events.FRAG_BUFFERED, (event, data) => {
        // Simple metric updates inside our control deck
        const bufferedData = data as any;
        if (bufferedData.parts && bufferedData.parts.length > 0) {
          setLatencyInfo("Low-Latency");
        } else {
          setLatencyInfo("Normal");
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn(`HLS Player Event Error [${data.type}]:`, data.details);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("Fatal network error. Attempting HLS startLoad...");
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("Fatal media sequence error. Attempting HLS recoverMediaError...");
              hls?.recoverMediaError();
              break;
            default:
              console.error("Fatal unrecoverable HLS stack failure.");
              setHasError(true);
              setIsLoading(false);
              hls?.destroy();
              break;
          }
        }
      });
    } else {
      console.error("HLS codec format is not supported on this browser device.");
      setHasError(true);
      setIsLoading(false);
    }

    // Cleanup listeners and instances
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("error", handleError);
      if (hls) {
        hls.destroy();
      }
    };
  }, [channel.url]);

  // Handle local video playback actions
  const togglePlay = () => {
    if (swipedRecentlyRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error("Play failed:", err));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    setIsMuted(value === 0);
    if (videoRef.current) {
      videoRef.current.volume = value;
      videoRef.current.muted = value === 0;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      videoRef.current.volume = nextMuted ? 0 : volume;
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error("Fullscreen request failed:", err));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Sync fullscreen change with esc button press
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const triggerPictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || !isMetadataLoaded || video.readyState < 1) return;

    try {
      // Standard Picture-in-Picture
      if ("pictureInPictureEnabled" in document && (document as any).pictureInPictureEnabled) {
        if (document.pictureInPictureElement === video) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } 
      // Safari Webkit Picture-in-Picture fallback
      else if ((video as any).webkitSupportsPresentationMode && (video as any).webkitSupportsPresentationMode("picture-in-picture")) {
        const currentMode = (video as any).webkitPresentationMode;
        const targetMode = currentMode === "picture-in-picture" ? "inline" : "picture-in-picture";
        (video as any).webkitSetPresentationMode(targetMode);
      }
    } catch (err) {
      console.error("Failed to toggle Picture-In-Picture:", err);
    }
  };

  const handlePipClick = async () => {
    if (onToggleMini) {
      onToggleMini();
    } else {
      await triggerPictureInPicture();
    }
  };

  const reloadStream = () => {
    setRetryCount(0);
    setHasError(false);
    setIsLoading(true);
    const video = videoRef.current;
    if (video) {
      const url = channel.url;
      // Re-trigger reload
      video.src = "";
      video.load();
      video.src = url;
    }
  };

  const handleNextAspectRatio = () => {
    if (aspectRatio === "contain") setAspectRatio("cover");
    else if (aspectRatio === "cover") setAspectRatio("stretch");
    else setAspectRatio("contain");
  };

  const videoFitStyle = {
    contain: "object-contain",
    cover: "object-cover",
    stretch: "w-full h-full object-fill"
  }[aspectRatio];

  return (
    <div className={`flex flex-col bg-black/85 backdrop-blur-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/80 transition-all duration-300 relative ${isMini ? "rounded-2xl" : "rounded-3xl"}`} id="live-player-container-root">
      
      {/* Floating Mini Player Header */}
      {isMini && (
        <div className="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-black/90 to-black/0 px-3 flex items-center justify-between z-30 pointer-events-auto" id="mini-player-title-header">
          <span className="text-[10px] font-bold text-white truncate max-w-[180px] font-mono tracking-wide drop-shadow">
            {channel.name}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleMini) onToggleMini();
            }}
            className="w-5 h-5 rounded-full bg-black/50 hover:bg-orange-600 border border-white/10 flex items-center justify-center text-white hover:text-white transition-colors text-[9px] font-bold"
            title="Close Picture-in-Picture"
            id="mini-player-close-btn"
          >
            ✕
          </button>
        </div>
      )}

      {/* Visual Canvas Player Area */}
      <div 
        ref={containerRef}
        className="relative bg-black aspect-video w-full flex items-center justify-center group overflow-hidden" 
        onTouchStart={handlePlayerTouchStart}
        onTouchMove={handlePlayerTouchMove}
        onTouchEnd={handlePlayerTouchEnd}
        id="video-player-canvas-area"
      >
        <video
          ref={videoRef}
          className={`w-full h-full max-h-[60vh] rounded-t-2xl transition-all duration-300 ${videoFitStyle}`}
          preload="metadata"
          playsInline
          style={{ 
            verticalAlign: 'middle',
            transform: isSwiping ? `translateX(${swipeDelta * 0.35}px)` : 'none',
            transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            filter: FILTER_PRESETS.find(p => p.id === eqFilter)?.css || "none"
          }}
        />

        {/* HUD Hotkey OSD Toast Overlay */}
        {hudFeedback && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-45 bg-black/90 backdrop-blur-md border border-orange-500/40 text-orange-400 font-mono text-[10px] font-extrabold px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow-2xl pointer-events-none animate-slide-in select-none" id="hud-osd-feedback-overlay">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span className="uppercase tracking-widest">{hudFeedback}</span>
          </div>
        )}

        {/* Advanced "Stats for Nerds" telemetry overlay */}
        {isStatsActive && (
          <div className="absolute top-4 left-4 z-40 bg-zinc-950/95 backdrop-blur-md border border-white/10 p-3 rounded-xl font-mono text-[10px] text-slate-300 pointer-events-auto w-60 shadow-2xl select-none" id="stats-telemetry-box">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2 gap-3">
              <span className="text-orange-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                <Activity className="w-3.5 h-3.5 text-orange-500 animate-pulse" /> Telemetry Info
              </span>
              <button 
                onClick={() => setIsStatsActive(false)}
                className="hover:text-white transition-colors text-slate-500 p-0.5 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Decoder Protocol:</span> <span className="text-emerald-400 font-bold">HLS (IPTV)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">M3U8 Stream Source:</span> <span className="truncate max-w-[110px] text-right font-medium text-slate-400" title={channel.url}>{channel.url.split('/').pop() || "live.m3u8"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Bitrate Sync (Sim):</span> <span className="text-white font-semibold">{simulatedBitrate}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Render FPS:</span> <span className="text-white font-semibold">{simulatedFps} Fps</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Layout Scaling:</span> <span className="text-slate-200 uppercase font-semibold text-[9px]">{aspectRatio}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Visual EQ Preset:</span> <span className="text-orange-400 font-semibold">{FILTER_PRESETS.find(p => p.id === eqFilter)?.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sleep Countdown:</span> <span className="text-amber-400 font-semibold">{sleepMinutesRemaining !== null ? `${sleepMinutesRemaining} Min(s) active` : "Standby Inactive"}</span></div>
            </div>
          </div>
        )}

        {/* Swipe Left/Right feedback overlays */}
        {isSwiping && Math.abs(swipeDelta) > 15 && (
          <>
            {/* Swiping Right -> previous channel */}
            {swipeDelta > 0 && onPrevChannel && (
              <div 
                className="absolute left-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 bg-black/80 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl pointer-events-none transition-all duration-150" 
                style={{ 
                  opacity: Math.min(Math.abs(swipeDelta) / 60, 0.95), 
                  transform: `translateY(-50%) scale(${Math.min(0.85 + Math.abs(swipeDelta) / 300, 1.15)})` 
                }}
              >
                <ChevronLeft className="w-6 h-6 text-orange-400 animate-pulse" />
                <span className="text-[10px] font-mono tracking-wider text-slate-300 uppercase font-bold">Prev Channel</span>
              </div>
            )}

            {/* Swiping Left -> next channel */}
            {swipeDelta < 0 && onNextChannel && (
              <div 
                className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 bg-black/80 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl pointer-events-none transition-all duration-150"
                style={{ 
                  opacity: Math.min(Math.abs(swipeDelta) / 60, 0.95), 
                  transform: `translateY(-50%) scale(${Math.min(0.85 + Math.abs(swipeDelta) / 300, 1.15)})` 
                }}
              >
                <ChevronRight className="w-6 h-6 text-orange-400 animate-pulse" />
                <span className="text-[10px] font-mono tracking-wider text-slate-300 uppercase font-bold">Next Channel</span>
              </div>
            )}
          </>
        )}

        {/* Video click-to-pause trigger */}
        <div 
          onClick={togglePlay}
          className="absolute inset-x-0 top-0 bottom-14 cursor-pointer"
          id="canvas-click-playback-trigger"
        />

        {/* Loading Spinner overlay */}
        {isLoading && !hasError && !isPipActive && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col gap-3 items-center justify-center transition-opacity duration-300" id="player-loading-overlay">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <div className="text-sm font-mono text-slate-300 tracking-wide font-medium flex items-center gap-1.5">
              <span>Resolving Live Feed...</span>
            </div>
          </div>
        )}

        {/* Immersive PiP active glass overlay */}
        {isPipActive && !hasError && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col gap-4 items-center justify-center text-center z-10 p-6 animate-fade-in" id="player-pip-active-overlay">
            <div className="w-16 h-16 bg-orange-500/10 rounded-2xl border border-orange-500/25 flex items-center justify-center text-orange-400">
              <Tv className="w-8 h-8 animate-pulse" />
            </div>
            <div className="max-w-xs px-2">
              <h4 className="text-sm font-bold font-display text-white">Playing in PiP Mode</h4>
              <p className="text-[11px] text-slate-400 mt-1.5 font-sans leading-relaxed">
                Madridtvlive is playing in a floating browser window. Browse other channels freely without stopping the broadcast stream!
              </p>
            </div>
            <button
              onClick={triggerPictureInPicture}
              className="mt-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl text-xs hover:scale-105 transition-all shadow-md shadow-orange-950/20 flex items-center gap-2"
              id="player-pip-return-btn"
            >
              Return to Inline Player
            </button>
          </div>
        )}

        {/* Stream Error Overlay */}
        {hasError && (
          <div className="absolute inset-0 bg-black/90 flex flex-col gap-5 items-center justify-center p-6 text-center z-10" id="player-error-overlay">
            <div className="w-14 h-14 bg-[#32130e] rounded-2xl border border-orange-500/30 flex items-center justify-center text-orange-500">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="max-w-md">
              <h4 className="text-base font-semibold text-white font-display">Live Channel Offline</h4>
              <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">
                The streaming source url for <span className="font-medium text-slate-300 font-mono">"{channel.name}"</span> returned a server timeout. Some IPTV broadcasts refresh links occasionally.
              </p>
            </div>
            <button
              onClick={reloadStream}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg shadow-orange-950/40 text-xs transition-all duration-200"
              id="player-retry-button"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Load Source</span>
            </button>
          </div>
        )}

        {/* Floating Quick Stats Overlays (Bottom corners of screen on hover) */}
        {!hasError && (
          <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" id="player-live-overlay-stats">
            <span className="flex items-center gap-1.5 text-[9px] font-mono font-semibold tracking-wider text-red-500 bg-black/80 border border-red-500/30 px-2 line-clamp-1 py-1 rounded-md shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse"></span>
              LIVE
            </span>
            <span className="text-[9px] font-mono font-semibold tracking-wider text-slate-300 bg-black/80 border border-white/10 px-2 py-1 rounded-md shadow-md">
              HLS • {latencyInfo}
            </span>
          </div>
        )}

        {/* Interactive Controls Overlay Bar */}
        {!hasError && (
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-black to-black/0 px-4 md:px-6 flex items-center justify-between opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-10" id="player-hover-control-deck">
            
            {/* Play/Pause controls */}
            <div className="flex items-center gap-2" id="controls-left-slot">
              <button
                onClick={togglePlay}
                className="p-2 text-white hover:text-orange-400 bg-black/40 hover:bg-white/5 rounded-lg transition-all"
                title={isPlaying ? "Pause Stream" : "Play Stream"}
                id="playback-toggle-btn"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              
              {/* Optional Prev/Next Controls */}
              {onPrevChannel && (
                <button
                  onClick={onPrevChannel}
                  className="p-1.5 text-slate-300 hover:text-orange-400 hover:bg-white/5 rounded-lg text-xs"
                  title="Previous Channel"
                  id="prev-chan-btn"
                >
                  Prev
                </button>
              )}
              {onNextChannel && (
                <button
                  onClick={onNextChannel}
                  className="p-1.5 text-slate-300 hover:text-orange-400 hover:bg-white/5 rounded-lg text-xs"
                  title="Next Channel"
                  id="next-chan-btn"
                >
                  Next
                </button>
              )}
            </div>

            {/* Custom Interactive Volume slider */}
            <div className="flex items-center gap-2 group/vol max-w-28 md:max-w-40 flex-1 justify-center" id="controls-mid-volume-slot">
              <button
                onClick={toggleMute}
                className="p-2 text-white hover:text-orange-400 rounded-lg transition-all"
                title={isMuted ? "Unmute" : "Mute Sound"}
                id="mute-toggle-btn"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
                id="volume-slider-input"
              />
            </div>

            {/* Extra screen control buttons */}
            <div className="flex items-center gap-1.5" id="controls-right-slot">
              {/* Aspect Ratio Sizer */}
              <button
                onClick={handleNextAspectRatio}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg text-xs font-mono font-medium hidden sm:block"
                title={`Change Aspect Ratio (Currently: ${aspectRatio})`}
                id="aspect-ratio-btn"
              >
                <Expand className="w-4 h-4" />
              </button>

              {/* PiP button */}
              {(pipSupported || onToggleMini) && (
                <button
                  onClick={handlePipClick}
                  disabled={!isMetadataLoaded || hasError}
                  className={`p-2 rounded-lg transition-all ${
                    !isMetadataLoaded || hasError
                      ? "opacity-30 cursor-not-allowed text-slate-500"
                      : isMini || isPipActive 
                        ? "text-orange-400 bg-orange-500/10 border border-orange-500/20 shadow-sm" 
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                  title={
                    hasError 
                      ? "Stream Offline"
                      : !isMetadataLoaded 
                        ? "Waiting for live feed metadata..." 
                        : isMini || isPipActive 
                          ? "Exit Picture-in-Picture" 
                          : "Picture-in-Picture Mode"
                  }
                  id="pip-trigger-btn"
                >
                  <Tv className="w-4 h-4" />
                </button>
              )}

              {/* Fullscreen control */}
              <button
                onClick={toggleFullscreen}
                className="p-2 text-white hover:text-orange-400 bg-black/40 hover:bg-white/5 rounded-lg transition-all"
                title={isFullscreen ? "Exit Full Screen" : "Fill Full Screen"}
                id="fullscreen-toggle-btn"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Immersive Smart Utility & Enhancement Bar (Client EQ, Sleep Timer, Stats) */}
      {!isMini && (
        <div className="px-4 py-3 md:px-6 bg-zinc-950/40 border-t border-white/5 flex flex-wrap items-center justify-between gap-y-3 gap-x-6 text-[11px] font-sans" id="premium-utilities-bar">
          
          {/* EQ Filter pills */}
          <div className="flex items-center gap-2" id="eq-presets-selector-deck">
            <span className="text-slate-500 font-mono flex items-center gap-1 text-[10px]">
              <Sliders className="w-3.5 h-3.5 text-orange-400" />
              <span>VISUAL EQ:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setEqFilter(preset.id);
                    showHotkeyFeedback(`EQ Preset: ${preset.name}`);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-mono tracking-wider transition-all duration-150 border uppercase ${
                    eqFilter === preset.id
                      ? "bg-orange-500/10 border-orange-500/30 text-orange-400 font-bold"
                      : "bg-black/20 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {preset.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap" id="timer-stats-shortcut-triggers">
            {/* Sleep Timer Settings Selection */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono flex items-center gap-1 text-[10px]">
                <Timer className="w-3.5 h-3.5 text-orange-400" />
                <span>SLEEP TIMER:</span>
              </span>
              <select
                value={sleepMinutesRemaining === null ? "off" : sleepMinutesRemaining}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "off") {
                    setSleepMinutesRemaining(null);
                    showHotkeyFeedback("Sleep Timer Off");
                  } else {
                    const mins = parseInt(val);
                    setSleepMinutesRemaining(mins);
                    showHotkeyFeedback(`Sleep in ${mins} Min(s)`);
                  }
                }}
                className="bg-zinc-900 border border-white/10 hover:border-orange-500/30 text-slate-300 rounded-lg px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium transition-all cursor-pointer"
              >
                <option value="off">Inactive</option>
                <option value="1">1 Min (Demo)</option>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
              </select>
              {sleepMinutesRemaining !== null && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Timer Active" />
              )}
            </div>

            {/* Custom Stats & Hotkey Trigger Buttons */}
            <div className="flex items-center gap-2">
              {/* Stats for Nerds Trigger */}
              <button
                onClick={() => {
                  setIsStatsActive(!isStatsActive);
                  showHotkeyFeedback(!isStatsActive ? "Telemetry Stats Activated" : "Telemetry Stats Closed");
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono tracking-wide transition-all uppercase ${
                  isStatsActive
                    ? "bg-orange-500/15 border-orange-500/30 text-orange-400 font-bold"
                    : "bg-black/20 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                title="Toggle Real-Time Broadcast Codec Telemetry [N Key]"
              >
                <Info className="w-3.5 h-3.5 text-orange-400" />
                <span>Stats</span>
              </button>

              {/* Advanced Hotkey Helper Drawer Popover Toggle */}
              <div className="relative group/hotkeys">
                <button
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/5 bg-black/20 hover:bg-white/5 text-slate-400 hover:text-white text-[10px] font-mono tracking-wide transition-all uppercase"
                  title="Show Live keyboard controller system mappings"
                >
                  <Keyboard className="w-3.5 h-3.5 text-orange-400" />
                  <span>Hotkeys</span>
                </button>
                {/* Visual tooltip popover display */}
                <div className="absolute right-0 bottom-full mb-2 w-64 bg-zinc-950/95 backdrop-blur-md border border-white/10 p-3.5 rounded-xl shadow-2xl scale-0 group-hover/hotkeys:scale-100 origin-bottom-right transition-all duration-200 z-55 pointer-events-none text-[10px] text-slate-300 space-y-2 font-mono" style={{ bottom: '120%' }}>
                  <h5 className="font-bold text-orange-400 text-[10.5px] border-b border-white/15 pb-1 uppercase tracking-wider flex items-center gap-1">
                    <Keyboard className="w-3.5 h-3.5" /> Keyboard Shortcuts
                  </h5>
                  <div className="space-y-1 text-slate-400 leading-relaxed">
                    <div className="flex justify-between"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">Space</kbd> <span>Play / Pause</span></div>
                    <div className="flex justify-between"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">M</kbd> <span>Mute / Unmute</span></div>
                    <div className="flex justify-between"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">F</kbd> <span>Fullscreen</span></div>
                    <div className="flex justify-between"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">P</kbd> <span>Picture-In-Picture</span></div>
                    <div className="flex justify-between"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">S</kbd> <span>Sleep Timer</span></div>
                    <div className="flex justify-between"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">E</kbd> <span>Change EQ Preset</span></div>
                    <div className="flex justify-between"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">N</kbd> <span>Stats Panel</span></div>
                    <div className="flex justify-between"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">←</kbd> / <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white border border-white/10">→</kbd> <span>Channel Flip</span></div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* Stream Info Metadata Header plate */}
      {!isMini && (
        <div className="p-4 md:p-6 bg-black/20 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4" id="player-banner-metadata">
        
        <div className="flex items-start gap-3.5" id="player-desc-subcontainer">
          {/* Circular logo */}
          <div className="w-12 h-12 bg-black/40 p-1 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
            {channel.logo ? (
              <img 
                src={channel.logo}
                alt={channel.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Tv className="w-5 h-5 text-orange-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-lg font-bold font-display text-white leading-tight tracking-tight">
                {channel.name}
              </h2>
              <span className={`text-[9.5px] font-mono tracking-wider px-2 py-0.5 rounded-md uppercase border ${getCategoryBadgeStyles(channel.category)}`}>
                {channel.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Streaming: <span className="font-mono text-[11px] text-orange-400 font-medium">{channel.originalGroup}</span></span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Zap className="w-3 h-3 text-orange-500 fill-current" />
                Live Broadcast Link
              </span>
            </p>
          </div>
        </div>

        {/* Favorite heart selector */}
        <div className="flex items-center gap-3 self-end md:self-auto" id="player-action-deck">
          <button
            onClick={onToggleFavorite}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 ${
              isFavorite 
                ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20" 
                : "bg-black/30 border-white/10 text-slate-400 hover:text-rose-400 hover:border-slate-700 hover:bg-white/5"
            }`}
            id="player-add-favorite-btn"
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
            <span>{isFavorite ? "Favorited" : "Add Favorite"}</span>
          </button>
        </div>

      </div>
      )}
    </div>
  );
}
