const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const inspectionRoutes = require('./routes/inspection');
const missionRoutes = require('./routes/mission');
const routesApi = require('./routes/routesApi');
const detectionsApi = require('./routes/detections');

const app = express();
const PORT = process.env.PORT || 3001;
const projectRoot = path.resolve(__dirname, '..');

app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve video files from the repository root.
const videosDir = path.join(projectRoot, 'videos');
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
app.use('/videos', express.static(videosDir));

app.use('/api/inspection', inspectionRoutes);
app.use('/api/mission', missionRoutes);
app.use('/api/routes', routesApi);
app.use('/api/detections', detectionsApi);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'drone-inspection-backend' });
});

app.listen(PORT, () => {
  console.log(`\n🚁 Drone Inspection Backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Videos served from: ${videosDir}\n`);
});
