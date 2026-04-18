const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const videosDir = path.resolve(__dirname, '..', '..', 'videos');

function buildUniqueFilename(dir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = filename;
  let counter = 1;

  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}_${counter}${ext}`;
    counter += 1;
  }

  return candidate;
}

// POST /api/videos/upload — stream raw video body to disk
// Headers: X-Filename: myvideo.mp4, Content-Type: video/mp4 (or any)
router.post('/upload', (req, res) => {
  const rawName = req.headers['x-filename'] || `upload_${Date.now()}.mp4`;
  const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

  const finalName = buildUniqueFilename(videosDir, safeName);
  const destPath = path.join(videosDir, finalName);
  const tempPath = path.join(videosDir, `.upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.part`);
  const writeStream = fs.createWriteStream(tempPath, { flags: 'wx' });

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    fs.rename(tempPath, destPath, (err) => {
      if (err) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
        res.status(500).json({ error: `Failed to finalize upload: ${err.message}` });
        return;
      }

      res.json({ success: true, filename: finalName, url: `/videos/${finalName}` });
    });
  });
  writeStream.on('error', (err) => {
    try { fs.unlinkSync(tempPath); } catch (_) {}
    res.status(500).json({ error: `Failed to save file: ${err.message}` });
  });
  req.on('error', (err) => {
    writeStream.destroy();
    try { fs.unlinkSync(tempPath); } catch (_) {}
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
