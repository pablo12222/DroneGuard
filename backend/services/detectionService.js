const path = require('path');
const fs = require('fs');

const DEMO_DETECTIONS_PATH = path.join(__dirname, '..', '..', 'data', 'detections', 'demo_detections.json');

function loadDetections(inspectionId) {
  try {
    const raw = fs.readFileSync(DEMO_DETECTIONS_PATH, 'utf-8');
    const dets = JSON.parse(raw);
    return dets.map(d => ({ ...d, inspectionId }));
  } catch (err) {
    console.warn('Could not load detections file, using empty array:', err.message);
    return [];
  }
}

// For future YOLO integration via Python service
async function runYoloInference(framePath, inspectionId, timestamp) {
  try {
    const fetch = require('node-fetch');
    const res = await fetch('http://localhost:8000/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame_path: framePath, timestamp }),
    });
    if (!res.ok) throw new Error(`YOLO service error: ${res.status}`);
    const data = await res.json();
    return data.detections.map(d => ({ ...d, inspectionId }));
  } catch (err) {
    console.warn('YOLO inference failed, falling back to mock data:', err.message);
    return [];
  }
}

module.exports = { loadDetections, runYoloInference };
