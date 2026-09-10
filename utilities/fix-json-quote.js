// Utilities/fix-json-quote.js
// Fix smart quotes and malformed quotes in projects.json

const fs = require('fs');
const path = require('path');
const config = require('./config.js');

const jsonPath = config.findProjectsFile() || config.projectsFile;
const backupPath = path.join(config.backupsDir, `projects.backup.${config.getTimestamp()}.json`);

config.ensureDir(config.backupsDir);

try {
    if (!fs.existsSync(jsonPath)) {
        console.error('❌ projects.json not found!');
        console.error(`   Looked in: ${jsonPath}`);
        process.exit(1);
    }

    const original = fs.readFileSync(jsonPath, 'utf8');
    fs.writeFileSync(backupPath, original, 'utf8');
    console.log(`📦 Backup created: ${path.basename(backupPath)}`);

    let fixed = original;

    fixed = fixed.replace(/[“”]/g, '"');
    fixed = fixed.replace(/[‘’]/g, "'");

    // href specifically, since its quotes double as HTML attribute delimiters
    fixed = fixed.replace(/href=([\"']?)([^\"'\s>]+)([\"']?)/g, (match, open, url, close) => {
        return `href="${url.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")}"`;
    });

    fs.writeFileSync(jsonPath, fixed, 'utf8');

    console.log('✅ Fixed projects.json');
    console.log(`💾 Original backed up to: ${path.basename(backupPath)}`);

    try {
        JSON.parse(fixed);
        console.log('✅ JSON validation passed');
    } catch (err) {
        console.log('⚠️  JSON still has issues. Restore from backup if needed.');
    }
    
} catch (err) {
    console.error('❌ Error:', err.message);
}