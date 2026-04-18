import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { api } from './utils/api';
import ControlPanel from './components/ControlPanel';
import MapView from './components/MapView';
import DroneView from './components/DroneView';
import LogPanel from './components/LogPanel';
import WeatherPanel from './components/WeatherPanel';
import AddDroneModal from './components/AddDroneModal';

const DRONE_COLORS = ['#E4007F', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

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

function buildCustomRouteData(waypoints) {
  return {
    id: `custom_${Date.now()}`,
    name: 'Trasa Własna',
    waypoints: waypoints.map((wp, i) => ({
      id: i,
      lat: wp.lat,
      lng: wp.lng,
      altitude: 80,
      timestamp: i * 10,
      name: `WP-${String(i + 1).padStart(3, '0')}`,
      type: 'waypoint',
    })),
    estimatedDuration: (waypoints.length - 1) * 10,
    totalDistance: 0,
    region: 'Custom',
    lineVoltage: 'N/A',
    operator: 'Manual',
  };
}

export default function App() {
  const [drones, setDrones] = useState(new Map());
  const [activeDroneId, setActiveDroneId] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [showAddModal, setShowAddModal] = useState(false);
  const [planningMode, setPlanningMode] = useState(false);
  const [customWaypoints, setCustomWaypoints] = useState([]);

  const toastRef = useRef(null);
  const eventSourcesRef = useRef(new Map()); // missionId -> EventSource
  const handleSSEEventRef = useRef(null);

  const activeDrone = drones.get(activeDroneId) || null;

  const updateDrone = useCallback((instanceId, updates) => {
    setDrones(prev => {
      const next = new Map(prev);
      const d = next.get(instanceId);
      if (!d) return prev;
      next.set(instanceId, typeof updates === 'function' ? updates(d) : { ...d, ...updates });
      return next;
    });
  }, []);

  // SSE handler kept fresh via ref to avoid stale closures
  handleSSEEventRef.current = (instanceId, event) => {
    switch (event.type) {
      case 'drone_position':
        updateDrone(instanceId, {
          dronePosition: { lat: event.lat, lng: event.lng, altitude: event.altitude, heading: event.heading },
          progress: event.progress,
          simulationTime: event.simulationTime,
          anomalyCount: event.anomalyCount,
          status: 'running',
        });
        break;
      case 'detection':
        updateDrone(instanceId, d => ({ ...d, detections: [...d.detections, event.detection] }));
        if (event.detection?.isAnomaly) {
          toastRef.current?.show(
            `${event.detection.severity?.toUpperCase()} — ${event.detection.className} at Tower ${event.detection.waypointId + 1}`,
            'error'
          );
        }
        break;
      case 'log':
        updateDrone(instanceId, d => ({
          ...d,
          logs: [...d.logs.slice(-199), {
            id: Date.now() + Math.random(),
            level: event.level,
            message: event.message,
            timestamp: event.timestamp,
          }],
        }));
        break;
      case 'inspection_complete':
        updateDrone(instanceId, { status: 'complete', progress: 100 });
        break;
      case 'inspection_reset':
        updateDrone(instanceId, {
          status: 'idle', progress: 0, dronePosition: null,
          detections: [], simulationTime: 0, anomalyCount: 0,
        });
        break;
      case 'inspection_status':
        updateDrone(instanceId, { status: event.status });
        break;
      case 'state_snapshot':
        updateDrone(instanceId, d => ({
          ...d,
          status: event.status,
          progress: event.progress,
          anomalyCount: event.anomalyCount,
          detections: event.detections?.length ? event.detections : d.detections,
        }));
        break;
    }
  };

  const connectDroneSSE = useCallback((missionId, instanceId) => {
    const existing = eventSourcesRef.current.get(missionId);
    if (existing) existing.close();
    const es = new EventSource(`http://localhost:3001/api/mission/${missionId}/stream`);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        handleSSEEventRef.current(instanceId, data);
      } catch (_) {}
    };
    eventSourcesRef.current.set(missionId, es);
  }, []);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => { eventSourcesRef.current.forEach(es => es.close()); };
  }, []);

  const handleSetVideoPath = useCallback((instanceId, path) => {
    updateDrone(instanceId, { videoPath: path });
  }, [updateDrone]);

  const handleAddDrone = useCallback(async (preset, droneId, videoPath = null, customRoute = null) => {
    const instanceId = `drone_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const colorIndex = [...drones.keys()].length % DRONE_COLORS.length;
    const color = DRONE_COLORS[colorIndex];
    const resolvedId = droneId || `DRONE-${String(drones.size + 1).padStart(2, '0')}`;
    const routeData = customRoute ? buildCustomRouteData(customRoute) : null;

    const newDrone = {
      instanceId,
      droneId: resolvedId,
      simulationPreset: preset,
      missionId: null,
      status: 'starting',
      progress: 0,
      anomalyCount: 0,
      detections: [],
      logs: [],
      dronePosition: null,
      simulationTime: 0,
      weather: null,
      routeData,
      color,
      videoPath: videoPath || '',
    };

    setDrones(prev => new Map([...prev, [instanceId, newDrone]]));
    setActiveDroneId(instanceId);

    // Load route data for map (preset route only)
    if (!customRoute && preset?.routeId) {
      api.get(`/api/routes/${preset.routeId}`)
        .then(rd => updateDrone(instanceId, { routeData: rd }))
        .catch(() => {});
    }

    try {
      const body = {
        name: `${preset?.name || 'Custom'} — ${new Date().toLocaleTimeString()}`,
        droneId: resolvedId,
      };
      if (customRoute) {
        body.routeData = routeData;
      } else {
        body.routeId = preset.routeId;
      }

      const data = await api.post('/api/inspection/start', body);
      updateDrone(instanceId, { missionId: data.missionId, status: 'running', weather: data.weather || null });
      connectDroneSSE(data.missionId, instanceId);
    } catch (err) {
      updateDrone(instanceId, d => ({
        ...d,
        status: 'error',
        logs: [...d.logs, { id: Date.now(), level: 'error', message: `Failed to start: ${err.message}`, timestamp: 0 }],
      }));
    }
  }, [drones, updateDrone, connectDroneSSE]);

  const handleRemoveDrone = useCallback((instanceId) => {
    const drone = drones.get(instanceId);
    if (!drone) return;

    if (drone.missionId) {
      const es = eventSourcesRef.current.get(drone.missionId);
      if (es) { es.close(); eventSourcesRef.current.delete(drone.missionId); }
      api.delete(`/api/inspection/${drone.missionId}`).catch(() => {});
    }

    setDrones(prev => {
      const next = new Map(prev);
      next.delete(instanceId);
      return next;
    });

    if (activeDroneId === instanceId) {
      const remaining = [...drones.keys()].filter(id => id !== instanceId);
      setActiveDroneId(remaining[0] || null);
    }
  }, [drones, activeDroneId]);

  const handlePause = useCallback(async () => {
    if (!activeDrone?.missionId) return;
    try {
      const res = await api.post('/api/inspection/pause', { missionId: activeDrone.missionId });
      updateDrone(activeDroneId, { status: res.status });
    } catch (err) {
      updateDrone(activeDroneId, d => ({
        ...d,
        logs: [...d.logs, { id: Date.now(), level: 'error', message: `Pause failed: ${err.message}`, timestamp: 0 }],
      }));
    }
  }, [activeDrone, activeDroneId, updateDrone]);

  const handleReset = useCallback(async () => {
    if (!activeDrone?.missionId) return;
    try {
      await api.post('/api/inspection/reset', { missionId: activeDrone.missionId });
      updateDrone(activeDroneId, {
        status: 'idle', progress: 0, dronePosition: null,
        detections: [], simulationTime: 0, anomalyCount: 0, logs: [],
      });
    } catch (err) {
      updateDrone(activeDroneId, d => ({
        ...d,
        logs: [...d.logs, { id: Date.now(), level: 'error', message: `Reset failed: ${err.message}`, timestamp: 0 }],
      }));
    }
  }, [activeDrone, activeDroneId, updateDrone]);

  const handleAddWaypoint = useCallback((lat, lng) => {
    setCustomWaypoints(prev => [...prev, { lat, lng }]);
  }, []);

  const handleAddDroneWithRoute = useCallback(async (droneId) => {
    if (customWaypoints.length < 2) return;
    setPlanningMode(false);
    await handleAddDrone({ id: 'custom', name: 'Custom Route' }, droneId, null, customWaypoints);
    setCustomWaypoints([]);
  }, [customWaypoints, handleAddDrone]);

  const handleTogglePlanningMode = useCallback(() => {
    setPlanningMode(p => !p);
    if (planningMode) setCustomWaypoints([]);
  }, [planningMode]);

  // Other drones' positions for secondary map markers
  const otherDrones = [...drones.values()].filter(
    d => d.instanceId !== activeDroneId && d.dronePosition
  ).map(d => ({ instanceId: d.instanceId, droneId: d.droneId, dronePosition: d.dronePosition, color: d.color }));

  const headerStatus = activeDrone?.status || 'idle';
  const statusDot = {
    idle: 'bg-gray-300', starting: 'bg-amber-400 animate-pulse',
    running: 'bg-emerald-500 animate-pulse', paused: 'bg-amber-400',
    complete: 'bg-blue-500', error: 'bg-red-500',
  }[headerStatus] || 'bg-gray-300';
  const statusLabel = {
    idle: 'Standby', starting: 'Starting', running: 'Inspecting',
    paused: 'Paused', complete: 'Complete', error: 'Error',
  }[headerStatus] || 'Standby';

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-black overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-black/6 shadow-sm z-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#E4007F] rounded-xl flex items-center justify-center shadow-md shadow-[#E4007F]/25">
            <Zap size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-black leading-none">DroneGuard</h1>
            <p className="text-[10px] text-black font-mono tracking-widest mt-0.5 uppercase">Energy Infrastructure Inspection</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          {activeDrone?.weather && <WeatherPanel weather={activeDrone.weather} />}
          <div className="flex items-center gap-4">
            {drones.size > 0 && (
              <span className="text-xs text-[#6e6e73] font-mono">
                {drones.size} drone{drones.size !== 1 ? 's' : ''} active
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusDot}`} />
              <span className="text-xs text-black font-mono uppercase tracking-widest">{statusLabel}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ControlPanel
          drone={activeDrone}
          drones={drones}
          activeDroneId={activeDroneId}
          activeView={activeView}
          planningMode={planningMode}
          customWaypoints={customWaypoints}
          onSelectDrone={setActiveDroneId}
          onAddDrone={() => setShowAddModal(true)}
          onRemoveDrone={handleRemoveDrone}
          onPause={handlePause}
          onReset={handleReset}
          onViewChange={setActiveView}
          onTogglePlanningMode={handleTogglePlanningMode}
          onAddDroneWithRoute={handleAddDroneWithRoute}
          onClearCustomRoute={() => setCustomWaypoints([])}
          onSetVideoPath={handleSetVideoPath}
        />

        <main className="flex-1 relative overflow-hidden">
          {activeView === 'map' ? (
            <MapView
              routeData={activeDrone?.routeData}
              dronePosition={activeDrone?.dronePosition}
              detections={activeDrone?.detections || []}
              progress={activeDrone?.progress || 0}
              activeColor={activeDrone?.color || '#E4007F'}
              otherDrones={otherDrones}
              planningMode={planningMode}
              customWaypoints={customWaypoints}
              onAddWaypoint={handleAddWaypoint}
            />
          ) : (
            <DroneView
              videoPath={activeDrone?.videoPath || ''}
              detections={activeDrone?.detections || []}
              simulationTime={activeDrone?.simulationTime || 0}
              dronePosition={activeDrone?.dronePosition}
              progress={activeDrone?.progress || 0}
              anomalyCount={activeDrone?.anomalyCount || 0}
              droneId={activeDrone?.droneId || '—'}
              status={activeDrone?.status || 'idle'}
              onYoloDetection={() => {}}
            />
          )}
        </main>

        <LogPanel logs={activeDrone?.logs || []} />
      </div>

      {showAddModal && (
        <AddDroneModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddDrone}
          droneCount={drones.size}
        />
      )}

      <Toast ref={toastRef} />
    </div>
  );
}
