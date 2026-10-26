const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // 쿼리스트링 분리 (예: /style.css?v=123 -> /style.css)
  const urlPath = req.url.split('?')[0];
  let reqPath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(content);
  });
});

const os = require('os');

server.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(` Grammar Quest Web Server (PC & Mobile) on port ${PORT}`);
  console.log('====================================================');
  console.log(` - Local:   http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(` - Network: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('====================================================');
  console.log(' Press Ctrl+C to stop the server.');
});
