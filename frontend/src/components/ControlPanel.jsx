import { Play, Pause, RotateCcw, Map, Video, AlertTriangle, Activity } from 'lucide-react';

const STATUS_CONFIG = {
  idle:     { color: 'text-[#6e6e73]',  bg: 'bg-gray-100',           label: 'Standby' },
  running:  { color: 'text-emerald-700', bg: 'bg-emerald-50 border border-emerald-200', label: 'Inspecting' },
  paused:   { color: 'text-amber-700',   bg: 'bg-amber-50 border border-amber-200',     label: 'Paused' },
  complete: { color: 'text-blue-700',    bg: 'bg-blue-50 border border-blue-200',       label: 'Complete' },
};

export default function ControlPanel({
  status, progress, anomalyCount, routes, selectedRoute, droneId, videoPath, activeView,
  simulationTime, detections, onSelectRoute, onSetDroneId, onSetVideoPath,
  onStart, onPause, onReset, onViewChange,
}) {
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const isRunning = status === 'running';
  const canStart  = status === 'idle' || status === 'complete';
  const canPause  = status === 'running' || status === 'paused';
  const canReset  = status !== 'idle';

  const highSev = detections.filter(d => d.severity === 'high').length;
  const medSev  = detections.filter(d => d.severity === 'medium').length;

  return (
    <aside className="w-72 flex flex-col border-r border-black/6 bg-white overflow-y-auto flex-shrink-0 shadow-sm">

      {/* Status + progress */}
      <div className="p-5 border-b border-black/5">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium mb-4 ${sc.bg} ${sc.color}`}>
          {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          {sc.label.toUpperCase()}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[#6e6e73]">Progress</span>
            <span className="text-[#1d1d1f] font-mono font-medium">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-[#f5f5f7] rounded-full overflow-hidden border border-black/5">
            <div
              className="h-full bg-[#E4007F] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {simulationTime > 0 && (
          <p className="text-xs text-[#aeaeb2] font-mono mt-2">T+{simulationTime.toFixed(0)}s elapsed</p>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 p-4 border-b border-black/5">
        <Metric label="Anomalies" value={anomalyCount} color="text-rose-600" dotColor="bg-rose-500" icon={<AlertTriangle size={11} />} />
        <Metric label="Detections" value={detections.length} color="text-blue-600" dotColor="bg-blue-500" icon={<Activity size={11} />} />
        <Metric label="Critical" value={highSev} color="text-rose-700" dotColor="bg-rose-600" />
        <Metric label="Warnings" value={medSev} color="text-amber-600" dotColor="bg-amber-500" />
      </div>

      {/* View toggle */}
      <div className="p-4 border-b border-black/5">
        <p className="text-[10px] text-[#aeaeb2] uppercase tracking-widest mb-2 font-mono">Active View</p>
        <div className="flex gap-2 p-1 bg-[#f5f5f7] rounded-xl">
          <ViewBtn active={activeView === 'map'}   onClick={() => onViewChange('map')}   icon={<Map size={13} />}   label="Map" />
          <ViewBtn active={activeView === 'drone'} onClick={() => onViewChange('drone')} icon={<Video size={13} />} label="Drone" />
        </div>
      </div>

      {/* Configuration */}
      <div className="p-4 space-y-4 border-b border-black/5">
        <p className="text-[10px] text-[#aeaeb2] uppercase tracking-widest font-mono">Configuration</p>

        <Field label="Drone ID">
          <input
            type="text"
            value={droneId}
            onChange={e => onSetDroneId(e.target.value)}
            disabled={isRunning}
            className="w-full bg-[#f5f5f7] border border-black/8 rounded-xl px-3 py-2 text-sm text-[#1d1d1f] placeholder-[#c7c7cc] focus:outline-none focus:border-[#E4007F] focus:ring-1 focus:ring-[#E4007F]/20 disabled:opacity-40 font-mono transition"
          />
        </Field>

        <Field label="Inspection Route">
          <select
            value={selectedRoute || ''}
            onChange={e => onSelectRoute(e.target.value)}
            disabled={isRunning}
            className="w-full bg-[#f5f5f7] border border-black/8 rounded-xl px-3 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:border-[#E4007F] focus:ring-1 focus:ring-[#E4007F]/20 disabled:opacity-40 transition appearance-none cursor-pointer"
          >
            {routes.length === 0 && <option value="">Loading routes...</option>}
            {routes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>

        {selectedRoute && (() => {
          const r = routes.find(x => x.id === selectedRoute);
          if (!r) return null;
          return (
            <div className="text-xs text-[#aeaeb2] font-mono space-y-0.5 pl-1">
              <p>{r.lineVoltage} · {r.region}</p>
              <p>{r.waypointCount} towers · {r.totalDistance}km · ~{r.estimatedDuration}s</p>
            </div>
          );
        })()}

        <Field label="Video File (optional)">
          <input
            type="text"
            value={videoPath}
            onChange={e => onSetVideoPath(e.target.value)}
            disabled={isRunning}
            placeholder="inspection.mp4"
            className="w-full bg-[#f5f5f7] border border-black/8 rounded-xl px-3 py-2 text-xs text-[#1d1d1f] placeholder-[#c7c7cc] focus:outline-none focus:border-[#E4007F] focus:ring-1 focus:ring-[#E4007F]/20 disabled:opacity-40 font-mono transition"
          />
        </Field>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-2">
        <p className="text-[10px] text-[#aeaeb2] uppercase tracking-widest font-mono mb-3">Controls</p>

        <button
          onClick={onStart}
          disabled={!canStart || !selectedRoute}
          className="w-full flex items-center justify-center gap-2 bg-[#E4007F] hover:bg-[#c8006f] active:bg-[#a80060] disabled:bg-[#f5f5f7] disabled:text-[#c7c7cc] disabled:border disabled:border-black/6 text-white text-sm font-semibold py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] shadow-md shadow-[#E4007F]/20 disabled:shadow-none"
        >
          <Play size={14} />
          Start Inspection
        </button>

        <button
          onClick={onPause}
          disabled={!canPause}
          className="w-full flex items-center justify-center gap-2 bg-[#f5f5f7] hover:bg-[#ebebeb] border border-black/8 disabled:opacity-30 text-[#1d1d1f] text-sm font-medium py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98]"
        >
          <Pause size={14} />
          {status === 'paused' ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={onReset}
          disabled={!canReset}
          className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-[#f5f5f7] disabled:opacity-20 text-[#6e6e73] hover:text-[#1d1d1f] text-sm font-medium py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98]"
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      {/* Recent detections */}
      {detections.length > 0 && (
        <div className="p-4 border-t border-black/5">
          <p className="text-[10px] text-[#aeaeb2] uppercase tracking-widest font-mono mb-3">Recent Detections</p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {[...detections].reverse().slice(0, 8).map(d => (
              <div key={d.id} className={`flex items-start gap-2 p-2.5 rounded-xl text-xs border
                ${d.isAnomaly ? 'bg-rose-50 border-rose-100' : 'bg-[#f5f5f7] border-black/5'}`}>
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0
                  ${d.severity === 'high' ? 'bg-rose-500' : d.severity === 'medium' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                <div className="min-w-0">
                  <p className="text-[#1d1d1f] font-medium truncate">{d.className}</p>
                  <p className="text-[#aeaeb2] font-mono">Tower {d.waypointId + 1} · {(d.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function Metric({ label, value, color, dotColor, icon }) {
  return (
    <div className="bg-[#f5f5f7] rounded-xl p-3 border border-black/5">
      <div className={`flex items-center gap-1 text-xs mb-1 ${color}`}>
        {icon || <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
        <span className="text-[#6e6e73]">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all
        ${active
          ? 'bg-white text-[#E4007F] shadow-sm border border-black/6'
          : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}
    >
      {icon}{label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-[#6e6e73]">{label}</label>
      {children}
    </div>
  );
}
