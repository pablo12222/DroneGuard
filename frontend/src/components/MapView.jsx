import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DRONE_SVG = (color = '#E4007F') => `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
  <circle cx="19" cy="19" r="15" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1.5"/>
  <circle cx="19" cy="19" r="8" fill="${color}"/>
  <circle cx="8" cy="8" r="4.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2"/>
  <circle cx="30" cy="8" r="4.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2"/>
  <circle cx="8" cy="30" r="4.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2"/>
  <circle cx="30" cy="30" r="4.5" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 2"/>
  <line x1="12" y1="12" x2="16" y2="16" stroke="${color}" stroke-width="1.5"/>
  <line x1="26" y1="12" x2="22" y2="16" stroke="${color}" stroke-width="1.5"/>
  <line x1="12" y1="26" x2="16" y2="22" stroke="${color}" stroke-width="1.5"/>
  <line x1="26" y1="26" x2="22" y2="22" stroke="${color}" stroke-width="1.5"/>
  <circle cx="19" cy="19" r="3.5" fill="white"/>
</svg>`;

const SECONDARY_DRONE_SVG = (color = '#3b82f6') => `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
  <circle cx="13" cy="13" r="10" fill="${color}" fill-opacity="0.15"/>
  <circle cx="13" cy="13" r="6" fill="${color}"/>
  <circle cx="13" cy="13" r="2.5" fill="white"/>
</svg>`;

const ALERT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="34" viewBox="0 0 30 34">
  <polygon points="15,2 28,30 2,30" fill="#ef4444" stroke="#fca5a5" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="13.5" y="11" width="3" height="10" rx="1.5" fill="white"/>
  <rect x="13.5" y="24" width="3" height="3" rx="1.5" fill="white"/>
</svg>`;

const TOWER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="22" viewBox="0 0 18 22">
  <line x1="9" y1="1" x2="2" y2="18" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="9" y1="1" x2="16" y2="18" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="4" y1="7" x2="14" y2="7" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="3" y1="13" x2="15" y2="13" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="2" y1="18" x2="16" y2="18" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="9" cy="1" r="2" fill="#818cf8"/>
  <line x1="9" y1="18" x2="9" y2="22" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const WAYPOINT_SVG = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 24 30">
  <path d="M12 1C7 1 3 5 3 10C3 17 12 29 12 29S21 17 21 10C21 5 17 1 12 1Z" fill="#6366f1" stroke="#4f46e5" stroke-width="1"/>
  <circle cx="12" cy="10" r="6" fill="white"/>
  <text x="12" y="14" text-anchor="middle" font-size="7" font-weight="700" fill="#6366f1" font-family="monospace">${n}</text>
</svg>`;

function makeIcon(svg, size, anchor) {
  return L.divIcon({ html: svg, iconSize: size, iconAnchor: anchor, className: '' });
}

const MAP_STYLES = [
  { id: 'light',   label: 'Light',   url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { maxZoom: 19 } },
  { id: 'voyager', label: 'Neutral', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', opts: { subdomains: 'abcd', maxZoom: 20 } },
  { id: 'dark',    label: 'Dark',    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', opts: { subdomains: 'abcd', maxZoom: 20 } },
];

export default function MapView({
  routeData, dronePosition, detections, progress,
  otherDrones = [], yoloAnomalies = [],
  planningMode = false, customWaypoints = [], onAddWaypoint,
  activeColor = '#E4007F',
}) {
  const [modalAnomaly, setModalAnomaly] = useState(null);
  const mapRef            = useRef(null);
  const mapInstance       = useRef(null);
  const droneMarker       = useRef(null);
  const routeLine         = useRef(null);
  const visitedLine       = useRef(null);
  const towerMarkers      = useRef([]);
  const alertMarkers      = useRef({});
  const tileLayer         = useRef(null);
  const secondaryRefs     = useRef({});
  const secondaryRoutes   = useRef({}); // instanceId → { routeLine, visitedLine }
  const yoloAnomalyMarkers = useRef({});  // anomaly.id → L.marker
  const planWaypoints     = useRef([]);
  const planLine          = useRef(null);
  const onAddWaypointRef  = useRef(onAddWaypoint);
  onAddWaypointRef.current = onAddWaypoint;

  const [styleId, setStyleId] = useState('light');

  useEffect(() => {
    if (mapInstance.current) return;
    const center = routeData?.waypoints?.[0]
      ? [routeData.waypoints[0].lat, routeData.waypoints[0].lng]
      : [50.28, 18.80];
    const map = L.map(mapRef.current, { center, zoom: 13, zoomControl: true, attributionControl: false });
    tileLayer.current = L.tileLayer(MAP_STYLES[0].url, MAP_STYLES[0].opts).addTo(map);
    mapInstance.current = map;
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const style = MAP_STYLES.find(s => s.id === styleId);
    if (!style) return;
    if (tileLayer.current) map.removeLayer(tileLayer.current);
    tileLayer.current = L.tileLayer(style.url, style.opts).addTo(map);
    tileLayer.current.bringToBack();
  }, [styleId]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const onClick = (e) => onAddWaypointRef.current?.(e.latlng.lat, e.latlng.lng);
    if (planningMode) {
      map.getContainer().style.cursor = 'crosshair';
      map.on('click', onClick);
    } else {
      map.getContainer().style.cursor = '';
      map.off('click', onClick);
    }
    return () => {
      map.off('click', onClick);
      if (map.getContainer()) map.getContainer().style.cursor = '';
    };
  }, [planningMode]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    planWaypoints.current.forEach(m => map.removeLayer(m));
    planWaypoints.current = [];
    if (planLine.current) { map.removeLayer(planLine.current); planLine.current = null; }
    if (customWaypoints.length === 0) return;
    customWaypoints.forEach((wp, i) => {
      const m = L.marker([wp.lat, wp.lng], {
        icon: makeIcon(WAYPOINT_SVG(i + 1), [24, 30], [12, 30]),
      }).addTo(map);
      planWaypoints.current.push(m);
    });
    if (customWaypoints.length >= 2) {
      planLine.current = L.polyline(
        customWaypoints.map(w => [w.lat, w.lng]),
        { color: '#6366f1', weight: 2.5, dashArray: '6 4', opacity: 0.9 }
      ).addTo(map);
      map.fitBounds(planLine.current.getBounds(), { padding: [50, 50] });
    }
  }, [customWaypoints]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !routeData?.waypoints) return;
    if (routeLine.current)  map.removeLayer(routeLine.current);
    if (visitedLine.current) map.removeLayer(visitedLine.current);
    towerMarkers.current.forEach(m => map.removeLayer(m));
    towerMarkers.current = [];
    const coords = routeData.waypoints.map(w => [w.lat, w.lng]);
    routeLine.current = L.polyline(coords, { color: '#cbd5e1', weight: 3, dashArray: '7 5', opacity: 1 }).addTo(map);
    visitedLine.current = L.polyline([], { color: activeColor, weight: 4, opacity: 0.85 }).addTo(map);
    routeData.waypoints.forEach((wp, i) => {
      const m = L.marker([wp.lat, wp.lng], { icon: makeIcon(TOWER_SVG, [18, 22], [9, 22]) })
        .bindPopup(popupTower(wp, i), { className: 'clean-popup' })
        .addTo(map);
      towerMarkers.current.push(m);
    });
    map.fitBounds(routeLine.current.getBounds(), { padding: [50, 50] });
  }, [routeData, activeColor]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !dronePosition) return;
    const pos = [dronePosition.lat, dronePosition.lng];
    if (!droneMarker.current) {
      droneMarker.current = L.marker(pos, {
        icon: makeIcon(DRONE_SVG(activeColor), [38, 38], [19, 19]),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      droneMarker.current.setLatLng(pos);
      droneMarker.current.setIcon(makeIcon(DRONE_SVG(activeColor), [38, 38], [19, 19]));
    }
    if (visitedLine.current && routeData?.waypoints) {
      const simTime = (progress / 100) * routeData.estimatedDuration;
      const visited = routeData.waypoints.filter(w => w.timestamp <= simTime).map(w => [w.lat, w.lng]);
      visited.push(pos);
      visitedLine.current.setLatLngs(visited);
    }
  }, [dronePosition, progress, routeData, activeColor]);

  useEffect(() => {
    if (!dronePosition && droneMarker.current && mapInstance.current) {
      mapInstance.current.removeLayer(droneMarker.current);
      droneMarker.current = null;
    }
  }, [dronePosition]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const activeIds = new Set(otherDrones.map(d => d.instanceId));

    // Remove stale drone markers and route layers
    Object.keys(secondaryRefs.current).forEach(id => {
      if (!activeIds.has(id)) {
        map.removeLayer(secondaryRefs.current[id]);
        delete secondaryRefs.current[id];
      }
    });
    Object.keys(secondaryRoutes.current).forEach(id => {
      if (!activeIds.has(id)) {
        const lr = secondaryRoutes.current[id];
        if (lr.routeLine) map.removeLayer(lr.routeLine);
        if (lr.visitedLine) map.removeLayer(lr.visitedLine);
        delete secondaryRoutes.current[id];
      }
    });

    otherDrones.forEach(d => {
      // Route lines
      if (d.routeData?.waypoints?.length >= 2) {
        const coords = d.routeData.waypoints.map(w => [w.lat, w.lng]);
        const existing = secondaryRoutes.current[d.instanceId];
        if (!existing) {
          const rl = L.polyline(coords, { color: d.color, weight: 2.5, dashArray: '7 5', opacity: 0.5 }).addTo(map);
          const vl = L.polyline([], { color: d.color, weight: 3, opacity: 0.7 }).addTo(map);
          secondaryRoutes.current[d.instanceId] = { routeLine: rl, visitedLine: vl };
        }
        // Update visited segment
        const vl = secondaryRoutes.current[d.instanceId]?.visitedLine;
        if (vl && d.dronePosition && d.routeData.estimatedDuration) {
          const simTime = (d.progress / 100) * d.routeData.estimatedDuration;
          const visited = d.routeData.waypoints.filter(w => w.timestamp <= simTime).map(w => [w.lat, w.lng]);
          if (d.dronePosition) visited.push([d.dronePosition.lat, d.dronePosition.lng]);
          vl.setLatLngs(visited);
        }
      }

      // Drone marker
      if (!d.dronePosition) return;
      const pos = [d.dronePosition.lat, d.dronePosition.lng];
      if (secondaryRefs.current[d.instanceId]) {
        secondaryRefs.current[d.instanceId].setLatLng(pos);
        secondaryRefs.current[d.instanceId].setIcon(makeIcon(SECONDARY_DRONE_SVG(d.color), [26, 26], [13, 13]));
      } else {
        secondaryRefs.current[d.instanceId] = L.marker(pos, {
          icon: makeIcon(SECONDARY_DRONE_SVG(d.color), [26, 26], [13, 13]),
          zIndexOffset: 900,
        }).bindTooltip(d.droneId, { permanent: false, className: 'clean-tooltip' }).addTo(map);
      }
    });
  }, [otherDrones]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    detections.forEach(det => {
      if (alertMarkers.current[det.id]) return;
      const marker = L.marker([det.lat, det.lng], {
        icon: makeIcon(ALERT_SVG, [30, 34], [15, 34]),
        zIndexOffset: 500,
      })
        .bindPopup(popupDetection(det), { className: 'clean-popup' })
        .addTo(map);
      marker.getElement()?.classList.add('alert-blink');
      alertMarkers.current[det.id] = marker;
    });
  }, [detections]);

  useEffect(() => {
    if (detections.length === 0 && mapInstance.current) {
      Object.values(alertMarkers.current).forEach(m => mapInstance.current.removeLayer(m));
      alertMarkers.current = {};
    }
  }, [detections.length]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    yoloAnomalies.forEach(anomaly => {
      if (yoloAnomalyMarkers.current[anomaly.id]) return;
      if (!anomaly.lat || !anomaly.lng) return;
      const sev = anomaly.severity === 'high' ? '#ef4444' : anomaly.severity === 'medium' ? '#f59e0b' : '#3b82f6';
      const camSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="17" fill="${sev}" fill-opacity="0.15" stroke="${sev}" stroke-width="2"/>
        <circle cx="18" cy="18" r="8" fill="${sev}"/>
        <circle cx="18" cy="18" r="4" fill="white"/>
        <rect x="10" y="13" width="16" height="11" rx="2" fill="none" stroke="${sev}" stroke-width="1.5"/>
        <path d="M26 15.5l4-2v9l-4-2z" fill="${sev}"/>
      </svg>`;
      const marker = L.marker([anomaly.lat, anomaly.lng], {
        icon: makeIcon(camSvg, [36, 36], [18, 18]),
        zIndexOffset: 1200,
      })
        .bindPopup(popupYoloAnomaly(anomaly, sev), { maxWidth: 260, className: 'clean-popup' })
        .addTo(map);
      yoloAnomalyMarkers.current[anomaly.id] = marker;
    });
  }, [yoloAnomalies]);

  useEffect(() => {
    window.__openAnomalyModal = (id) => {
      const found = yoloAnomalies.find(a => a.id === id);
      if (found) setModalAnomaly(found);
    };
    return () => { delete window.__openAnomalyModal; };
  }, [yoloAnomalies]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Planning mode overlay */}
      {planningMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-indigo-600 text-white text-xs font-mono px-4 py-2 rounded shadow-lg">
          Planning mode — click map to add waypoint ({customWaypoints.length} added)
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-3 right-3 z-[400] bg-white/90 backdrop-blur-sm border border-black/6 rounded-sm px-4 py-3 shadow-sm space-y-1.5 text-xs font-mono">
        <p className="text-black uppercase tracking-widest text-[12px] mb-2">Legend</p>
        <LegendRow color="bg-[#E4007F]" label="Visited path" line />
        <LegendRow color="bg-slate-300"  label="Planned route" dashed />
        <LegendRow color="bg-indigo-400" label="Power tower" dot />
        <LegendRow color="bg-rose-500"   label="Anomaly" dot />
        {yoloAnomalies.length > 0 && <LegendRow color="bg-rose-600" label={`YOLO (${yoloAnomalies.length})`} dot />}
        {otherDrones.filter(d => d.routeData).map(d => (
          <div key={d.instanceId} className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-black">{d.droneId}</span>
          </div>
        ))}
      </div>

      {/* Telemetry chip */}
      {dronePosition && (
        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm border border-black/6 rounded-sm px-4 py-3 shadow-sm text-xs font-mono space-y-0.5">
          <p className="text-black uppercase tracking-widest text-[10px] mb-1.5">Telemetry</p>
          <TelRow label="LAT" value={dronePosition.lat.toFixed(6)} />
          <TelRow label="LNG" value={dronePosition.lng.toFixed(6)} />
          <TelRow label="ALT" value={`${dronePosition.altitude?.toFixed(0) ?? '--'} m`} />
        </div>
      )}

      {/* Map style toggle */}
      <div className="absolute bottom-3 right-3 z-[400] flex gap-1 bg-white/90 backdrop-blur-sm border border-black/6 rounded p-1 shadow-sm">
        {MAP_STYLES.map(s => (
          <button key={s.id} onClick={() => setStyleId(s.id)}
            className={`px-3 py-1.5 rounded text-[11px] font-mono font-medium transition-all
              ${styleId === s.id ? 'bg-[#E4007F] text-white shadow-sm' : 'text-black hover:text-[#1d1d1f] hover:bg-black/5'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {!routeData && !planningMode && (
        <div className="absolute inset-0 flex items-center justify-center z-[400] pointer-events-none">
          <div className="bg-white/90 border border-black/6 rounded px-8 py-6 shadow-sm text-center">
            <p className="text-black text-sm">Select a drone or plan a custom route</p>
          </div>
        </div>
      )}

      {/* YOLO anomaly detail modal */}
      {modalAnomaly && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-6"
          onClick={() => setModalAnomaly(null)}
        >
          <div
            className="bg-white rounded shadow-2xl w-full max-w-2xl overflow-hidden border border-black/10"
            onClick={e => e.stopPropagation()}
          >
            {/* Solid magenta header */}
            <div className="bg-[#E4007F] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-white/70 uppercase tracking-widest font-mono">YOLO AI Detection</p>
                  <h2 className="text-base font-bold text-white capitalize leading-tight">{modalAnomaly.className}</h2>
                </div>
              </div>
              <button
                onClick={() => setModalAnomaly(null)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/20 text-white transition text-xl leading-none font-light"
              >
                ×
              </button>
            </div>

            {/* Severity strip */}
            {(() => {
              const sev = modalAnomaly.severity;
              const cfg = sev === 'high'
                ? { bg: 'bg-red-600', label: 'HIGH SEVERITY' }
                : sev === 'medium'
                ? { bg: 'bg-amber-500', label: 'MEDIUM SEVERITY' }
                : { bg: 'bg-blue-500', label: 'LOW SEVERITY' };
              return (
                <div className={`${cfg.bg} px-6 py-1.5 flex items-center gap-2`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[11px] font-mono font-bold text-white tracking-widest">{cfg.label}</span>
                </div>
              );
            })()}

            {/* Image */}
            {modalAnomaly.imageDataUrl && (
              <div className="mx-5 mt-5 mb-4 rounded overflow-hidden border border-black/8 bg-black">
                <img
                  src={modalAnomaly.imageDataUrl}
                  alt="Detection frame"
                  className="w-full max-h-[360px] object-contain"
                />
              </div>
            )}

            {/* Info grid */}
            <div className="px-5 pb-5 grid grid-cols-3 gap-2.5">
              <InfoRow label="Confidence"  value={`${(modalAnomaly.confidence * 100).toFixed(1)}%`} accent />
              <InfoRow label="Altitude"    value={`${modalAnomaly.altitude?.toFixed(0) ?? '--'} m`} />
              <InfoRow label="Timestamp"   value={`T+${modalAnomaly.timestamp?.toFixed(1)}s`} />
              <InfoRow label="Latitude"    value={modalAnomaly.lat?.toFixed(6)} />
              <InfoRow label="Longitude"   value={modalAnomaly.lng?.toFixed(6)} />
              <InfoRow label="Drone"       value={modalAnomaly.droneId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label, line, dashed, dot }) {
  return (
    <div className="flex items-center gap-2 text-[#1d1d1f]">
      {dot    && <span className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />}
      {line   && <span className={`w-5 h-0.5 rounded-sm ${color} flex-shrink-0`} />}
      {dashed && <span className="w-5 flex-shrink-0 border-t-2 border-dashed border-slate-300" />}
      <span className="text-black">{label}</span>
    </div>
  );
}

function InfoRow({ label, value, accent = false }) {
  return (
    <div className={`flex flex-col gap-1 px-3 py-2.5 rounded border ${
      accent
        ? 'bg-[#E4007F]/5 border-[#E4007F]/25'
        : 'bg-[#f5f5f7] border-black/5'
    }`}>
      <span className="text-[9px] uppercase tracking-widest font-mono text-black/40">{label}</span>
      <span className={`text-sm font-mono font-semibold leading-none ${accent ? 'text-[#E4007F]' : 'text-[#1d1d1f]'}`}>{value ?? '—'}</span>
    </div>
  );
}

function TelRow({ label, value }) {
  return (
    <div className="flex justify-between gap-5">
      <span className="text-black">{label}</span>
      <span className="text-[#1d1d1f] font-medium">{value}</span>
    </div>
  );
}

function popupTower(wp, i) {
  return `<div style="background:#fff;color:#1d1d1f;padding:10px 12px;border-radius:2px;font-family:monospace;font-size:12px;min-width:170px;border:1px solid rgba(0,0,0,0.08);box-shadow:0 4px 12px rgba(0,0,0,0.08)">
    <b style="color:#6366f1;font-size:13px">${wp.name || `Tower T-${String(i + 1).padStart(3, '0')}`}</b><br/>
    <span style="color:#111">Lat: ${wp.lat.toFixed(5)}</span><br/>
    <span style="color:#111">Lng: ${wp.lng.toFixed(5)}</span><br/>
    <span style="color:#111">Alt: ${wp.altitude}m</span>
  </div>`;
}

function popupYoloAnomaly(a, sev) {
  const img = a.imageDataUrl
    ? `<img src="${a.imageDataUrl}" onclick="window.__openAnomalyModal('${a.id}')" style="width:100%;border-radius:2px;margin-bottom:8px;display:block;cursor:pointer;border:1px solid rgba(0,0,0,0.08)" title="Click to enlarge"/>`
    : '';
  return `<div style="background:#fff;color:#1d1d1f;padding:0;border-radius:2px;font-family:monospace;font-size:12px;min-width:230px;border:1px solid rgba(0,0,0,0.12);box-shadow:0 8px 24px rgba(0,0,0,0.18);overflow:hidden">
    <div style="background:#E4007F;padding:8px 12px;display:flex;align-items:center;gap:6px">
      <b style="color:white;font-size:12px">⚠ YOLO: ${a.className.toUpperCase()}</b>
    </div>
    <div style="background:${sev};padding:3px 12px">
      <span style="color:white;font-size:10px;font-weight:700;letter-spacing:0.1em">${(a.severity || '').toUpperCase()} SEVERITY</span>
    </div>
    <div style="padding:10px 12px">
      ${img}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px">
        <div style="background:#f5f5f7;padding:5px 8px;border-radius:2px"><span style="color:#999;font-size:9px;display:block;text-transform:uppercase;letter-spacing:0.08em">Confidence</span><b style="color:#E4007F">${(a.confidence * 100).toFixed(1)}%</b></div>
        <div style="background:#f5f5f7;padding:5px 8px;border-radius:2px"><span style="color:#999;font-size:9px;display:block;text-transform:uppercase;letter-spacing:0.08em">Altitude</span><b>${a.altitude?.toFixed(0) ?? '--'} m</b></div>
        <div style="background:#f5f5f7;padding:5px 8px;border-radius:2px"><span style="color:#999;font-size:9px;display:block;text-transform:uppercase;letter-spacing:0.08em">Latitude</span><b>${a.lat?.toFixed(5)}</b></div>
        <div style="background:#f5f5f7;padding:5px 8px;border-radius:2px"><span style="color:#999;font-size:9px;display:block;text-transform:uppercase;letter-spacing:0.08em">Longitude</span><b>${a.lng?.toFixed(5)}</b></div>
      </div>
      <span style="color:#999;font-size:10px">Drone: ${a.droneId} · T+${a.timestamp?.toFixed(1)}s</span>
    </div>
  </div>`;
}

function popupDetection(det) {
  const sev = det.severity === 'high' ? '#ef4444' : det.severity === 'medium' ? '#f59e0b' : '#3b82f6';
  return `<div style="background:#fff;color:#1d1d1f;padding:12px 14px;border-radius:2px;font-family:monospace;font-size:12px;min-width:230px;border:1px solid #fecaca;box-shadow:0 4px 16px rgba(239,68,68,0.12)">
    <b style="color:#ef4444;font-size:13px">⚠ ${det.className.toUpperCase()}</b><br/>
    <span style="color:#111;font-size:11px;line-height:1.5">${det.description}</span><br/><br/>
    <span style="color:#111">Severity: </span><b style="color:${sev}">${det.severity.toUpperCase()}</b><br/>
    <span style="color:#111">Confidence: </span><b style="color:#1d1d1f">${(det.confidence * 100).toFixed(1)}%</b><br/>
    <span style="color:#111">Tower T-${String(det.waypointId + 1).padStart(3, '0')}</span> &nbsp;·&nbsp; <span style="color:#111">T+${det.timestamp}s</span>
  </div>`;
}