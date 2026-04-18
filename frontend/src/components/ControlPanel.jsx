import { useState, useRef } from 'react';
import { Pause, RotateCcw, Map, Video, AlertTriangle, Activity, X, CheckCheck, Upload, FileVideo, Play } from 'lucide-react';
import DroneFleet from './DroneFleet';

const BASE = 'http://localhost:3001';

async function findExistingVideoFilename(filename) {
  const res = await fetch(`${BASE}/api/videos`);
  if (!res.ok) return null;

  const files = await res.json();
  const match = files.find((item) => item.filename?.toLowerCase() === filename.toLowerCase());
  return match?.filename || null;
}

const STATUS_CONFIG = {
  idle:     { color: 'text-black',      bg: 'bg-gray-100',                             label: 'Standby' },
  starting: { color: 'text-amber-700',  bg: 'bg-amber-50 border border-amber-200',     label: 'Starting' },
  running:  { color: 'text-emerald-700',bg: 'bg-emerald-50 border border-emerald-200', label: 'Inspecting' },
  paused:   { color: 'text-amber-700',  bg: 'bg-amber-50 border border-amber-200',     label: 'Paused' },
  complete: { color: 'text-blue-700',   bg: 'bg-blue-50 border border-blue-200',       label: 'Complete' },
  error:     { color: 'text-red-700',    bg: 'bg-red-50 border border-red-200',         label: 'Error' },
  returning: { color: 'text-violet-700', bg: 'bg-violet-50 border border-violet-200',   label: 'Returning' },
};

export default function ControlPanel({
  drone, drones, activeDroneId, activeView,
  planningMode, customWaypoints,
  onSelectDrone, onAddDrone, onRemoveDrone,
  onPause, onReset, onRestart, onViewChange,
  onTogglePlanningMode, onAddDroneWithRoute, onClearCustomRoute,
  onSetVideoPath,
}) {
  const [customDroneId, setCustomDroneId] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const fileInputRef = useRef(null);

  const status = drone?.status || 'idle';
  const progress = drone?.progress || 0;
  const anomalyCount = drone?.anomalyCount || 0;
  const detections = drone?.detections || [];
  const simulationTime = drone?.simulationTime || 0;
  const videoPath = drone?.videoPath || '';

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const isRunning = status === 'running';
  const canPause  = status === 'running' || status === 'paused';
  const canReset  = status !== 'idle' && status !== 'starting';

  const highSev = detections.filter(d => d.severity === 'high').length;
  const medSev  = detections.filter(d => d.severity === 'medium').length;

  const handleLaunchCustomRoute = () => {
    const id = customDroneId.trim() || `DRONE-${String(drones.size + 1).padStart(2, '0')}`;
    onAddDroneWithRoute(id);
    setCustomDroneId('');
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const existingFilename = await findExistingVideoFilename(file.name);
      if (existingFilename) {
        onSetVideoPath?.(drone.instanceId, existingFilename);
        return;
      }

      const res = await fetch(`${BASE}/api/videos/upload`, {
        method: 'POST',
        headers: { 'X-Filename': file.name, 'Content-Type': file.type || 'video/mp4' },
        body: file,
      });
      const data = await res.json();
      if (data.filename) onSetVideoPath?.(drone.instanceId, data.filename);
    } catch {
      onSetVideoPath?.(drone.instanceId, file.name);
    } finally {
      setUploadingVideo(false);
    }
  };

  return (
    <aside className="w-72 flex flex-col border-r border-black/6 bg-white overflow-y-auto flex-shrink-0 shadow-sm">

      <DroneFleet
        drones={drones}
        activeDroneId={activeDroneId}
        planningMode={planningMode}
        customWaypoints={customWaypoints}
        onSelect={onSelectDrone}
        onRemove={onRemoveDrone}
        onAdd={onAddDrone}
        onTogglePlanningMode={onTogglePlanningMode}
      />

      {/* Route planning panel */}
      {planningMode && (
        <div className="p-4 border-b border-indigo-100 bg-indigo-50">
          <p className="text-[10px] text-indigo-600 uppercase tracking-widest font-mono mb-2">Route Planning</p>
          <p className="text-xs text-indigo-700 mb-3">Click on the map to add waypoints.</p>
          <p className="text-xs font-mono font-semibold text-indigo-800 mb-3">
            {customWaypoints.length} waypoint{customWaypoints.length !== 1 ? 's' : ''} added
          </p>
          {customWaypoints.length >= 2 && (
            <div className="space-y-2 mb-3">
              <label className="text-[10px] text-indigo-500 font-mono">Drone ID</label>
              <input type="text" value={customDroneId} onChange={e => setCustomDroneId(e.target.value)}
                placeholder={`DRONE-${String(drones.size + 1).padStart(2, '0')}`}
                className="w-full bg-white border border-indigo-200 rounded-sm px-3 py-2 text-sm font-mono text-black focus:outline-none focus:border-indigo-500 transition" />
              <button onClick={handleLaunchCustomRoute}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-sm transition">
                <CheckCheck size={13} />
                Launch with this route
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClearCustomRoute} disabled={customWaypoints.length === 0}
              className="flex-1 text-xs py-1.5 rounded-sm text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 disabled:opacity-40 transition">
              Clear
            </button>
            <button onClick={onTogglePlanningMode}
              className="flex-1 text-xs py-1.5 rounded-sm text-black bg-white border border-black/8 hover:bg-[#f5f5f7] transition flex items-center justify-center gap-1">
              <X size={11} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!drone && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-xs text-black mb-2">No drone selected</p>
            <button onClick={onAddDrone} className="text-xs font-medium text-[#E4007F] hover:underline">
              Add a drone →
            </button>
          </div>
        </div>
      )}

      {drone && (
        <>
          {/* Status + progress */}
          <div className="p-5 border-b border-black/5">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono font-medium mb-4 ${sc.bg} ${sc.color}`}>
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              {sc.label.toUpperCase()}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-black font-bold">Progress</span>
                <span className="text-black font-mono font-medium">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-[#f5f5f7] rounded-sm overflow-hidden border border-black/5">
                <div className="h-full rounded-sm transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: drone.color || '#E4007F' }} />
              </div>
            </div>
            {simulationTime > 0 && (
              <p className="text-xs text-black font-mono mt-2">T+{simulationTime.toFixed(0)}s elapsed</p>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2 p-4 border-b border-black/5">
            <Metric label="Anomalies"  value={anomalyCount}      color="text-rose-600"  dotColor="bg-rose-500"  icon={<AlertTriangle size={13} />} />
            <Metric label="Detections" value={detections.length} color="text-blue-600"  dotColor="bg-blue-500"  icon={<Activity size={13} />} />
            <Metric label="Critical"   value={highSev}           color="text-rose-700"  dotColor="bg-rose-600" />
            <Metric label="Warnings"   value={medSev}            color="text-amber-600" dotColor="bg-amber-500" />
          </div>

          {/* View toggle */}
          <div className="p-4 border-b border-black">
            <p className="text-[10px] text-black uppercase tracking-widest mb-2 font-mono">Active View</p>
            <div className="flex gap-2 p-1 bg-[#f5f5f7] rounded-sm">
              <ViewBtn active={activeView === 'map'}   onClick={() => onViewChange('map')}   icon={<Map size={13} />}   label="Map" />
              <ViewBtn active={activeView === 'drone'} onClick={() => onViewChange('drone')} icon={<Video size={13} />} label="Drone" />
            </div>
          </div>

          {/* Video feed */}
          <div className="p-4 border-b border-black/5">
            <p className="text-[10px] text-black uppercase tracking-widest font-mono mb-3">Video Feed / AI Detection</p>
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />

            {videoPath ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-sm px-3 py-2">
                  <FileVideo size={13} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-xs font-mono text-emerald-700 flex-1 truncate">{videoPath}</p>
                  <button onClick={() => onSetVideoPath?.(drone.instanceId, '')}
                    className="text-emerald-400 hover:text-emerald-600 transition flex-shrink-0">
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[10px] text-emerald-600 font-mono text-center">YOLO AI detection active</p>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingVideo}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-black/10 hover:border-[#E4007F]/40 rounded-sm py-2.5 text-xs text-black hover:text-[#E4007F] transition disabled:opacity-50">
                  {uploadingVideo
                    ? <><div className="w-3 h-3 border border-[#E4007F] border-t-transparent rounded-full animate-spin" /> Uploading...</>
                    : <><Upload size={13} /> Upload video file</>}
                </button>
                <input type="text" value={videoPath}
                  onChange={e => onSetVideoPath?.(drone.instanceId, e.target.value)}
                  placeholder="or type filename (e.g. flight.mp4)"
                  className="w-full bg-[#f5f5f7] border border-black/8 rounded-sm px-3 py-2 text-xs font-mono text-black placeholder-black/40 focus:outline-none focus:border-[#E4007F] transition" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 space-y-2 border-b border-black/5">
            <p className="text-[10px] text-black uppercase tracking-widest font-mono mb-3">Controls</p>
            {status === 'idle' && drone?.simulationPreset ? (
              <button onClick={onRestart}
                className="w-full flex items-center justify-center gap-2 bg-[#E4007F] hover:bg-[#c8006f] text-white text-sm font-semibold py-2.5 rounded-sm transition-all duration-150 active:scale-[0.98] shadow-md shadow-[#E4007F]/20">
                <Play size={14} />
                Start Again
              </button>
            ) : (
              <>
                <button onClick={onPause} disabled={!canPause}
                  className="w-full flex items-center justify-center gap-2 bg-[#f5f5f7] hover:bg-[#ebebeb] border border-black/8 disabled:opacity-30 text-black text-sm font-medium py-2.5 rounded-sm transition-all duration-150 active:scale-[0.98]">
                  <Pause size={14} />
                  {status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button onClick={onReset} disabled={!canReset}
                  className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-[#f5f5f7] disabled:opacity-20 text-black text-sm font-medium py-2.5 rounded-sm transition-all duration-150 active:scale-[0.98]">
                  <RotateCcw size={13} />
                  Reset
                </button>
              </>
            )}
          </div>

          {/* Recent detections */}
          {detections.length > 0 && (
            <div className="p-4 border-t border-black/5">
              <p className="text-[10px] text-black uppercase tracking-widest font-mono mb-3">Recent Detections</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {[...detections].reverse().slice(0, 8).map(d => (
                  <div key={d.id} className={`flex items-start gap-2 p-2.5 rounded-sm text-xs border
                    ${d.isAnomaly ? 'bg-rose-50 border-rose-100' : 'bg-[#f5f5f7] border-black/5'}`}>
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0
                      ${d.severity === 'high' ? 'bg-rose-500' : d.severity === 'medium' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                    <div className="min-w-0">
                      <p className="text-black font-medium truncate">{d.className}</p>
                      <p className="text-black font-mono">Tower {d.waypointId + 1} · {(d.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function Metric({ label, value, color, dotColor, icon }) {
  return (
    <div className="bg-[#f5f5f7] rounded-sm p-3 border border-black/5">
      <div className={`flex items-center gap-1 text-xs mb-1 ${color}`}>
        {icon || <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
        <span className="text-black">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs font-medium transition-all
        ${active ? 'bg-white text-[#E4007F] shadow-sm border border-black/6' : 'text-black hover:text-black'}`}>
      {icon}{label}
    </button>
  );
}