// Utilities/config.js
// Shared configuration for all portfolio utility scripts

const path = require('path');
const fs = require('fs');

// Root directory (parent of Utilities folder)
const rootDir = path.join(__dirname, '..');

// File paths
const config = {
    rootDir: rootDir,
    projectsFile: path.join(rootDir, 'projects.json'),
    backupsDir: path.join(rootDir, 'backups'),
    mediaDir: path.join(rootDir, 'media'),
    
    // Default settings
    defaults: {
        quality: 80,
        maxFileSizeMB: 50,
        concurrency: 4,
        imageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif']
    }
};

// Check if a file exists
config.fileExists = function(filePath) {
    return fs.existsSync(filePath);
};

// Ensure directory exists
config.ensureDir = function(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    }
    return false;
};

// Get timestamp for backups
config.getTimestamp = function() {
    return new Date().toISOString().replace(/[:.]/g, '-');
};

// Find projects.json (checks both locations)
config.findProjectsFile = function() {
    const localPath = path.join(__dirname, 'projects.json');
    const parentPath = path.join(rootDir, 'projects.json');
    
    if (fs.existsSync(localPath)) {
        return localPath;
    } else if (fs.existsSync(parentPath)) {
        return parentPath;
    }
    return null;
};

module.exports = config;