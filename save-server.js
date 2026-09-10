const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

// Ensure backups directory exists
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ========================================
// BACKUP FUNCTIONS
// ========================================

function createBackup(filename, data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${path.basename(filename, '.json')}_${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    
    try {
        const jsonData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        fs.writeFileSync(backupPath, jsonData, 'utf8');
        console.log(`📁 Backup created: ${backupFilename}`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to create backup: ${err.message}`);
        return false;
    }
}

function createInitialBackup() {
    const projectsPath = path.join(__dirname, 'projects.json');
    if (fs.existsSync(projectsPath)) {
        try {
            const data = fs.readFileSync(projectsPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
                createBackup(projectsPath, data);
                console.log('📁 Initial projects.json backup created');
            }
        } catch (err) {
            console.warn('⚠️ Could not backup projects.json on startup:', err.message);
        }
    }
    
    const categoriesPath = path.join(__dirname, 'categories.json');
    if (fs.existsSync(categoriesPath)) {
        try {
            const data = fs.readFileSync(categoriesPath, 'utf8');
            const parsed = JSON.parse(data);
            if (Object.keys(parsed).length > 0) {
                createBackup(categoriesPath, data);
                console.log('📁 Initial categories.json backup created');
            }
        } catch (err) {
            console.warn('⚠️ Could not backup categories.json on startup:', err.message);
        }
    }
}

// ========================================
// SERVER
// ========================================

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Saves to projects.json directly, no backup per-save (see createInitialBackup for startup backups)
    if (req.method === 'POST' && req.url === '/api/save-projects') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const projectsData = JSON.parse(body);
                const projectsPath = path.join(__dirname, 'projects.json');

                const formattedJson = JSON.stringify(projectsData, null, 2);
                fs.writeFileSync(projectsPath, formattedJson, 'utf8');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/save-categories') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const categoriesData = JSON.parse(body);
                const categoriesPath = path.join(__dirname, 'categories.json');
                
                const formattedJson = JSON.stringify(categoriesData, null, 2);
                fs.writeFileSync(categoriesPath, formattedJson, 'utf8');
                
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
    console.log(`📁 Backups will be saved to: ${BACKUP_DIR}`);

    createInitialBackup();
});