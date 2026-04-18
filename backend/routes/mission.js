const express = require('express');
const router = express.Router();
const simulation = require('../services/simulationService');

// GET /api/mission/:id/stream — SSE
router.get('/:id/stream', (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', missionId: id, timestamp: new Date().toISOString() })}\n\n`);

  simulation.addClient(id, res);

  // Send current state snapshot
  const state = simulation.getMissionState(id);
  if (state) {
    res.write(`data: ${JSON.stringify({
      type: 'state_snapshot',
      status: state.status,
      dronePosition: state.dronePosition,
      progress: state.progress,
      anomalyCount: state.anomalyCount,
      detections: state.detections.filter(d => state.firedDetections.has(d.id)),
    })}\n\n`);
  }

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    simulation.removeClient(id, res);
  });
});

module.exports = router;
