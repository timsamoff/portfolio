// Utilities/update-media-to-webp.js
// Update media paths in projects.json to use WebP format
// Run with: node update-media-to-webp.js

const fs = require('fs');
const path = require('path');
const config = require('./config.js');

// Configuration with defaults from shared config
const CONFIG = {
    // Path to your projects.json file
    projectsFile: config.findProjectsFile() || config.projectsFile,
    // Create a backup of the original file
    createBackup: true,
    // Backup directory
    backupDir: config.backupsDir,
    // Log changes to console
    verbose: true,
    // File extensions to convert to webp
    imageExtensions: config.defaults.imageExtensions,
    // Only convert if the webp file actually exists
    checkFileExists: false,
    // Directories to scan for webp files (relative to script location)
    mediaDirectories: [config.mediaDir]
};

// ========================================
// HELPER FUNCTIONS
// ========================================

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    }
    return false;
}

function log(message, type = 'info') {
    if (!CONFIG.verbose) return;
    
    const colors = {
        info: '\x1b[36m',    // Cyan
        success: '\x1b[32m', // Green
        warning: '\x1b[33m', // Yellow
        error: '\x1b[31m',   // Red
        reset: '\x1b[0m'     // Reset
    };
    
    const prefix = {
        info: 'ℹ️ ',
        success: '✅ ',
        warning: '⚠️ ',
        error: '❌ '
    };
    
    console.log(`${colors[type]}${prefix[type]}${message}${colors.reset}`);
}

function getWebpPath(mediaPath) {
    // Check if it's a URL (starts with http:// or https://)
    if (mediaPath.match(/^https?:\/\//)) {
        return null; // Don't convert URLs
    }
    
    // Check if it's a video file
    if (mediaPath.match(/\.(mp4|webm|mov|ogg|avi)$/i)) {
        return null; // Don't convert videos
    }
    
    // Check if it's already a webp
    if (mediaPath.match(/\.webp$/i)) {
        return null; // Already webp
    }
    
    // Check if it has an image extension
    const ext = path.extname(mediaPath).toLowerCase();
    if (!CONFIG.imageExtensions.includes(ext)) {
        return null; // Not an image we convert
    }
    
    // Replace extension with .webp
    return mediaPath.replace(/\.[^.]+$/, '.webp');
}

function findWebpFile(webpPath) {
    // Check if the webp file exists relative to the script
    if (fs.existsSync(webpPath)) {
        return true;
    }
    
    // Check in each media directory
    for (const dir of CONFIG.mediaDirectories) {
        const fullPath = path.join(dir, webpPath);
        if (fs.existsSync(fullPath)) {
            return true;
        }
    }
    
    return false;
}

function updateMediaArray(mediaArray, stats) {
    if (!mediaArray || !Array.isArray(mediaArray)) {
        return mediaArray;
    }
    
    const updated = [];
    let hasChanges = false;
    
    for (const mediaPath of mediaArray) {
        const webpPath = getWebpPath(mediaPath);
        
        if (webpPath) {
            // Check if webp file exists (if enabled)
            if (CONFIG.checkFileExists) {
                const exists = findWebpFile(webpPath);
                if (!exists) {
                    log(`WebP file not found for: ${mediaPath}`, 'warning');
                    updated.push(mediaPath);
                    continue;
                }
            }
            
            // Update to webp
            updated.push(webpPath);
            hasChanges = true;
            stats.converted++;
            log(`Converted: ${mediaPath} → ${webpPath}`, 'success');
        } else {
            // Keep as is
            updated.push(mediaPath);
        }
    }
    
    return { updated, hasChanges };
}

function processProjects(projects, stats) {
    const updatedProjects = [];
    
    for (const project of projects) {
        const updatedProject = { ...project };
        
        // Process media array
        if (project.media && Array.isArray(project.media)) {
            const result = updateMediaArray(project.media, stats);
            updatedProject.media = result.updated;
            if (result.hasChanges) {
                stats.projectsUpdated++;
            }
        }
        
        // Also check for single image field (legacy)
        if (project.image) {
            const webpPath = getWebpPath(project.image);
            if (webpPath) {
                if (CONFIG.checkFileExists) {
                    const exists = findWebpFile(webpPath);
                    if (exists) {
                        updatedProject.image = webpPath;
                        stats.converted++;
                        log(`Converted image: ${project.image} → ${webpPath}`, 'success');
                    }
                } else {
                    updatedProject.image = webpPath;
                    stats.converted++;
                    log(`Converted image: ${project.image} → ${webpPath}`, 'success');
                }
            }
        }
        
        updatedProjects.push(updatedProject);
    }
    
    return updatedProjects;
}

function createBackup(projects) {
    if (!CONFIG.createBackup) return null;
    
    // Ensure backup directory exists
    ensureDirectoryExists(CONFIG.backupDir);
    
    // Create backup filename with timestamp
    const timestamp = config.getTimestamp();
    const backupFile = path.join(CONFIG.backupDir, `projects-${timestamp}.json`);
    
    try {
        fs.writeFileSync(backupFile, JSON.stringify(projects, null, 2));
        log(`Backup created: ${backupFile}`, 'success');
        return backupFile;
    } catch (err) {
        log(`Error creating backup: ${err.message}`, 'warning');
        return null;
    }
}

// ========================================
// MAIN FUNCTION
// ========================================

async function main() {
    console.log('\n=== Update Media to WebP ===\n');
    
    // Check if projects.json exists
    if (!fs.existsSync(CONFIG.projectsFile)) {
        log(`Projects file "${CONFIG.projectsFile}" not found!`, 'error');
        process.exit(1);
    }
    
    // Read projects.json
    let projects;
    try {
        const data = fs.readFileSync(CONFIG.projectsFile, 'utf8');
        projects = JSON.parse(data);
        log(`Loaded ${projects.length} projects from ${CONFIG.projectsFile}`, 'info');
    } catch (err) {
        log(`Error reading ${CONFIG.projectsFile}: ${err.message}`, 'error');
        process.exit(1);
    }
    
    // Create backup
    const backupFile = createBackup(projects);
    
    // Process projects
    const stats = {
        converted: 0,
        projectsUpdated: 0,
        totalMediaItems: 0
    };
    
    // Count total media items first
    for (const project of projects) {
        if (project.media && Array.isArray(project.media)) {
            stats.totalMediaItems += project.media.length;
        }
    }
    
    log(`Processing ${stats.totalMediaItems} media items...`, 'info');
    console.log('');
    
    const updatedProjects = processProjects(projects, stats);
    
    // Write updated projects back to file
    try {
        fs.writeFileSync(CONFIG.projectsFile, JSON.stringify(updatedProjects, null, 2));
        log(`\n✅ Updated ${CONFIG.projectsFile}`, 'success');
    } catch (err) {
        log(`Error writing ${CONFIG.projectsFile}: ${err.message}`, 'error');
        process.exit(1);
    }
    
    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Total projects: ${projects.length}`);
    console.log(`Projects updated: ${stats.projectsUpdated}`);
    console.log(`Media items converted: ${stats.converted}`);
    console.log(`Media items unchanged: ${stats.totalMediaItems - stats.converted}`);
    
    if (backupFile) {
        console.log(`\n📁 Backup saved to: ${backupFile}`);
    }
    
    if (stats.converted === 0) {
        console.log('\n💡 No media items were converted. Make sure:');
        console.log('   - Your media paths have image extensions (.jpg, .png, etc.)');
        console.log('   - The corresponding .webp files exist (if checkFileExists is enabled)');
        console.log('   - Media items are not URLs or video files');
    } else {
        console.log(`\n🎉 Successfully updated ${stats.converted} media items to WebP!`);
        console.log('   Run your portfolio to see the changes.');
    }
    
    if (CONFIG.checkFileExists && stats.converted === 0) {
        console.log('\n💡 Tip: Set "checkFileExists": false in CONFIG to convert without checking if .webp files exist.');
    }
}

// ========================================
// COMMAND LINE ARGUMENTS
// ========================================

function parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: node update-media-to-webp.js [options]

Options:
  --file <path>       Path to projects.json (default: ../projects.json)
  --backup-dir <path> Directory for backups (default: ../backups)
  --no-backup         Skip creating a backup
  --check-files       Check if .webp files actually exist before converting
  --verbose           Show detailed output
  --help, -h          Show this help message

Examples:
  node update-media-to-webp.js
  node update-media-to-webp.js --file ../projects.json --check-files
  node update-media-to-webp.js --backup-dir ../my-backups --verbose
  node update-media-to-webp.js --no-backup
            `);
            process.exit(0);
        }
        
        if (arg === '--file' && args[i + 1]) {
            CONFIG.projectsFile = args[i + 1];
            i++;
        }
        
        if (arg === '--backup-dir' && args[i + 1]) {
            CONFIG.backupDir = args[i + 1];
            i++;
        }
        
        if (arg === '--no-backup') {
            CONFIG.createBackup = false;
        }
        
        if (arg === '--check-files') {
            CONFIG.checkFileExists = true;
        }
        
        if (arg === '--verbose') {
            CONFIG.verbose = true;
        }
    }
}

parseArgs();
main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});