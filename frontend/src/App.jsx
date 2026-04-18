import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { api } from './utils/api';
import { useSSE } from './hooks/useSSE';
import ControlPanel from './components/ControlPanel';
import MapView from './components/MapView';
import DroneView from './components/DroneView';
import LogPanel from './components/LogPanel';
import WeatherPanel from './components/WeatherPanel';

const MAX_LOGS = 200;

const Toast = forwardRef((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('error');
  const timerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    show(msg, t = 'error') {
      setMessage(msg);
      setType(t);
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 4000);
    },
  }));

  if (!visible) return null;
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-medium
      ${type === 'error'
        ? 'bg-red-50 border-red-200 text-red-800 shadow-red-100'
        : 'bg-amber-50 border-amber-200 text-amber-800 shadow-amber-100'}`}>
      <AlertTriangle size={15} className={type === 'error' ? 'text-red-500' : 'text-amber-500'} />
      {message}
    </div>
  );
});

export default function App() {
  const [activeView, setActiveView] = useState('map');
  const [status, setStatus] = useState('idle');
  const [missionId, setMissionId] = useState(null);
  const [dronePosition, setDronePosition] = useState(null);
  const [progress, setProgress] = useState(0);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [detections, setDetections] = useState([]);
  const [logs, setLogs] = useState([]);
  const [weather, setWeather] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [simulationTime, setSimulationTime] = useState(0);
  const [videoPath, setVideoPath] = useState('');
  const [droneId, setDroneId] = useState('DRONE-01');
  const toastRef = useRef(null);
  const yoloLogCooldownRef = useRef(new Map());

  const addLog = useCallback((level, message, ts) => {
    setLogs(prev => {
      const entry = { id: Date.now() + Math.random(), level, message, timestamp: ts ?? 0 };
      return [...prev.slice(-MAX_LOGS + 1), entry];
    });
  }, []);

  const handleYoloDetection = useCallback((dets, ts) => {
    const now = Date.now();

    dets.forEach(d => {
      const key = [
        d.className,
        d.severity,
        Math.round((d.confidence || 0) * 20),
        Math.round((d.bbox?.x || 0) / 48),
        Math.round((d.bbox?.y || 0) / 48),
      ].join('|');

      const lastSeen = yoloLogCooldownRef.current.get(key) || 0;
      if (now - lastSeen < 1500) return;

      yoloLogCooldownRef.current.set(key, now);
      const level = d.isAnomaly ? 'warning' : 'info';
      addLog(level,
        `YOLO: ${d.className} — ${(d.confidence * 100).toFixed(0)}% conf · ${d.severity} severity`,
        parseFloat(ts.toFixed(1))
      );
    });

    if (yoloLogCooldownRef.current.size > 300) {
      const cutoff = now - 10000;
      for (const [key, timestamp] of yoloLogCooldownRef.current.entries()) {
        if (timestamp < cutoff) yoloLogCooldownRef.current.delete(key);
      }
    }
  }, [addLog]);

  useEffect(() => {
    api.get('/api/routes')
      .then(r => { setRoutes(r); if (r.length > 0) setSelectedRoute(r[0].id); })
      .catch(() => addLog('warning', 'Could not load routes from backend — is the server running?', 0));
  }, [addLog]);

  useEffect(() => {
    if (!selectedRoute) return;
    api.get(`/api/routes/${selectedRoute}`).then(setRouteData).catch(() => {});
  }, [selectedRoute]);

  useSSE(missionId, {
    drone_position: (e) => {
      setDronePosition({ lat: e.lat, lng: e.lng, altitude: e.altitude, heading: e.heading });
      setProgress(e.progress);
      setSimulationTime(e.simulationTime);
      setAnomalyCount(e.anomalyCount);
    },
    detection: (e) => {
      setDetections(prev => [...prev, e.detection]);
      if (e.detection.isAnomaly) {
        toastRef.current?.show(`${e.detection.severity.toUpperCase()} — ${e.detection.className} at Tower ${e.detection.waypointId + 1}`, 'error');
      }
    },
    log: (e) => addLog(e.level, e.message, e.timestamp),
    inspection_complete: (e) => {
      setStatus('complete');
      setProgress(100);
      addLog('success', `Mission complete — ${e.anomalyCount} anomalies, ${e.detectionsCount} detections in ${e.duration}s`, parseFloat(e.duration));
    },
    inspection_reset: () => {
      setStatus('idle'); setProgress(0); setDronePosition(null);
      setDetections([]); setSimulationTime(0); setAnomalyCount(0);
    },
    inspection_status: (e) => setStatus(e.status),
    state_snapshot: (e) => {
      setStatus(e.status); setProgress(e.progress); setAnomalyCount(e.anomalyCount);
      if (e.detections?.length) setDetections(e.detections);
    },
  });

  const handleStart = async () => {
    if (!selectedRoute) return;
    try {
      setDetections([]); setLogs([]); setProgress(0); setAnomalyCount(0); setSimulationTime(0);
      addLog('info', 'Initializing inspection mission...', 0);
      const data = await api.post('/api/inspection/start', {
        name: `Inspection ${new Date().toLocaleTimeString()}`,
        droneId, routeId: selectedRoute,
        videoPath: videoPath || undefined,
      });
      setMissionId(data.missionId);
      setStatus('running');
      if (data.weather) {
        setWeather(data.weather);
        addLog('info',
          `Weather: ${data.weather.condition} | Wind: ${data.weather.windSpeed?.toFixed(1)}m/s | Temp: ${data.weather.temperature?.toFixed(1)}°C | ${data.weather.flightSafe ? 'FLIGHT SAFE' : 'WIND WARNING'}`,
          0);
      }
      addLog('success', `Mission started — ID: ${data.missionId}`, 0);
    } catch (err) {
      addLog('error', `Failed to start mission: ${err.message}`, 0);
    }
  };

  const handlePause = async () => {
    if (!missionId) return;
    try {
      const res = await api.post('/api/inspection/pause', { missionId });
      setStatus(res.status);
    } catch (err) { addLog('error', `Pause failed: ${err.message}`, 0); }
  };

  const handleReset = async () => {
    if (!missionId) return;
    try {
      await api.post('/api/inspection/reset', { missionId });
      setStatus('idle'); setProgress(0); setDetections([]);
      setDronePosition(null); setSimulationTime(0); setAnomalyCount(0); setLogs([]);
    } catch (err) { addLog('error', `Reset failed: ${err.message}`, 0); }
  };

  const statusDot = {
    idle:     'bg-gray-300',
    running:  'bg-emerald-500 animate-pulse',
    paused:   'bg-amber-400',
    complete: 'bg-blue-500',
  }[status] || 'bg-gray-300';

  const statusLabel = {
    idle: 'Standby', running: 'Inspecting', paused: 'Paused', complete: 'Complete',
  }[status] || 'Standby';

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-black overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-black/6 shadow-sm z-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo mark — magenta only, no brand name */}
          <div className="w-9 h-9 bg-[#E4007F] rounded-xl flex items-center justify-center shadow-md shadow-[#E4007F]/25">
            <Zap size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-black leading-none">DroneGuard</h1>
            <p className="text-[10px] text-black font-mono tracking-widest mt-0.5 uppercase">Energy Infrastructure Inspection</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {weather && <WeatherPanel weather={weather} />}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusDot}`} />
            <span className="text-xs text-black font-mono uppercase tracking-widest">{statusLabel}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ControlPanel
          status={status} progress={progress} anomalyCount={anomalyCount}
          routes={routes} selectedRoute={selectedRoute} droneId={droneId}
          videoPath={videoPath} activeView={activeView} simulationTime={simulationTime}
          detections={detections} onSelectRoute={setSelectedRoute}
          onSetDroneId={setDroneId} onSetVideoPath={setVideoPath}
          onStart={handleStart} onPause={handlePause} onReset={handleReset}
          onViewChange={setActiveView}
        />

        <main className="flex-1 relative overflow-hidden">
          {activeView === 'map' ? (
            <MapView routeData={routeData} dronePosition={dronePosition} detections={detections} progress={progress} />
          ) : (
            <DroneView
              videoPath={videoPath} detections={detections} simulationTime={simulationTime}
              dronePosition={dronePosition} progress={progress} anomalyCount={anomalyCount}
              droneId={droneId} status={status} onYoloDetection={handleYoloDetection}
            />
          )}
        </main>

        <LogPanel logs={logs} />
      </div>

      <Toast ref={toastRef} />
    </div>
  );
}
