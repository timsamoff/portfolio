// Utilities/config.js
// Shared configuration for all portfolio utility scripts

const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');

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

config.fileExists = function(filePath) {
    return fs.existsSync(filePath);
};

config.ensureDir = function(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    }
    return false;
};

config.getTimestamp = function() {
    return new Date().toISOString().replace(/[:.]/g, '-');
};

// Checks both the utilities/ and project-root locations
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