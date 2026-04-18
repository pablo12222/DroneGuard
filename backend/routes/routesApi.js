const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const ROUTES_DIR = path.join(__dirname, '..', '..', 'data', 'routes');

// GET /api/routes
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.json'));
    const routes = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(ROUTES_DIR, f), 'utf-8'));
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        totalDistance: data.totalDistance,
        estimatedDuration: data.estimatedDuration,
        waypointCount: data.waypoints.length,
        region: data.region,
        lineVoltage: data.lineVoltage,
      };
    });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/:id
router.get('/:id', (req, res) => {
  try {
    const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(ROUTES_DIR, f), 'utf-8'));
      if (data.id === req.params.id) return res.json(data);
    }
    res.status(404).json({ error: 'Route not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
