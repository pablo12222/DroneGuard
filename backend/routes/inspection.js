const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const simulation = require('../services/simulationService');
const { loadDetections } = require('../services/detectionService');
const { getWeather } = require('../services/weatherService');

const ROUTES_DIR = path.join(__dirname, '..', '..', 'data', 'routes');

function loadRoute(routeId) {
  const files = fs.readdirSync(ROUTES_DIR);
  for (const f of files) {
    if (f.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(path.join(ROUTES_DIR, f), 'utf-8'));
      if (!routeId || data.id === routeId || f.replace('.json', '') === routeId) return data;
    }
  }
  return null;
}

// GET /api/inspection — list all active missions
router.get('/', (req, res) => {
  res.json(simulation.listMissions());
});

// DELETE /api/inspection/:missionId — stop and remove a mission
router.delete('/:missionId', (req, res) => {
  try {
    simulation.deleteMission(req.params.missionId);
    res.json({ success: true, missionId: req.params.missionId });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/inspection/start
router.post('/start', async (req, res) => {
  try {
    const { name, droneId, routeId, routeData: inlineRoute, videoPath, missionId: reqMissionId } = req.body;

    let route;
    if (inlineRoute && Array.isArray(inlineRoute.waypoints) && inlineRoute.waypoints.length >= 2) {
      route = {
        id: `custom_${Date.now()}`,
        name: inlineRoute.name || 'Custom Route',
        waypoints: inlineRoute.waypoints,
        estimatedDuration: inlineRoute.estimatedDuration || (inlineRoute.waypoints.length - 1) * 10,
        totalDistance: inlineRoute.totalDistance || 0,
        region: 'Custom',
        lineVoltage: 'N/A',
        operator: 'Manual',
      };
    } else {
      route = loadRoute(routeId);
    }
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const missionId = reqMissionId || uuidv4();
    const detections = loadDetections(missionId);

    // Fetch weather for start position
    const firstWp = route.waypoints[0];
    const weather = await getWeather(firstWp.lat, firstWp.lng);

    const state = simulation.createMission({
      missionId,
      name: name || `Inspection ${new Date().toLocaleTimeString()}`,
      droneId: droneId || 'DRONE-01',
      route,
      detections,
      videoPath: videoPath || null,
    });

    simulation.startMission(missionId);

    res.json({
      missionId,
      status: 'running',
      name: state.name,
      droneId: state.droneId,
      route: { id: route.id, name: route.name, waypointCount: route.waypoints.length },
      weather,
      startedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inspection/pause
router.post('/pause', (req, res) => {
  const { missionId } = req.body;
  if (!missionId) return res.status(400).json({ error: 'missionId required' });
  try {
    const state = simulation.pauseMission(missionId);
    res.json({ missionId, status: state.status });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/inspection/reset
router.post('/reset', (req, res) => {
  const { missionId } = req.body;
  if (!missionId) return res.status(400).json({ error: 'missionId required' });
  try {
    const state = simulation.resetMission(missionId);
    res.json({ missionId, status: state.status });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/inspection/route
router.post('/route', (req, res) => {
  const { missionId, waypoints } = req.body;
  if (!waypoints || !Array.isArray(waypoints)) {
    return res.status(400).json({ error: 'waypoints array required' });
  }
  res.json({ success: true, waypointCount: waypoints.length });
});

// GET /api/inspection/:id/status
router.get('/:id/status', (req, res) => {
  const state = simulation.getMissionState(req.params.id);
  if (!state) return res.status(404).json({ error: 'Mission not found' });

  res.json({
    missionId: state.id,
    status: state.status,
    dronePosition: state.dronePosition,
    waypointIndex: state.waypointIndex,
    progress: state.progress,
    simulationTime: state.simulationTime,
    anomalyCount: state.anomalyCount,
    detectionsFired: state.firedDetections.size,
  });
});

module.exports = router;
