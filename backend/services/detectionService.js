const ANOMALY_TEMPLATES = [
  {
    classId: 10, className: 'damaged insulator', severity: 'high', isAnomaly: true,
    description: 'Cracked insulator detected — immediate inspection recommended',
  },
  {
    classId: 11, className: 'corrosion', severity: 'medium', isAnomaly: true,
    description: 'Corrosion on tower cross-arm detected — schedule maintenance',
  },
  {
    classId: 12, className: 'broken conductor strand', severity: 'high', isAnomaly: true,
    description: 'Partial conductor damage detected — urgent review required',
  },
];

const NON_ANOMALY_TEMPLATES = [
  { classId: 7,  className: 'glass insulator',          severity: 'low',  isAnomaly: false, description: 'Glass insulator detected — no visible defects' },
  { classId: 3,  className: 'stockbridge damper',       severity: 'low',  isAnomaly: false, description: 'Stockbridge damper detected — condition appears normal' },
  { classId: 6,  className: 'polymer insulator',        severity: 'low',  isAnomaly: false, description: 'Polymer insulator detected — surface condition normal' },
  { classId: 0,  className: 'yoke',                     severity: 'info', isAnomaly: false, description: 'Yoke detected — component present and within expected condition' },
  { classId: 2,  className: 'spacer',                   severity: 'low',  isAnomaly: false, description: 'Conductor spacer detected — alignment appears normal' },
  { classId: 4,  className: 'lightning rod shackle',    severity: 'low',  isAnomaly: false, description: 'Lightning rod shackle detected — no maintenance issues' },
  { classId: 9,  className: 'vari-grip',                severity: 'info', isAnomaly: false, description: 'Vari-grip conductor clamp detected — component intact' },
  { classId: 15, className: 'glass insulator tower shackle', severity: 'low', isAnomaly: false, description: 'Tower shackle detected — no structural issues visible' },
];

function generateDetections(route, videoPath) {
  // If video provided, YOLO handles detections live from the frontend
  if (videoPath) return [];

  const wps = route.waypoints;
  const n = wps.length;
  if (n < 3) return [];

  const results = [];

  // Place 3 anomalies at ~25%, 55%, 80% through the route
  const anomalyPositions = [
    Math.floor(n * 0.25),
    Math.floor(n * 0.55),
    Math.floor(n * 0.80),
  ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  // Place ~5 normal detections at other waypoints
  const anomalySet = new Set(anomalyPositions);
  const normalPositions = [...Array(n).keys()]
    .filter(i => !anomalySet.has(i))
    .filter((_, i) => i % Math.max(1, Math.floor(n / 6)) === 0)
    .slice(0, 6);

  anomalyPositions.forEach((wpIdx, i) => {
    const wp = wps[wpIdx];
    const tmpl = ANOMALY_TEMPLATES[i % ANOMALY_TEMPLATES.length];
    results.push({
      id: `auto_anomaly_${route.id}_${i}`,
      timestamp: wp.timestamp,
      waypointId: wp.id,
      ...tmpl,
      confidence: parseFloat((0.82 + (i * 0.05)).toFixed(2)),
      lat: wp.lat,
      lng: wp.lng,
      altitude: wp.altitude,
      bbox: { x: 120 + i * 55, y: 80 + i * 25, w: 80, h: 72 },
    });
  });

  normalPositions.forEach((wpIdx, i) => {
    const wp = wps[wpIdx];
    const tmpl = NON_ANOMALY_TEMPLATES[i % NON_ANOMALY_TEMPLATES.length];
    results.push({
      id: `auto_normal_${route.id}_${i}`,
      timestamp: wp.timestamp,
      waypointId: wp.id,
      ...tmpl,
      confidence: parseFloat((0.76 + (i * 0.03)).toFixed(2)),
      lat: wp.lat,
      lng: wp.lng,
      altitude: wp.altitude,
      bbox: { x: 140 + i * 40, y: 90 + i * 20, w: 70, h: 60 },
    });
  });

  // Sort by timestamp
  results.sort((a, b) => a.timestamp - b.timestamp);
  return results;
}

module.exports = { generateDetections };
