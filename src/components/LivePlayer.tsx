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
  Heart
} from "lucide-react";
import { Channel } from "../types";
import { getCategoryBadgeStyles } from "./ChannelCard";

interface LivePlayerProps {
  channel: Channel;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPrevChannel?: () => void;
  onNextChannel?: () => void;
}

export default function LivePlayer({
  channel,
  isFavorite,
  onToggleFavorite,
  onPrevChannel,
  onNextChannel
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
    <div className="flex flex-col bg-black/40 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-orange-950/5" id="live-player-container-root">
      
      {/* Visual Canvas Player Area */}
      <div 
        ref={containerRef}
        className="relative bg-black aspect-video w-full flex items-center justify-center group overflow-hidden" 
        id="video-player-canvas-area"
      >
        <video
          ref={videoRef}
          className={`w-full h-full max-h-[60vh] rounded-t-2xl transition-all duration-300 ${videoFitStyle}`}
          preload="metadata"
          playsInline
          style={{ verticalAlign: 'middle' }}
        />

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
              {pipSupported && (
                <button
                  onClick={triggerPictureInPicture}
                  disabled={!isMetadataLoaded || hasError}
                  className={`p-2 rounded-lg transition-all ${
                    !isMetadataLoaded || hasError
                      ? "opacity-30 cursor-not-allowed text-slate-500"
                      : isPipActive 
                        ? "text-orange-400 bg-orange-500/10 border border-orange-500/20 shadow-sm" 
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                  title={
                    hasError 
                      ? "Stream Offline"
                      : !isMetadataLoaded 
                        ? "Waiting for live feed metadata..." 
                        : isPipActive 
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

      {/* Stream Info Metadata Header plate */}
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
    </div>
  );
}
