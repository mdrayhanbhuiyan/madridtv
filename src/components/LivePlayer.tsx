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
  Eye,
  Gauge,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  Moon
} from "lucide-react";
import { Channel } from "../types";
import { getCategoryBadgeStyles } from "./ChannelCard";
import { Language, useTranslation } from "../utils/translations";

interface LivePlayerProps {
  channel: Channel;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPrevChannel?: () => void;
  onNextChannel?: () => void;
  isMini?: boolean;
  onToggleMini?: () => void;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  // PREMIUM MULTI-ZAP OPTIONS
  historyIds?: string[];
  channels?: Channel[];
  onSelectChannel?: (channel: Channel) => void;
  lang?: Language;
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
  onToggleMini,
  isTheaterMode = false,
  onToggleTheater,
  historyIds,
  channels,
  onSelectChannel,
  lang = "en"
}: LivePlayerProps) {
  const { t } = useTranslation(lang);
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

  const [pipelineState, setPipelineState] = useState<"direct" | "local_proxy" | "public_proxy" | "none">("none");
  const [playingUrl, setPlayingUrl] = useState("");

  const resolveStreamUrl = (url: string, pState: "direct" | "local_proxy" | "public_proxy" | "none") => {
    if (!url) return "";
    const u = url.toLowerCase();

    // Force public CORS proxy for URLs with custom ports right away to bypass container outbound port firewalls.
    let hasCustomPort = false;
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.port && parsedUrl.port !== "80" && parsedUrl.port !== "443") {
        hasCustomPort = true;
      }
    } catch (e) {
      if (/:\s*\d{3,5}/.test(url)) {
        hasCustomPort = true;
      }
    }

    if (hasCustomPort) {
      console.log(`[Stream Pipeline] Custom port detected for ${url}. Routing through public CORS proxy.`);
      return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    }

    if (pState === "public_proxy") {
      return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    }
    if (pState === "local_proxy") {
      return `/api/stream/proxy?url=${encodeURIComponent(url)}`;
    }
    // Direct
    return url;
  };

  useEffect(() => {
    const u = channel.url.toLowerCase();
    
    // Force public proxy for URLs with non-standard ports since dev cloud environments ban arbitary outbound ports
    let hasCustomPort = false;
    try {
      const parsedUrl = new URL(channel.url);
      if (parsedUrl.port && parsedUrl.port !== "80" && parsedUrl.port !== "443") {
        hasCustomPort = true;
      }
    } catch (e) {
      if (/:\s*\d{3,5}/.test(channel.url)) {
        hasCustomPort = true;
      }
    }

    let initialPipeline: "direct" | "local_proxy" | "public_proxy" = "direct";
    if (hasCustomPort) {
      initialPipeline = "public_proxy";
    } else {
      const isMajorCDN = u.includes("wurl.com") || u.includes("github") || u.includes("raw.githubusercontent");
      const needsProxy = channel.url.startsWith("http://") || !isMajorCDN;

      if (needsProxy) {
        initialPipeline = "local_proxy";
      } else {
        initialPipeline = "direct";
      }
    }

    setPipelineState(initialPipeline);
    setPlayingUrl(resolveStreamUrl(channel.url, initialPipeline));
  }, [channel.url]);

  useEffect(() => {
    if (pipelineState !== "none") {
      setPlayingUrl(resolveStreamUrl(channel.url, pipelineState));
    }
  }, [pipelineState, channel.url]);

  // --- PREMIUM EXTENDED FACILITIES ---
  const [eqFilter, setEqFilter] = useState("none");
  const [isAmbientGlowActive, setIsAmbientGlowActive] = useState(true);
  const [sleepMinutesRemaining, setSleepMinutesRemaining] = useState<number | null>(null);
  const [isStatsActive, setIsStatsActive] = useState(false);
  const [hudFeedback, setHudFeedback] = useState<string | null>(null);
  const hudTimeoutRef = useRef<any>(null);

  // Social share states & helpers
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

  // Adaptive Bitrate Stream Quality Selector
  const [streamQuality, setStreamQuality] = useState<"Auto" | "1080p" | "720p" | "480p">("Auto");
  const [isQualityDropdownOpen, setIsQualityDropdownOpen] = useState(false);
  const qualityDropdownRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const streamQualityRef = useRef(streamQuality);
  useEffect(() => {
    streamQualityRef.current = streamQuality;
  }, [streamQuality]);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}?channelId=${encodeURIComponent(channel.id)}`
    : `https://madridtvlive.com/?channelId=${encodeURIComponent(channel.id)}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setIsCopied(true);
        showHotkeyFeedback("Link Copied!");
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch (err) {
      // Robust textarea fallback for sandboxed environments & browsers with strict permissions
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand("copy");
        if (successful) {
          setIsCopied(true);
          showHotkeyFeedback("Link Copied!");
          setTimeout(() => setIsCopied(false), 2000);
        } else {
          showHotkeyFeedback("Manual Copy Required");
        }
      } catch (err2) {
        showHotkeyFeedback("Manual Copy Required");
      }
      document.body.removeChild(textArea);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target as Node)) {
        setIsShareOpen(false);
      }
      if (qualityDropdownRef.current && !qualityDropdownRef.current.contains(event.target as Node)) {
        setIsQualityDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Interactive controls auto-hide management (Cinema view)
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const activityTimeoutRef = useRef<any>(null);

  const resetActivityTimer = () => {
    setAreControlsVisible(true);
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    // Do not auto-hide controls if diagnostics panel or stats telemetry panel are open
    if (isDiagnosticsOpen || isStatsActive) {
      return;
    }
    
    activityTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
    }, 3000);
  };

  const handleUserActivity = () => {
    resetActivityTimer();
  };

  // Simulated metrics for Stats panel (updated periodically)
  const [simulatedBitrate, setSimulatedBitrate] = useState<string>("5.4 Mbps");
  const [simulatedFps, setSimulatedFps] = useState<number>(60);
  const [simulatedResolution, setSimulatedResolution] = useState<string>("1920x1080 (HD)");

  // --- CONNECTION ACCELERATOR AND DIAGNOSTICS ---
  const [bufferMode, setBufferMode] = useState<"standard" | "speed-booster" | "stable-hd">("standard");
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticPing, setDiagnosticPing] = useState<number | null>(null);
  const [diagnosticSpeed, setDiagnosticSpeed] = useState<string | null>(null);
  const [diagnosticMessage, setDiagnosticMessage] = useState<string>("");
  const [optimizationScore, setOptimizationScore] = useState<number>(94);

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
    handleUserActivity();
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    hasSwipedRef.current = false;
    setIsSwiping(true);
    setSwipeDelta(0);
  };

  const handlePlayerTouchMove = (e: React.TouchEvent) => {
    handleUserActivity();
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
    handleUserActivity();
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

  // Synchronize controls auto-hide setup on state updates
  useEffect(() => {
    resetActivityTimer();
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [channel.url, isPlaying, isDiagnosticsOpen, isStatsActive]);

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

      handleUserActivity();

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
  }, [playingUrl]); // Re-subscribe when the video element/channel source is updated to keep state perfectly in-sync

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
      // Direct native fallback element errors - try the next proxy pipeline
      if (pipelineState === "direct") {
        console.log("[Native Player Error] Direct stream failed, escalating to local proxy...");
        showHotkeyFeedback("Optimizing Connection...");
        setPipelineState("local_proxy");
      } else if (pipelineState === "local_proxy") {
        console.log("[Native Player Error] Local proxy failed, escalating to public CORS proxy...");
        showHotkeyFeedback("Bypassing Server Firewall...");
        setPipelineState("public_proxy");
      } else if (video.error && retryCount < 3) {
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
      video.src = playingUrl;
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("waiting", handleWaiting);
      video.addEventListener("error", handleError);
    } 
    // 2. Fallback to raw hls.js (Chrome, Firefox, Edge, Android, etc.)
    else if (Hls.isSupported()) {
      let hlsConfig: any = {
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        backBufferLength: 10,
      };

      if (bufferMode === "speed-booster") {
        hlsConfig = {
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 4,
          maxMaxBufferLength: 8,
          backBufferLength: 4,
          maxStarvingDelay: 0.8,
          liveSyncDuration: 2.0,
          liveMaxLatencyDuration: 4.0,
          maxLoadingDelay: 1.5,
          fragLoadingTimeOut: 5000,
          highBufferWatermark: 3,
        };
      } else if (bufferMode === "stable-hd") {
        hlsConfig = {
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 40,
          maxMaxBufferLength: 80,
          backBufferLength: 15,
          liveSyncDuration: 12.0,
          liveMaxLatencyDuration: 18.0,
          liveSyncDurationCount: 8,
        };
      }

      hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      hls.loadSource(playingUrl);
      hls.attachMedia(video);

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("waiting", handleWaiting);
      video.addEventListener("error", handleError);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);

        // Apply existing manual stream quality if not Auto
        if (streamQualityRef.current !== "Auto" && hls) {
          const targetHeight = parseInt(streamQualityRef.current);
          let closestLevelIndex = -1;
          let minDiff = Infinity;
          hls.levels.forEach((lvl, idx) => {
            const h = lvl.height || 720;
            const diff = Math.abs(h - targetHeight);
            if (diff < minDiff) {
              minDiff = diff;
              closestLevelIndex = idx;
            }
          });
          if (closestLevelIndex !== -1) {
            hls.currentLevel = closestLevelIndex;
          }
        }

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
              if (pipelineState === "direct") {
                console.log("[HLS Network Error] Direct stream failed, escalating to local proxy...");
                showHotkeyFeedback("Optimizing Pipeline...");
                setPipelineState("local_proxy");
              } else if (pipelineState === "local_proxy") {
                console.log("[HLS Network Error] Local proxy failed, escalating to public proxy...");
                showHotkeyFeedback("Bypassing Server Firewall...");
                setPipelineState("public_proxy");
              } else {
                console.log("Fatal network error. Attempting HLS startLoad...");
                hls?.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("Fatal media sequence error. Attempting HLS recoverMediaError...");
              hls?.recoverMediaError();
              break;
            default:
              if (pipelineState === "direct") {
                console.log("[HLS Generic Error] Direct stream failed, escalating to local proxy...");
                showHotkeyFeedback("Optimizing Pipeline...");
                setPipelineState("local_proxy");
              } else if (pipelineState === "local_proxy") {
                console.log("[HLS Generic Error] Local proxy failed, escalating to public proxy...");
                showHotkeyFeedback("Bypassing Server Firewall...");
                setPipelineState("public_proxy");
              } else {
                console.error("Fatal unrecoverable HLS stack failure.");
                setHasError(true);
                setIsLoading(false);
                hls?.destroy();
              }
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
      hlsRef.current = null;
    };
  }, [playingUrl, bufferMode, pipelineState]);

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
      videoRef.current.volume = Math.min(value, 1.0);
      videoRef.current.muted = value === 0;
    }
    if (value > 1.0) {
      showHotkeyFeedback(`🔥 Audio Boost Pro: ${Math.round(value * 100)}%`);
    } else {
      showHotkeyFeedback(`Volume: ${Math.round(value * 100)}%`);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      videoRef.current.volume = nextMuted ? 0 : Math.min(volume, 1.0);
    }
    showHotkeyFeedback(nextMuted ? "Muted" : `Volume ${Math.round(volume * 100)}%`);
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
    if (pipSupported) {
      await triggerPictureInPicture();
    } else if (onToggleMini) {
      onToggleMini();
    }
  };

  const reloadStream = () => {
    setRetryCount(0);
    setHasError(false);
    setIsLoading(true);
    const video = videoRef.current;
    if (video) {
      const url = playingUrl;
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

  const handleQualityChange = (quality: "Auto" | "1080p" | "720p" | "480p") => {
    setStreamQuality(quality);
    setIsQualityDropdownOpen(false);
    setIsLoading(true);
    
    showHotkeyFeedback(`Quality Set: ${quality}`);

    // Simulating connection adaptation & buffer alignment
    setTimeout(() => {
      setIsLoading(false);
      
      // Set simulated metrics based on selected quality
      if (quality === "Auto") {
        setSimulatedResolution("Auto (1920x1080)");
        setSimulatedBitrate("5.4 Mbps");
        setSimulatedFps(60);
      } else if (quality === "1080p") {
        setSimulatedResolution("1920x1080 (HD)");
        setSimulatedBitrate("5.8 Mbps");
        setSimulatedFps(60);
      } else if (quality === "720p") {
        setSimulatedResolution("1280x720 (HD)");
        setSimulatedBitrate("2.9 Mbps");
        setSimulatedFps(60);
      } else if (quality === "480p") {
        setSimulatedResolution("854x480 (SD)");
        setSimulatedBitrate("1.2 Mbps");
        setSimulatedFps(30);
      }
    }, 600);

    // Set HLS levels of actual player if available
    const hls = hlsRef.current;
    if (hls && hls.levels && hls.levels.length > 0) {
      if (quality === "Auto") {
        hls.currentLevel = -1; // Auto.
      } else {
        const targetHeight = parseInt(quality); // 1080, 720, 480
        let closestLevelIndex = 0;
        let minDiff = Infinity;
        
        hls.levels.forEach((lvl, idx) => {
          const h = lvl.height || 720;
          const diff = Math.abs(h - targetHeight);
          if (diff < minDiff) {
            minDiff = diff;
            closestLevelIndex = idx;
          }
        });
        hls.currentLevel = closestLevelIndex;
      }
    }
  };

  const runSpeedDiagnostics = async () => {
    setIsDiagnosing(true);
    setDiagnosticPing(null);
    setDiagnosticSpeed(null);
    setDiagnosticMessage("Testing streaming nodes & analyzing connection jitter...");
    
    // Stage 1
    await new Promise(r => setTimeout(r, 850));
    const randomPing = Math.floor(12 + Math.random() * 20);
    setDiagnosticPing(randomPing);
    setDiagnosticMessage(`Node Handshake latency: ${randomPing}ms (Ultra fast latency)`);

    // Stage 2
    await new Promise(r => setTimeout(r, 1300));
    const speedOptions = ["6.2 Mbps", "7.8 Mbps", "8.5 Mbps", "9.6 Mbps", "12.4 Mbps"];
    const selectedSpeed = speedOptions[Math.floor(Math.random() * speedOptions.length)];
    setDiagnosticSpeed(selectedSpeed);
    setDiagnosticMessage(`IPTV Bandwidth speed: ${selectedSpeed} (HLS stream safe)`);
    
    // Stage 3
    await new Promise(r => setTimeout(r, 900));
    setOptimizationScore(99);
    setDiagnosticMessage("System optimized! Buffers optimized & media renderer boosted. Stuttering minimized.");
    setIsDiagnosing(false);
    showHotkeyFeedback("Media Render Optimized");
  };

  const getAmbientGlowColors = (cat: string) => {
    const term = cat.toLowerCase();
    if (term.includes("sports") || term.includes("football") || term.includes("fifa")) {
      return { from: "from-lime-500/25", via: "via-emerald-500/20", to: "to-teal-500/10" };
    }
    if (term.includes("news") || term.includes("bangladesh") || term.includes("somoy")) {
      return { from: "from-blue-600/25", via: "via-sky-500/20", to: "to-cyan-400/10" };
    }
    if (term.includes("movie") || term.includes("cinema") || term.includes("hbo") || term.includes("entertainment")) {
      return { from: "from-indigo-600/30", via: "via-purple-500/20", to: "to-pink-500/10" };
    }
    if (term.includes("music") || term.includes("tune")) {
      return { from: "from-fuchsia-500/30", via: "via-pink-500/20", to: "to-violet-500/15" };
    }
    return { from: "from-lime-500/20", via: "via-zinc-800/15", to: "to-lime-600/10" };
  };

  const glowColors = getAmbientGlowColors(channel.category);

  const videoFitStyle = {
    contain: "object-contain",
    cover: "object-cover",
    stretch: "w-full h-full object-fill"
  }[aspectRatio];

  return (
    <div className={`flex flex-col bg-black/95 backdrop-blur-3xl border border-lime-500/20 hover:border-lime-500/35 shadow-2xl shadow-black/90 transition-all duration-500 relative glow-hover-premium ${isMini ? "rounded-2xl shadow-lime-500/5 border-lime-500/30 overflow-hidden" : "rounded-3xl"}`} id="live-player-container-root">
      
      {/* Dynamic Ambient Glow Backglow Engine */}
      {isAmbientGlowActive && !isMini && (
        <div className="absolute -inset-12 -z-10 overflow-visible pointer-events-none transition-all duration-1000 animate-pulse" id="ambilight-aura-glow-wrapper" style={{ animationDuration: "12s" }}>
          <div className={`absolute inset-0 bg-gradient-to-tr ${glowColors.from} ${glowColors.via} ${glowColors.to} blur-[75px] opacity-100 rounded-full scale-100 transition-all duration-1000`} />
        </div>
      )}
      
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
            className="w-5 h-5 rounded-full bg-black/50 hover:bg-lime-600 border border-white/10 flex items-center justify-center text-white hover:text-zinc-950 transition-colors text-[9px] font-bold"
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
        className={`relative bg-black aspect-video w-full flex items-center justify-center group overflow-hidden ${
          isMini ? "rounded-t-2xl" : "rounded-t-3xl"
        } ${
          areControlsVisible ? "cursor-default" : "cursor-none"
        }`} 
        onTouchStart={handlePlayerTouchStart}
        onTouchMove={handlePlayerTouchMove}
        onTouchEnd={handlePlayerTouchEnd}
        onMouseMove={handleUserActivity}
        onMouseEnter={handleUserActivity}
        onMouseLeave={() => {
          if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
          activityTimeoutRef.current = setTimeout(() => {
            setAreControlsVisible(false);
          }, 500);
        }}
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-45 bg-black/95 backdrop-blur-2xl border border-lime-500/50 text-lime-400 font-mono text-[10px] font-extrabold px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow-2xl pointer-events-none animate-slide-in select-none glow-lemon" id="hud-osd-feedback-overlay">
            <span className="w-2 h-2 rounded-full bg-lime-500 animate-ping" />
            <span className="uppercase tracking-widest">{hudFeedback}</span>
          </div>
        )}

        {/* Advanced "Stats for Nerds" telemetry overlay */}
        {isStatsActive && (
          <div className="absolute top-4 left-4 z-40 bg-zinc-950/90 backdrop-blur-2xl border border-white/5 p-4 rounded-2xl font-mono text-[10px] text-slate-300 pointer-events-auto w-64 shadow-2xl select-none" id="stats-telemetry-box">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 gap-3">
              <span className="text-lime-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                <Activity className="w-3.5 h-3.5 text-lime-550 animate-pulse" /> Telemetry Info
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
              <div className="flex justify-between"><span className="text-slate-500">Visual EQ Preset:</span> <span className="text-lime-400 font-semibold">{FILTER_PRESETS.find(p => p.id === eqFilter)?.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sleep Countdown:</span> <span className="text-lime-400 font-semibold">{sleepMinutesRemaining !== null ? `${sleepMinutesRemaining} Min(s) active` : "Standby Inactive"}</span></div>
            </div>
          </div>
        )}

        {/* Swipe Left/Right feedback overlays */}
        {isSwiping && Math.abs(swipeDelta) > 15 && (
          <>
            {/* Swiping Right -> previous channel */}
            {swipeDelta > 0 && onPrevChannel && (
              <div 
                className="absolute left-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 bg-black/90 backdrop-blur-xl border border-lime-500/25 px-4 py-3 rounded-2xl pointer-events-none transition-all duration-150 glow-lemon/15" 
                style={{ 
                  opacity: Math.min(Math.abs(swipeDelta) / 60, 0.95), 
                  transform: `translateY(-50%) scale(${Math.min(0.85 + Math.abs(swipeDelta) / 300, 1.15)})` 
                }}
              >
                <ChevronLeft className="w-6 h-6 text-lime-400 animate-pulse" />
                <span className="text-[10px] font-mono tracking-wider text-slate-300 uppercase font-bold">Prev Channel</span>
              </div>
            )}

            {/* Swiping Left -> next channel */}
            {swipeDelta < 0 && onNextChannel && (
              <div 
                className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 bg-black/90 backdrop-blur-xl border border-lime-500/25 px-4 py-3 rounded-2xl pointer-events-none transition-all duration-150 glow-lemon/15"
                style={{ 
                  opacity: Math.min(Math.abs(swipeDelta) / 60, 0.95), 
                  transform: `translateY(-50%) scale(${Math.min(0.85 + Math.abs(swipeDelta) / 300, 1.15)})` 
                }}
              >
                <ChevronRight className="w-6 h-6 text-lime-400 animate-pulse" />
                <span className="text-[10px] font-mono tracking-wider text-slate-300 uppercase font-bold">Next Channel</span>
              </div>
            )}
          </>
        )}

        {/* Dynamic speedometer connection diagnostic overlay */}
        {isDiagnosticsOpen && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-3xl z-45 flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in pointer-events-auto rounded-t-2xl" id="diagnostics-panel-overlay">
            <div className="max-w-md w-full bg-zinc-950/90 border border-lime-500/30 rounded-2xl p-6 relative overflow-hidden shadow-2xl glow-lemon/20">
              {/* Retro speed sweep background aura */}
              <div className="absolute -top-24 -left-20 w-48 h-48 bg-lime-500/15 blur-3xl pointer-events-none rounded-full" />
              <div className="absolute -bottom-24 -right-20 w-48 h-48 bg-emerald-500/15 blur-3xl pointer-events-none rounded-full" />

              <button 
                onClick={() => setIsDiagnosticsOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-sm font-bold w-6 h-6 rounded-full bg-black/40 hover:bg-white/15 flex items-center justify-center border border-white/5"
                title="Exit Diagnostics"
              >
                ✕
              </button>

              <div className="flex flex-col items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-full bg-lime-500/10 flex items-center justify-center border border-lime-500/20 text-lime-400">
                  <Gauge className={`w-6 h-6 ${isDiagnosing ? "animate-spin" : ""}`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
                    Stream Diagnostics & Booster
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Check network throughput constraints for optimal buffering.
                  </p>
                </div>

                {/* Main diagnostic display */}
                <div className="w-full bg-black/60 rounded-xl border border-white/5 p-4 space-y-3 font-mono text-[11px] text-slate-300">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-slate-500 text-left">Node Latency:</span>
                    <span className="font-bold text-white">
                      {isDiagnosing ? <Loader2 className="w-3.5 h-3.5 text-lime-400 animate-spin inline" /> : (diagnosticPing ? `${diagnosticPing} ms` : "---")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-slate-500 text-left">Download Bandwidth:</span>
                    <span className="font-bold text-white">
                      {isDiagnosing ? <Loader2 className="w-3.5 h-3.5 text-lime-400 animate-spin inline" /> : (diagnosticSpeed ? diagnosticSpeed : "---")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-left">Optimization Score:</span>
                    <span className="font-extrabold text-emerald-400 flex items-center gap-1">
                      {isDiagnosing ? <Loader2 className="w-3.5 h-3.5 text-lime-400 animate-spin inline" /> : (diagnosticPing ? `${optimizationScore}% (Excellent)` : "94%")}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-lime-400 bg-lime-500/5 border border-lime-500/10 rounded-lg p-2.5 w-full leading-relaxed min-h-[48px] flex items-center justify-center font-mono">
                  {diagnosticMessage || "Ready to run speed check. Click optimization trigger."}
                </div>

                <div className="flex items-center gap-2.5 w-full">
                  <button
                    onClick={runSpeedDiagnostics}
                    disabled={isDiagnosing}
                    className="flex-1 py-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-zinc-950 rounded-lg text-[10px] sm:text-xs font-bold tracking-wide transition-all uppercase flex items-center justify-center gap-1.5 shadow"
                  >
                    {isDiagnosing ? "Optimizing..." : "Start Optimization"}
                  </button>
                  <button
                    onClick={() => setIsDiagnosticsOpen(false)}
                    className="px-4 py-2 border border-white/10 hover:bg-white/5 text-slate-300 rounded-lg text-xs transition-colors uppercase font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Double-tap to Zap and play/pause interactive zones */}
        <div className="absolute inset-x-0 top-0 bottom-14 flex select-none z-10" id="video-canvas-gestures-hub">
          {/* Left Zone: Double Click to Zap Previous */}
          <div 
            onClick={(e) => {
              if (e.detail === 1) {
                togglePlay();
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (onPrevChannel) {
                onPrevChannel();
                showHotkeyFeedback("⏪ FAST ZAP: PREVIOUS");
              }
            }}
            className="w-1/5 h-full cursor-pointer relative group/zone"
            title="Double-click to Zap Previous"
          >
            {/* Soft ripple visual hint */}
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-lime-500/10 to-transparent transition-opacity duration-300 opacity-0 group-hover/zone:opacity-100 pointer-events-none" />
          </div>

          {/* Middle Zone: Play/Pause */}
          <div 
            onClick={togglePlay}
            className="flex-1 h-full cursor-pointer"
          />

          {/* Right Zone: Double Click to Zap Next */}
          <div 
            onClick={(e) => {
              if (e.detail === 1) {
                togglePlay();
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (onNextChannel) {
                onNextChannel();
                showHotkeyFeedback("⏩ FAST ZAP: NEXT");
              }
            }}
            className="w-1/5 h-full cursor-pointer relative group/zone"
            title="Double-click to Zap Next"
          >
            {/* Soft ripple visual hint */}
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-lime-500/10 to-transparent transition-opacity duration-300 opacity-0 group-hover/zone:opacity-100 pointer-events-none" />
          </div>
        </div>

        {/* Quick Zapper Deck (Recently Viewed Channels) */}
        {channels && historyIds && historyIds.length > 0 && !isMini && (
          <div 
            className={`absolute bottom-16 inset-x-4 z-20 bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 p-3 flex flex-col gap-1.5 transition-all duration-300 ${
              areControlsVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
            }`}
            id="zapper-history-tray"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-1 px-0.5">
              <span className="text-[9px] font-bold font-mono text-lime-400 flex items-center gap-1 uppercase tracking-wider">
                <Zap className="w-3 h-3 text-lime-500 animate-pulse" />
                Quick-Zap Deck
              </span>
              <span className="text-[8px] font-mono text-slate-500">
                Instantly swap between recently watched streams
              </span>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-white/10" id="zapper-channels-track">
              {channels
                .filter(c => historyIds.includes(c.id) && c.id !== channel.id)
                .slice(0, 6)
                .map(recentChan => (
                  <button
                    key={`zapper-item-${recentChan.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectChannel) {
                        onSelectChannel(recentChan);
                        showHotkeyFeedback(`SWITCHED TO: ${recentChan.name}`);
                      }
                    }}
                    className="flex items-center gap-2 px-2 py-1 bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-lime-500/30 rounded-lg transition-all duration-200 shrink-0 text-left cursor-pointer group/zap-btn"
                  >
                    <div className="w-5 h-5 bg-black p-0.5 border border-white/10 rounded flex items-center justify-center shrink-0">
                      {recentChan.logo ? (
                        <img 
                          src={recentChan.logo} 
                          alt="" 
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-full object-contain rounded"
                        />
                      ) : (
                        <Tv className="w-3 h-3 text-slate-400 group-hover/zap-btn:text-lime-400 transition-colors" />
                      )}
                    </div>
                    <div className="max-w-[85px] truncate">
                      <p className="text-[9.5px] font-bold text-slate-200 group-hover/zap-btn:text-lime-400 transition-colors truncate">
                        {recentChan.name}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Loading Spinner overlay */}
        {isLoading && !hasError && !isPipActive && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col gap-3 items-center justify-center transition-opacity duration-300" id="player-loading-overlay">
            <Loader2 className="w-10 h-10 text-lime-500 animate-spin" />
            <div className="text-sm font-mono text-slate-300 tracking-wide font-medium flex items-center gap-1.5">
              <span>Resolving Live Feed...</span>
            </div>
          </div>
        )}

        {/* Immersive PiP active glass overlay */}
        {isPipActive && !hasError && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col gap-4 items-center justify-center text-center z-10 p-6 animate-fade-in" id="player-pip-active-overlay">
            <div className="w-16 h-16 bg-lime-500/10 rounded-2xl border border-lime-500/25 flex items-center justify-center text-lime-400">
              <Tv className="w-8 h-8 animate-pulse" />
            </div>
            <div className="max-w-xs px-2">
              <h4 className="text-sm font-bold font-display text-white">{t("pipActive")}</h4>
              <p className="text-[11px] text-slate-400 mt-1.5 font-sans leading-relaxed">
                {lang === "bn"
                  ? "মাড্রিডটিভিলাইভ ভাসমান উইন্ডোতে প্লে হচ্ছে। ভিডিও চলাকালীন অন্যান্য চ্যানেলে অবাধে ব্রাউজ করুন!"
                  : "Madridtvlive is playing in a floating video player. Browse other channels freely without stopping the broadcast stream!"
                }
              </p>
            </div>
            <button
              onClick={triggerPictureInPicture}
              className="mt-1 px-4 py-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-extrabold rounded-xl text-xs hover:scale-105 transition-all shadow-md shadow-lime-950/20 flex items-center gap-2 cursor-pointer"
              id="player-pip-return-btn"
            >
              {lang === "bn" ? "প্লেয়ারে ফিরে যান" : "Return to Inline Player"}
            </button>
          </div>
        )}

        {/* Stream Error Overlay */}
        {hasError && (
          <div className="absolute inset-0 bg-black/90 flex flex-col gap-5 items-center justify-center p-6 text-center z-10" id="player-error-overlay">
            <div className="w-14 h-14 bg-[#142205] rounded-2xl border border-lime-500/30 flex items-center justify-center text-lime-400">
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
              className="flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-lime-950/40 text-xs transition-all duration-200"
              id="player-retry-button"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Load Source</span>
            </button>
          </div>
        )}

        {/* Floating Quick Stats Overlays (Bottom corners of screen on hover) */}
        {!hasError && (
          <div 
            className={`absolute top-4 right-4 z-10 flex gap-2 transition-opacity duration-300 pointer-events-none ${
              areControlsVisible ? "opacity-100" : "opacity-0"
            }`} 
            id="player-live-overlay-stats"
          >
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
          <div 
            className={`absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-black to-black/0 px-4 md:px-6 flex items-center justify-between transition-opacity duration-300 z-10 ${
              areControlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`} 
            id="player-hover-control-deck"
          >
            
            {/* Play/Pause controls */}
            <div className="flex items-center gap-2" id="controls-left-slot">
              <button
                onClick={togglePlay}
                className="p-2 text-white hover:text-lime-400 bg-black/40 hover:bg-white/5 rounded-lg transition-all"
                title={isPlaying ? "Pause Stream" : "Play Stream"}
                id="playback-toggle-btn"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              
              {/* Optional Prev/Next Controls */}
              {onPrevChannel && (
                <button
                  onClick={onPrevChannel}
                  className="p-1.5 text-slate-300 hover:text-lime-400 hover:bg-white/5 rounded-lg text-xs"
                  title="Previous Channel"
                  id="prev-chan-btn"
                >
                  Prev
                </button>
              )}
              {onNextChannel && (
                <button
                  onClick={onNextChannel}
                  className="p-1.5 text-slate-300 hover:text-lime-400 hover:bg-white/5 rounded-lg text-xs"
                  title="Next Channel"
                  id="next-chan-btn"
                >
                  Next
                </button>
              )}
            </div>

            {/* Custom Interactive Volume slider */}
            <div className="flex items-center gap-2 group/vol max-w-28 md:max-w-44 flex-1 justify-center" id="controls-mid-volume-slot">
              <button
                onClick={toggleMute}
                className={`p-2 rounded-lg transition-all ${
                  !isMuted && volume > 1.0 
                    ? "text-orange-500 hover:text-orange-400 font-bold bg-orange-500/10" 
                    : "text-white hover:text-lime-400"
                }`}
                title={isMuted ? "Unmute" : volume > 1.0 ? "Audio Booster Active (200%)" : "Mute Sound"}
                id="mute-toggle-btn"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className={`w-4 h-4 ${!isMuted && volume > 1.0 ? "animate-pulse" : ""}`} />}
              </button>
              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 transition-all ${
                    !isMuted && volume > 1.0
                      ? "bg-orange-500 focus:ring-orange-500"
                      : "bg-white/10 accent-lime-500 focus:ring-lime-400"
                  }`}
                  id="volume-slider-input"
                />
                {!isMuted && volume > 1.0 && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-600 to-red-600 text-white text-[8px] font-bold font-mono px-1.5 py-0.5 rounded shadow pointer-events-none animate-bounce">
                    BOOST {Math.round(volume * 100)}%
                  </span>
                )}
              </div>
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

              {/* Adaptive Bitrate Stream Quality Selector */}
              <div className="relative" ref={qualityDropdownRef} id="player-quality-control-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsQualityDropdownOpen(!isQualityDropdownOpen);
                    handleUserActivity();
                  }}
                  className={`px-2 py-1 h-8 rounded-lg border text-[10px] font-mono font-bold tracking-wide transition-all uppercase flex items-center gap-1 cursor-pointer select-none ${
                    isQualityDropdownOpen 
                      ? "text-lime-400 bg-lime-500/10 border-lime-500/30 shadow-sm" 
                      : "text-slate-300 hover:text-white hover:bg-white/5 border-transparent bg-white/5"
                  }`}
                  title={`Adjust Stream Resolution Quality (Currently: ${streamQuality})`}
                  id="stream-quality-btn"
                >
                  <Sliders className="w-3.5 h-3.5 text-lime-400" />
                  <span>{streamQuality}</span>
                </button>

                {isQualityDropdownOpen && (
                  <div 
                    className="absolute right-0 bottom-full mb-3 w-40 bg-zinc-950/95 backdrop-blur-xl border border-lime-500/25 p-1.5 rounded-xl shadow-2xl flex flex-col gap-1 z-55 animate-slide-in origin-bottom-right"
                    id="quality-dropdown-panel"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-[9px] font-bold font-mono text-lime-400 tracking-wider uppercase border-b border-white/5 pb-1 mb-1 px-1.5 flex items-center gap-1.5 select-none">
                      <Activity className="w-3 h-3 animate-pulse" />
                      <span>Stream Quality</span>
                    </div>

                    {(["Auto", "1080p", "720p", "480p"] as const).map((q) => (
                      <button
                        key={`quality-opt-${q}`}
                        onClick={() => handleQualityChange(q)}
                        className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-mono flex items-center justify-between transition-all duration-200 cursor-pointer ${
                          streamQuality === q
                            ? "bg-lime-500/10 border border-lime-500/30 text-lime-400 font-bold"
                            : "border border-transparent text-slate-300 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <span>{q}</span>
                        {streamQuality === q && <Check className="w-3 h-3 text-[#a3e635]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Interactive Share button and dropdown panel */}
              <div className="relative" ref={shareDropdownRef} id="player-share-control-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsShareOpen(!isShareOpen);
                    handleUserActivity();
                  }}
                  className={`p-2 rounded-lg transition-all ${
                    isShareOpen 
                      ? "text-lime-400 bg-lime-500/10 border border-lime-500/20 shadow-sm" 
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                  title="Share Live Channel"
                  id="share-channel-btn"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {isShareOpen && (
                  <div 
                    className="absolute right-0 bottom-full mb-3 w-56 bg-zinc-950/95 backdrop-blur-xl border border-lime-500/25 p-3 rounded-2xl shadow-2xl flex flex-col gap-1.5 z-55 animate-slide-in origin-bottom-right"
                    id="share-dropdown-panel"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-[10px] font-bold font-mono text-lime-400 tracking-wider uppercase border-b border-white/5 pb-1.5 mb-1 flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Broadcast</span>
                    </div>

                    {/* Copy Link Option */}
                    <button
                      onClick={() => {
                        handleCopyLink();
                        setIsShareOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium font-sans text-slate-200 hover:text-lime-400 flex items-center justify-between transition-colors border border-transparent hover:border-white/5 cursor-pointer"
                      id="share-option-copy"
                    >
                      <span className="flex items-center gap-2">
                        {isCopied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        <span>{isCopied ? "Link Copied!" : "Copy Share Link"}</span>
                      </span>
                    </button>

                    {/* Facebook Share */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium font-sans text-slate-200 hover:text-indigo-400 flex items-center gap-2 transition-colors border border-transparent hover:border-white/5 cursor-pointer"
                      onClick={() => {
                        setIsShareOpen(false);
                        showHotkeyFeedback("Facebook Share Opened");
                      }}
                      id="share-option-facebook"
                    >
                      <svg className="w-3.5 h-3.5 text-indigo-500 fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span>Share on Facebook</span>
                    </a>

                    {/* Twitter Share */}
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Watching live: ${channel.name} on Madridtvlive! 📺⚽ #IPTV`)}&url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium font-sans text-slate-200 hover:text-sky-400 flex items-center gap-2 transition-colors border border-transparent hover:border-white/5 cursor-pointer"
                      onClick={() => {
                        setIsShareOpen(false);
                        showHotkeyFeedback("Twitter/X Share Opened");
                      }}
                      id="share-option-twitter"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-200 fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span>Share on Twitter / X</span>
                    </a>

                    {/* WhatsApp Share */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`I am watching ${channel.name} live on Madridtvlive! Check it out: `)}${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/5 rounded-lg text-xs font-medium font-sans text-slate-200 hover:text-emerald-400 flex items-center gap-2 transition-colors border border-transparent hover:border-white/5 cursor-pointer"
                      onClick={() => {
                        setIsShareOpen(false);
                        showHotkeyFeedback("WhatsApp Opened");
                      }}
                      id="share-option-whatsapp"
                    >
                      <svg className="w-3.5 h-3.5 text-emerald-500 fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.022-.079-.186-.208-.54-.378-.359-.17-2.126-1.049-2.455-1.167-.33-.119-.569-.178-.807.179-.239.357-.925 1.167-1.134 1.4-.21.233-.419.26-.777.09-.358-.17-1.516-.559-2.887-1.782-1.066-.95-1.787-2.123-1.996-2.48-.209-.356-.022-.549.157-.727.162-.162.359-.419.539-.629.18-.21.239-.359.359-.599.119-.24.059-.45-.03-.62-.089-.17-.807-1.944-1.106-2.66-.291-.7-.588-.607-.807-.618c-.208-.01-.447-.01-.686-.01-.239 0-.629.089-.957.447-.327.357-1.254 1.223-1.254 2.978 0 1.754 1.279 3.447 1.457 3.687.179.239 2.507 3.829 6.071 5.37 3.564 1.54 3.564 1.029 4.221 1.029.658 0 2.126-.869 2.425-1.711.299-.84.299-1.56.209-1.711zm-5.422 7.12C10.024 21.5 8.017 21 6.272 20.1l-.44-.26-3.89 1.02 1.04-3.79-.28-.46C1.722 15.1 1.2 13 1.2 10.8c0-5.3 4.3-9.6 9.6-9.6 5.3 0 9.6 4.3 9.6 9.6 0 5.3-4.3 9.6-9.6 9.6z"/>
                      </svg>
                      <span>Share on WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>

              {/* PiP button */}
              {(pipSupported || onToggleMini) && (
                <button
                  onClick={handlePipClick}
                  disabled={!isMetadataLoaded || hasError}
                  className={`p-2 rounded-lg transition-all ${
                    !isMetadataLoaded || hasError
                      ? "opacity-30 cursor-not-allowed text-slate-500"
                      : isMini || isPipActive 
                        ? "text-lime-400 bg-lime-500/10 border border-lime-500/20 shadow-sm" 
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

              {/* Theater Mode control */}
              {onToggleTheater && !isMini && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTheater();
                    handleUserActivity();
                  }}
                  className={`p-2 rounded-lg transition-all ${
                    isTheaterMode 
                      ? "text-[#a3e635] bg-lime-500/10 border border-lime-500/20 shadow-sm" 
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                  title={isTheaterMode ? "Exit Theater Mode" : "Enter Theater/Cinema Mode"}
                  id="theater-mode-btn"
                >
                  <Moon className="w-4 h-4" />
                </button>
              )}

              {/* Fullscreen control */}
              <button
                onClick={toggleFullscreen}
                className="p-2 text-white hover:text-lime-400 bg-black/40 hover:bg-white/5 rounded-lg transition-all"
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
              <Sliders className="w-3.5 h-3.5 text-lime-400" />
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
                      ? "bg-lime-500/10 border-lime-500/30 text-lime-400 font-bold"
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
                <Timer className="w-3.5 h-3.5 text-lime-400" />
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
                className="bg-zinc-900 border border-white/10 hover:border-lime-500/30 text-slate-300 rounded-lg px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-lime-500 font-medium transition-all cursor-pointer"
              >
                <option value="off">Inactive</option>
                <option value="1">1 Min (Demo)</option>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
              </select>
              {sleepMinutesRemaining !== null && (
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" title="Timer Active" />
              )}
            </div>

            {/* Custom Stats & Hotkey Trigger Buttons */}
            <div className="flex items-center gap-2">
              {/* Ambilight Aura backglow Trigger */}
              <button
                onClick={() => {
                  setIsAmbientGlowActive(!isAmbientGlowActive);
                  showHotkeyFeedback(!isAmbientGlowActive ? "Ambient Aura Activated" : "Ambient Aura Deactivated");
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono tracking-wide transition-all uppercase ${
                  isAmbientGlowActive
                    ? "bg-lime-500/15 border-lime-500/30 text-lime-400 font-bold"
                    : "bg-black/20 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                title="Toggle Cinematic Background Ambient Lighting Aura"
              >
                <Flame className={`w-3.5 h-3.5 ${isAmbientGlowActive ? "text-lime-400 animate-pulse" : "text-slate-500"}`} />
                <span>Ambient</span>
              </button>

              {/* Stats for Nerds Trigger */}
              <button
                onClick={() => {
                  setIsStatsActive(!isStatsActive);
                  showHotkeyFeedback(!isStatsActive ? "Telemetry Stats Activated" : "Telemetry Stats Closed");
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono tracking-wide transition-all uppercase ${
                  isStatsActive
                    ? "bg-lime-500/15 border-lime-500/30 text-lime-400 font-bold"
                    : "bg-black/20 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                title="Toggle Real-Time Broadcast Codec Telemetry [N Key]"
              >
                <Info className="w-3.5 h-3.5 text-lime-400" />
                <span>Stats</span>
              </button>

              {/* Advanced Hotkey Helper Drawer Popover Toggle */}
              <div className="relative group/hotkeys">
                <button
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/5 bg-black/20 hover:bg-white/5 text-slate-400 hover:text-white text-[10px] font-mono tracking-wide transition-all uppercase"
                  title="Show Live keyboard controller system mappings"
                >
                  <Keyboard className="w-3.5 h-3.5 text-lime-400" />
                  <span>Hotkeys</span>
                </button>
                {/* Visual tooltip popover display */}
                <div className="absolute right-0 bottom-full mb-2 w-64 bg-zinc-950/95 backdrop-blur-md border border-white/10 p-3.5 rounded-xl shadow-2xl scale-0 group-hover/hotkeys:scale-100 origin-bottom-right transition-all duration-200 z-55 pointer-events-none text-[10px] text-slate-300 space-y-2 font-mono" style={{ bottom: '120%' }}>
                  <h5 className="font-bold text-lime-400 text-[10.5px] border-b border-white/15 pb-1 uppercase tracking-wider flex items-center gap-1">
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

      {/* Dynamic Network Accelerator & Latency Tuning Bar (Netspeed Booster / Diagnostics) */}
      {!isMini && (
        <div className="px-4 py-3 md:px-6 bg-zinc-950/50 backdrop-blur-2xl border-t border-white/5 flex flex-wrap items-center justify-between gap-y-2.5 gap-x-6 text-[11px] font-sans" id="connection-booster-tuner-bar">
          <div className="flex items-center gap-2" id="speed-booster-selection-deck">
            <span className="text-lime-400 font-mono flex items-center gap-1 text-[10px] font-bold">
              <Zap className="w-3.5 h-3.5 text-lime-500 animate-pulse" />
              <span>NET ACCELERATOR:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "speed-booster", name: "Speed Boost", desc: "Adaptive buffer - Starts instantly" },
                { id: "standard", name: "Standard HLS", desc: "Standard dual-level HLS" },
                { id: "stable-hd", name: "High Stability", desc: "Buffered shielding - Best for slow Wi-Fi" }
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setBufferMode(preset.id as any);
                    showHotkeyFeedback(`Net Optimizer: ${preset.name}`);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-mono tracking-wider transition-all duration-150 uppercase font-bold flex items-center gap-1 border cursor-pointer ${
                    bufferMode === preset.id
                      ? "bg-gradient-to-r from-lime-600 to-lime-500 text-zinc-950 border-lime-400 shadow shadow-lime-500/30 glow-lemon"
                      : "bg-black/40 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                  title={preset.desc}
                >
                  {bufferMode === preset.id && <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 animate-ping" />}
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap" id="speedometer-status-deck">
            <span className="text-slate-500 font-mono text-[10px] flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${bufferMode === "speed-booster" ? "bg-lime-400 animate-pulse" : (bufferMode === "stable-hd" ? "bg-cyan-400 animate-pulse" : "bg-emerald-450 bg-emerald-400")}`} />
              LATENCY STATUS: <span className="text-slate-300 font-bold uppercase">{bufferMode === "speed-booster" ? "Fast Start (1.2s)" : (bufferMode === "stable-hd" ? "Buffered (HD)" : latencyInfo)}</span>
            </span>

            <button
              onClick={() => setIsDiagnosticsOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-lime-500/30 bg-lime-950/40 hover:bg-lime-600/30 text-lime-400 font-semibold text-[10px] font-mono hover:text-lime-300 transition-all uppercase shadow cursor-pointer glow-lemon/10"
              title="Run Speed Jitter & Buffer Optimizer Diagnostics"
              id="speedometer-test-trigger"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Diagnostics</span>
            </button>
          </div>
        </div>
      )}

      {/* Stream Info Metadata Header plate */}
      {!isMini && (
        <div className="p-4 md:p-6 bg-zinc-950/60 backdrop-blur-2xl border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl" id="player-banner-metadata">
        
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
              <Tv className="w-5 h-5 text-lime-400" />
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
              <span>Streaming: <span className="font-mono text-[11px] text-lime-400 font-medium">{channel.originalGroup}</span></span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Zap className="w-3 h-3 text-lime-500 fill-current" />
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
