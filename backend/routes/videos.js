const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const videosDir = path.resolve(__dirname, '..', '..', 'videos');

// POST /api/videos/upload — stream raw video body to disk
// Headers: X-Filename: myvideo.mp4, Content-Type: video/mp4 (or any)
router.post('/upload', (req, res) => {
  const rawName = req.headers['x-filename'] || `upload_${Date.now()}.mp4`;
  const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const destPath = path.join(videosDir, safeName);

  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

  const writeStream = fs.createWriteStream(destPath);
  req.pipe(writeStream);

  writeStream.on('finish', () => {
    res.json({ success: true, filename: safeName, url: `/videos/${safeName}` });
  });
  writeStream.on('error', (err) => {
    res.status(500).json({ error: `Failed to save file: ${err.message}` });
  });
  req.on('error', (err) => {
    writeStream.destroy();
    res.status(500).json({ error: `Upload stream error: ${err.message}` });
  });
});

// GET /api/videos — list available videos
router.get('/', (req, res) => {
  if (!fs.existsSync(videosDir)) return res.json([]);
  const files = fs.readdirSync(videosDir)
    .filter(f => /\.(mp4|webm|mov|avi)$/i.test(f))
    .map(f => ({ filename: f, url: `/videos/${f}` }));
  res.json(files);
});

module.exports = router;
