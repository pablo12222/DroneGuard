const express = require('express');
const router = express.Router();
const simulation = require('../services/simulationService');

// GET /api/detections/:inspectionId
router.get('/:inspectionId', (req, res) => {
  const state = simulation.getMissionState(req.params.inspectionId);
  if (!state) return res.status(404).json({ error: 'Inspection not found' });

  const firedDets = state.detections.filter(d => state.firedDetections.has(d.id));
  res.json({
    inspectionId: req.params.inspectionId,
    total: firedDets.length,
    anomalies: firedDets.filter(d => d.isAnomaly).length,
    detections: firedDets,
  });
});

module.exports = router;
