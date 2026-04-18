import { useState, useRef } from 'react';
import { X, Zap, Radio, Building2, Upload, FileVideo, CheckCircle } from 'lucide-react';

export const SIMULATION_PRESETS = [
  {
    id: 'silesia',
    name: 'Gliwice 110kV',
    routeId: 'route_silesia_110kv',
    description: 'Line patrol — Wieszowa / Gliwice area, TAURON grid',
    details: '20 towers · 15.4 km · ~140 s',
    region: 'Silesia',
    color: '#E4007F',
    Icon: Zap,
  },
  {
    id: 'rybnik',
    name: 'Rybnik 110kV',
    routeId: 'route_rybnik_110kv',
    description: 'Line patrol — Rybnik to Wodzisław Śląski corridor',
    details: '15 towers · 18.7 km · ~128 s',
    region: 'S. Silesia',
    color: '#3b82f6',
    Icon: Radio,
  },
  {
    id: 'krakow',
    name: 'Kraków 110kV',
    routeId: 'route_krakow_110kv',
    description: 'Substation patrol — Bieżanów to Wieliczka, Małopolska',
    details: '12 towers · 11.8 km · ~99 s',
    region: 'Małopolska',
    color: '#10b981',
    Icon: Building2,
  },
];

const BASE = 'http://localhost:3001';

async function findExistingVideoFilename(filename) {
  const res = await fetch(`${BASE}/api/videos`);
  if (!res.ok) return null;

  const files = await res.json();
  const match = files.find((item) => item.filename?.toLowerCase() === filename.toLowerCase());
  return match?.filename || null;
}

export default function AddDroneModal({ onClose, onAdd, droneCount }) {
  const [selected, setSelected] = useState(null);
  const [droneId, setDroneId] = useState(`DRONE-${String(droneCount + 1).padStart(2, '0')}`);
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setUploading(true);
    try {
      const existingFilename = await findExistingVideoFilename(file.name);
      if (existingFilename) {
        setUploadedFilename(existingFilename);
        return;
      }

      const res = await fetch(`${BASE}/api/videos/upload`, {
        method: 'POST',
        headers: { 'X-Filename': file.name, 'Content-Type': file.type || 'video/mp4' },
        body: file,
      });
      const data = await res.json();
      if (data.filename) setUploadedFilename(data.filename);
    } catch {
      setUploadedFilename(file.name);
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = async () => {
    if (!selected || !droneId.trim()) return;
    setLoading(true);
    await onAdd(selected, droneId.trim(), uploadedFilename || null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">Add Drone</h2>
            <p className="text-xs text-black mt-0.5">Choose a simulation and configure the drone</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f5f5f7] text-black transition">
            <X size={16} />
          </button>
        </div>

        {/* Simulation presets */}
        <div className="p-6 space-y-3">
          <p className="text-[10px] text-black uppercase tracking-widest font-mono mb-4">Simulation Type</p>
          {SIMULATION_PRESETS.map(preset => {
            const isSelected = selected?.id === preset.id;
            return (
              <button key={preset.id} onClick={() => setSelected(preset)}
                className="w-full text-left p-4 rounded border-2 transition-all"
                style={isSelected
                  ? { borderColor: preset.color, backgroundColor: preset.color + '12' }
                  : { borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#f5f5f7' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: preset.color + '20' }}>
                    <preset.Icon size={16} style={{ color: preset.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#1d1d1f]">{preset.name}</p>
                      <span className="text-[10px] font-mono text-black bg-black/5 px-2 py-0.5 rounded">{preset.region}</span>
                    </div>
                    <p className="text-xs text-black mt-0.5">{preset.description}</p>
                    <p className="text-[11px] font-mono text-black mt-1.5">{preset.details}</p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: preset.color }}>
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Drone ID */}
        <div className="px-6 pb-4">
          <label className="text-xs text-black block mb-1.5">Drone ID</label>
          <input type="text" value={droneId} onChange={e => setDroneId(e.target.value)}
            className="w-full bg-[#f5f5f7] border border-black/8 rounded px-3 py-2 text-sm font-mono text-[#1d1d1f] focus:outline-none focus:border-[#E4007F] focus:ring-1 focus:ring-[#E4007F]/20 transition" />
        </div>

        {/* Video upload */}
        <div className="px-6 pb-5">
          <label className="text-xs text-black block mb-2">Drone Video Feed <span className="text-black/40">(optional — enables YOLO AI detection)</span></label>
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />

          {!uploadedFilename ? (
            <button onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-black/10 hover:border-[#E4007F]/40 hover:bg-[#E4007F]/3 rounded py-3 text-xs text-black hover:text-[#E4007F] transition disabled:opacity-50">
              {uploading
                ? <><div className="w-3 h-3 border border-[#E4007F] border-t-transparent rounded-full animate-spin" /> Uploading...</>
                : <><Upload size={14} /> Upload video file (.mp4, .webm)</>}
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded px-4 py-2.5">
              <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-emerald-700 truncate">{uploadedFilename}</p>
                <p className="text-[10px] text-emerald-500">Video ready — AI detection enabled</p>
              </div>
              <button onClick={() => { setUploadedFilename(''); setVideoFile(null); }}
                className="text-emerald-400 hover:text-emerald-600 transition">
                <X size={14} />
              </button>
            </div>
          )}
          {!uploadedFilename && (
            <p className="text-[10px] text-black font-mono mt-2 text-center">
              Or place files in <span className="text-black/60">project-root/videos/</span> and type the name below
            </p>
          )}
          {!uploadedFilename && (
            <input type="text" value={uploadedFilename}
              onChange={e => setUploadedFilename(e.target.value)}
              placeholder="e.g. inspection.mp4"
              className="mt-2 w-full bg-[#f5f5f7] border border-black/8 rounded px-3 py-2 text-xs font-mono text-[#1d1d1f] placeholder-black/30 focus:outline-none focus:border-[#E4007F] transition" />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded text-sm font-medium text-black bg-[#f5f5f7] hover:bg-[#ebebeb] transition">
            Cancel
          </button>
          <button onClick={handleAdd}
            disabled={!selected || loading || !droneId.trim()}
            className="flex-1 py-2.5 rounded text-sm font-semibold text-white bg-[#E4007F] hover:bg-[#c8006f] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md shadow-[#E4007F]/20 disabled:shadow-none">
            {loading ? 'Launching...' : 'Add & Launch'}
          </button>
        </div>
      </div>
    </div>
  );
}