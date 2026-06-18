const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001; // Runs on a separate port so it won't conflict with Live Server

const server = http.createServer((req, res) => {
    // Enable CORS so the Live Server pages can safely talk to this script
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight browser requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Capture the payload and save it to projects.json
    if (req.method === 'POST' && req.url === '/api/save-projects') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const formattedJson = JSON.stringify(JSON.parse(body), null, 2);
                fs.writeFileSync(path.join(__dirname, 'projects.json'), formattedJson, 'utf8');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`\x1b[35m%s\x1b[0m`, `[Active] Data write-back handler listening on port ${PORT}`);
});