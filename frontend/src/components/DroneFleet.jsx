import { Plus, Trash2, Route } from 'lucide-react';

const STATUS_DOT = {
  idle:     'bg-gray-300',
  starting: 'bg-amber-400 animate-pulse',
  running:  'bg-emerald-500 animate-pulse',
  paused:   'bg-amber-400',
  complete: 'bg-blue-500',
  error:    'bg-red-500',
};

export default function DroneFleet({
  drones, activeDroneId, planningMode, customWaypoints,
  onSelect, onRemove, onAdd, onTogglePlanningMode,
}) {
  const droneList = [...drones.values()];

  return (
    <div className="p-4 border-b border-black/5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-black uppercase tracking-widest font-mono">
          Fleet ({droneList.length})
        </p>
        <div className="flex gap-1">
          <button
            onClick={onTogglePlanningMode}
            title="Plan custom route"
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-sm transition ${
              planningMode
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-black hover:bg-[#f5f5f7]'
            }`}
          >
            <Route size={12} />
            {planningMode ? `${customWaypoints.length} pts` : 'Route'}
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs font-medium text-[#E4007F] hover:bg-rose-50 px-2 py-1 rounded-sm transition"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
      </div>

      {droneList.length === 0 ? (
        <div className="text-center py-5">
          <p className="text-xs text-black mb-2">No active drones</p>
          <button onClick={onAdd} className="text-xs font-medium text-[#E4007F] hover:underline">
            Add your first drone →
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {droneList.map(drone => (
            <div
              key={drone.instanceId}
              onClick={() => onSelect(drone.instanceId)}
              className={`flex items-center gap-2.5 p-2.5 rounded-sm cursor-pointer transition-all border ${
                drone.instanceId === activeDroneId
                  ? 'border-[#E4007F]/25 bg-[#E4007F]/5'
                  : 'border-transparent bg-[#f5f5f7] hover:border-black/8'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[drone.status] || 'bg-gray-300'}`}
                style={drone.instanceId === activeDroneId ? { backgroundColor: drone.color } : {}}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-black truncate">{drone.droneId}</p>
                <p className="text-[10px] text-black truncate">
                  {drone.simulationPreset?.name || 'Custom route'}
                </p>
              </div>
              {drone.status === 'running' && (
                <div className="w-10 flex-shrink-0">
                  <div className="h-1 bg-black/5 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm transition-all duration-300"
                      style={{ width: `${drone.progress}%`, backgroundColor: drone.color }} />
                  </div>
                  <p className="text-[9px] font-mono text-black text-right mt-0.5">
                    {drone.progress.toFixed(0)}%
                  </p>
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); onRemove(drone.instanceId); }}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-sm hover:bg-rose-100 hover:text-rose-600 text-black transition"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}