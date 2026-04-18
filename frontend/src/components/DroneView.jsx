import { useEffect, useRef, useState } from 'react';
import { Camera, Wifi, AlertTriangle, Navigation, Cpu } from 'lucide-react';

const SEVERITY_COLOR = { high: '#ef4444', medium: '#eab308', low: '#3b82f6' };

export default function DroneView({
  videoPath, detections, simulationTime, dronePosition,
  progress, anomalyCount, droneId, status, onYoloDetection,
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const offscreen = useRef(typeof document !== 'undefined' ? document.createElement('canvas') : null);
  const frameHandleRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const inferenceInFlightRef = useRef(false);
  const processedFrameRef = useRef(0);

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [yoloDets, setYoloDets] = useState([]);
  const [yoloOnline, setYoloOnline] = useState(false);
  const [inferMs, setInferMs] = useState(null);
  const [overlayBox, setOverlayBox] = useState(null);

  // Mock detections (only shown when YOLO is offline or no video)
  const mockDets = detections.filter(d =>
    simulationTime >= d.timestamp && simulationTime < d.timestamp + 3
  );

  // Active detections for HUD — prefer real YOLO, fall back to mock
  const hudDets = yoloOnline && videoLoaded ? yoloDets : mockDets;

  // Sync video playback with simulation clock
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoLoaded) return;
    if (Math.abs(video.currentTime - simulationTime) > 0.5) video.currentTime = simulationTime;
    if (status === 'running' && video.paused)  video.play().catch(() => {});
    if (status === 'paused'  && !video.paused) video.pause();
  }, [simulationTime, status, videoLoaded]);

  // Keep the overlay sized to the actual rendered video area.
  useEffect(() => {
    if (!videoLoaded) {
      setOverlayBox(null);
      return;
    }

    const updateOverlayBox = () => {
      const container = containerRef.current;
      const video = videoRef.current;
      if (!container || !video || !video.videoWidth || !video.videoHeight) {
        setOverlayBox(null);
        return;
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const scale = Math.min(containerWidth / video.videoWidth, containerHeight / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;

      setOverlayBox({
        left: (containerWidth - width) / 2,
        top: (containerHeight - height) / 2,
        width,
        height,
        sourceWidth: video.videoWidth,
        sourceHeight: video.videoHeight,
      });
    };

    updateOverlayBox();

    const container = containerRef.current;
    const observer = typeof ResizeObserver !== 'undefined' && container
      ? new ResizeObserver(updateOverlayBox)
      : null;

    if (observer && container) observer.observe(container);
    window.addEventListener('resize', updateOverlayBox);

    return () => {
      window.removeEventListener('resize', updateOverlayBox);
      observer?.disconnect();
    };
  }, [videoLoaded, videoPath]);

  // Real-time YOLO inference loop: analyze every 3rd frame, up to ~20 FPS for 60 FPS video.
  useEffect(() => {
    const video = videoRef.current;
    if (!videoLoaded || !video || status !== 'running') {
      setYoloDets([]);
      return;
    }

    let cancelled = false;
    processedFrameRef.current = 0;

    const runInference = async () => {
      if (cancelled || inferenceInFlightRef.current || video.paused || video.ended || !video.videoWidth) return;

      inferenceInFlightRef.current = true;
      const oc = offscreen.current;
      oc.width = video.videoWidth;
      oc.height = video.videoHeight;
      oc.getContext('2d').drawImage(video, 0, 0);
      const t0 = performance.now();

      try {
        const base64 = oc.toDataURL('image/jpeg', 0.8).split(',')[1];
        const res = await fetch('http://localhost:8000/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64,
            timestamp: video.currentTime,
            confidence_threshold: 0.20,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();

        setYoloOnline(true);
        setInferMs(Math.round(performance.now() - t0));
        setYoloDets(data.detections || []);

        if (data.detections?.length > 0) {
          onYoloDetection?.(data.detections, video.currentTime);
        }
      } catch {
        setYoloOnline(false);
        setYoloDets([]);
      } finally {
        inferenceInFlightRef.current = false;
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;

      if (typeof video.requestVideoFrameCallback === 'function') {
        frameHandleRef.current = video.requestVideoFrameCallback(() => {
          processedFrameRef.current += 1;
          if (processedFrameRef.current % 3 === 0) {
            void runInference();
          }
          scheduleNext();
        });
        return;
      }

      fallbackTimerRef.current = setTimeout(() => {
        void runInference();
        scheduleNext();
      }, 50);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (typeof video.cancelVideoFrameCallback === 'function' && frameHandleRef.current != null) {
        video.cancelVideoFrameCallback(frameHandleRef.current);
      }
      clearTimeout(fallbackTimerRef.current);
      inferenceInFlightRef.current = false;
    };
  }, [videoLoaded, status, onYoloDetection]);

  const videoUrl = videoPath
    ? (videoPath.startsWith('http') ? videoPath : `/videos/${encodeURI(videoPath)}`)
    : null;

  const isRunning = status === 'running';
  const showYoloOverlay = yoloOnline && overlayBox && yoloDets.length > 0;

  const renderOverlay = () => {
    if (!showYoloOverlay) return null;

    const scaleX = overlayBox.width / overlayBox.sourceWidth;
    const scaleY = overlayBox.height / overlayBox.sourceHeight;

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${overlayBox.left}px`,
          top: `${overlayBox.top}px`,
          width: `${overlayBox.width}px`,
          height: `${overlayBox.height}px`,
        }}
      >
        {yoloDets.map((det, index) => {
          const color = SEVERITY_COLOR[det.severity] || '#3b82f6';
          const left = det.bbox.x * scaleX;
          const top = det.bbox.y * scaleY;
          const width = det.bbox.w * scaleX;
          const height = det.bbox.h * scaleY;

          return (
            <div
              key={det.id ?? `${det.className}-${index}`}
              className="absolute"
              style={{ left, top, width, height }}
            >
              <div
                className="absolute inset-0 rounded-md border-2"
                style={{ borderColor: color, boxShadow: `0 0 0 1px rgba(0,0,0,0.35) inset` }}
              />
              <div
                className="absolute left-0 top-0 -translate-y-full rounded-t-md px-2 py-1 text-[10px] font-mono font-semibold text-white whitespace-nowrap"
                style={{ backgroundColor: color, maxWidth: '100%' }}
              >
                {det.className} {(det.confidence * 100).toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {videoUrl ? (
        <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            src={videoUrl}
            crossOrigin="anonymous"
            onLoadedData={() => setVideoLoaded(true)}
            onLoadedMetadata={() => setVideoLoaded(true)}
            onError={() => {
              setVideoLoaded(false);
              setYoloOnline(false);
            }}
            muted
            playsInline
          />
          {renderOverlay()}
        </div>
      ) : (
        <NoVideoView simulationTime={simulationTime} droneId={droneId} />
      )}

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top-left */}
        <div className="absolute top-4 left-4 space-y-2">
          <HUDTag
            icon={<Wifi size={12} />}
            label={isRunning ? 'LIVE' : status.toUpperCase()}
            color={isRunning ? 'text-emerald-400' : 'text-white/40'}
            pulse={isRunning}
          />
          <HUDTag icon={<Navigation size={12} />} label={droneId} color="text-blue-400" />
          <HUDTag
            icon={<Cpu size={12} />}
            label={yoloOnline ? `AI ${inferMs ? inferMs + 'ms' : '…'}` : 'AI OFFLINE'}
            color={yoloOnline ? 'text-[#E4007F]' : 'text-white/30'}
            pulse={yoloOnline && isRunning}
          />
          {dronePosition && (
            <HUDBox>
              <HUDLine label="LAT" value={dronePosition.lat.toFixed(6)} />
              <HUDLine label="LNG" value={dronePosition.lng.toFixed(6)} />
              <HUDLine label="ALT" value={`${dronePosition.altitude?.toFixed(0) ?? '--'}m`} />
            </HUDBox>
          )}
        </div>

        {/* Top-right */}
        <div className="absolute top-4 right-4 space-y-2 text-right">
          <HUDBox>
            <HUDLine label="PROGRESS"  value={`${progress.toFixed(1)}%`} />
            <HUDLine label="TIME"      value={`T+${simulationTime.toFixed(0)}s`} />
            <HUDLine label="ANOMALIES" value={String(anomalyCount)}
              color={anomalyCount > 0 ? 'text-red-400' : 'text-white/80'} />
            {yoloOnline && (
              <HUDLine label="AI DETS" value={String(yoloDets.length)} color="text-[#E4007F]" />
            )}
          </HUDBox>
        </div>

        {/* Bottom: active detections */}
        {hudDets.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 flex gap-2 flex-wrap">
            {hudDets.slice(0, 6).map((d, i) => (
              <div key={d.id ?? i}
                className="flex items-center gap-2 bg-black/80 border border-red-500/30 rounded-lg px-3 py-2 text-xs font-mono backdrop-blur-sm">
                <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                <span className="text-red-300 font-semibold uppercase">{d.className}</span>
                <span className="text-white/40">|</span>
                <span className="text-white/60">{(d.confidence * 100).toFixed(0)}% conf</span>
                <span className="text-white/40">|</span>
                <span className={`uppercase ${d.severity === 'high' ? 'text-red-400' : d.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {d.severity}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Crosshair */}
        {isRunning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute top-0 left-1/2 w-px h-4 bg-white/20 -translate-x-px" />
              <div className="absolute bottom-0 left-1/2 w-px h-4 bg-white/20 -translate-x-px" />
              <div className="absolute left-0 top-1/2 h-px w-4 bg-white/20 -translate-y-px" />
              <div className="absolute right-0 top-1/2 h-px w-4 bg-white/20 -translate-y-px" />
              <div className="absolute inset-0 m-auto w-4 h-4 border border-white/30 rounded-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoVideoView({ simulationTime, droneId }) {
  return (
    <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(#E4007F 1px, transparent 1px), linear-gradient(90deg, #E4007F 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-24 h-24 relative">
          <div className="absolute inset-0 border-2 border-[#E4007F]/30 rounded-full animate-ping" />
          <div className="absolute inset-2 border border-[#E4007F]/50 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera size={28} className="text-[#E4007F]" />
          </div>
        </div>
        <div className="text-center font-mono">
          <p className="text-white/60 text-sm mb-1">DRONE CAMERA FEED</p>
          <p className="text-white/30 text-xs">{droneId} · T+{simulationTime.toFixed(0)}s</p>
        </div>
        <div className="text-center space-y-1">
          <p className="text-white/20 text-xs font-mono">Place video in project-root/videos/</p>
          <p className="text-white/20 text-xs font-mono">Enter filename in control panel</p>
        </div>
      </div>
    </div>
  );
}

function HUDTag({ icon, label, color, pulse }) {
  return (
    <div className={`inline-flex items-center gap-1.5 bg-black/70 border border-white/10 rounded px-2 py-1 text-xs font-mono backdrop-blur-sm ${color}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {icon}{label}
    </div>
  );
}

function HUDBox({ children }) {
  return (
    <div className="bg-black/70 border border-white/10 rounded-lg px-3 py-2 font-mono text-xs space-y-0.5 backdrop-blur-sm">
      {children}
    </div>
  );
}

function HUDLine({ label, value, color }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/30">{label}</span>
      <span className={color || 'text-white/80'}>{value}</span>
    </div>
  );
}
