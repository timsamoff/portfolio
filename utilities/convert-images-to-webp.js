// Utilities/convert-images-to-webp.js
// Run with: node convert-images-to-webp.js [input-directory] [output-directory] [quality] [options]

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const config = require('./config.js');

const execPromise = util.promisify(exec);

// Configuration with defaults from shared config
const CONFIG = {
    inputDir: process.argv[2] || config.rootDir,
    outputDir: process.argv[3] || null,
    quality: parseInt(process.argv[4]) || config.defaults.quality,
    deleteOriginal: process.argv.includes('--delete'),
    overwrite: process.argv.includes('--overwrite'),
    skipExisting: !process.argv.includes('--overwrite'),
    imageExtensions: config.defaults.imageExtensions,
    maxFileSizeMB: config.defaults.maxFileSizeMB,
    concurrency: config.defaults.concurrency
};

// ========================================
// WINDOWS TOOL DETECTION
// ========================================

// Common installation paths on Windows
const windowsPaths = {
    cwebp: [
        'C:\\Program Files\\webp\\bin',
        'C:\\Program Files (x86)\\webp\\bin',
        'C:\\libwebp\\bin',
        'C:\\webp\\bin',
        process.env.LOCALAPPDATA + '\\Programs\\webp\\bin',
        process.env.USERPROFILE + '\\Downloads\\libwebp-*\\bin',
        process.env.USERPROFILE + '\\webp\\bin'
    ],
    imagemagick: [
        'C:\\Program Files\\ImageMagick',
        'C:\\Program Files (x86)\\ImageMagick',
        'C:\\Program Files\\ImageMagick-*',
        'C:\\Program Files (x86)\\ImageMagick-*',
        process.env.LOCALAPPDATA + '\\Programs\\ImageMagick'
    ],
    ffmpeg: [
        'C:\\ffmpeg\\bin',
        'C:\\Program Files\\ffmpeg\\bin',
        'C:\\Program Files (x86)\\ffmpeg\\bin',
        process.env.LOCALAPPDATA + '\\Programs\\ffmpeg\\bin',
        process.env.USERPROFILE + '\\ffmpeg\\bin'
    ]
};

// Windows executable names
const windowsExecutables = {
    cwebp: 'cwebp.exe',
    imagemagick: 'magick.exe',  // Newer versions use magick.exe
    imagemagick_legacy: 'convert.exe', // Older versions use convert.exe
    ffmpeg: 'ffmpeg.exe'
};

async function findToolOnWindows(toolName) {
    // First check if it's in PATH
    try {
        const cmd = toolName === 'imagemagick' ? 'magick -version' : `${toolName} -version`;
        await execPromise(cmd);
        return toolName; // Found in PATH
    } catch (err) {
        // Not in PATH, check common installation locations
    }
    
    // Check common installation paths
    const paths = windowsPaths[toolName] || [];
    for (const basePath of paths) {
        // Handle wildcard paths
        if (basePath.includes('*')) {
            const baseDir = basePath.substring(0, basePath.lastIndexOf('\\'));
            if (fs.existsSync(baseDir)) {
                const dirs = fs.readdirSync(baseDir);
                for (const dir of dirs) {
                    const fullPath = path.join(baseDir, dir);
                    const exePath = toolName === 'imagemagick' 
                        ? path.join(fullPath, windowsExecutables.imagemagick)
                        : path.join(fullPath, windowsExecutables[toolName]);
                    
                    if (fs.existsSync(exePath)) {
                        return exePath;
                    }
                    
                    // Also check bin subfolder
                    const binPath = path.join(fullPath, 'bin');
                    const exeInBin = toolName === 'imagemagick'
                        ? path.join(binPath, windowsExecutables.imagemagick)
                        : path.join(binPath, windowsExecutables[toolName]);
                    
                    if (fs.existsSync(exeInBin)) {
                        return exeInBin;
                    }
                }
            }
        } else {
            // Check direct path
            const exePath = toolName === 'imagemagick'
                ? path.join(basePath, windowsExecutables.imagemagick)
                : path.join(basePath, windowsExecutables[toolName]);
            
            if (fs.existsSync(exePath)) {
                return exePath;
            }
            
            // Check for legacy ImageMagick
            if (toolName === 'imagemagick') {
                const legacyPath = path.join(basePath, windowsExecutables.imagemagick_legacy);
                if (fs.existsSync(legacyPath)) {
                    return legacyPath;
                }
            }
        }
    }
    
    return null;
}

async function detectAvailableTool() {
    const isWindows = process.platform === 'win32';
    
    // Tool detection order: cwebp (best), imagemagick, ffmpeg
    const tools = ['cwebp', 'imagemagick', 'ffmpeg'];
    
    for (const tool of tools) {
        let toolPath = null;
        
        if (isWindows) {
            toolPath = await findToolOnWindows(tool);
        } else {
            // Unix-like systems
            try {
                const cmd = tool === 'imagemagick' ? 'convert -version' : `${tool} -version`;
                await execPromise(cmd);
                toolPath = tool;
            } catch (err) {
                // Not found
            }
        }
        
        if (toolPath) {
            const displayName = tool === 'imagemagick' ? 'ImageMagick' : tool;
            console.log(`✓ Found ${displayName} at: ${toolPath}`);
            return { name: tool, path: toolPath };
        }
    }
    
    return null;
}

function getToolCommand(tool, inputPath, outputPath, quality) {
    const isWindows = process.platform === 'win32';
    const toolPath = tool.path;
    
    // If toolPath is just the name (found in PATH), use it directly
    // Otherwise use the full path
    const cmdName = isWindows && toolPath !== tool.name
        ? `"${toolPath}"` // Wrap in quotes for Windows paths with spaces
        : tool.name;
    
    switch (tool.name) {
        case 'cwebp':
            return `${cmdName} -q ${quality} "${inputPath}" -o "${outputPath}"`;
        case 'imagemagick': {
            // On Windows with new ImageMagick, use magick convert
            const isWindowsNew = isWindows && toolPath && toolPath.includes('magick.exe');
            const convertCmd = isWindowsNew ? 'magick convert' : 'convert';
            const cmd = toolPath !== tool.name ? `"${toolPath}"` : convertCmd;
            return `${cmd} "${inputPath}" -quality ${quality} "${outputPath}"`;
        }
        case 'ffmpeg': {
            const ffmpegQuality = Math.round(31 - (quality / 100) * 30);
            return `${cmdName} -i "${inputPath}" -c:v libwebp -quality ${ffmpegQuality} -y "${outputPath}"`;
        }
        default:
            throw new Error(`Unsupported tool: ${tool.name}`);
    }
}

function getFileSizeMB(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size / (1024 * 1024);
    } catch (err) {
        return 0;
    }
}

function getAllImageFiles(dir, baseDir = null) {
    let results = [];
    const list = fs.readdirSync(dir);
    
    baseDir = baseDir || dir;
    
    list.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllImageFiles(fullPath, baseDir));
        } else {
            const ext = path.extname(item).toLowerCase();
            if (CONFIG.imageExtensions.includes(ext) && 
                getFileSizeMB(fullPath) <= CONFIG.maxFileSizeMB) {
                const relativePath = path.relative(baseDir, fullPath);
                results.push({
                    fullPath: fullPath,
                    relativePath: relativePath,
                    fileName: item,
                    ext: ext,
                    size: getFileSizeMB(fullPath)
                });
            }
        }
    });
    
    return results;
}

function getOutputPath(inputFile, inputDir) {
    const relativePath = path.relative(inputDir, inputFile.fullPath);
    const outputPath = CONFIG.outputDir || inputDir;
    const outputFileName = path.basename(inputFile.fileName, inputFile.ext) + '.webp';
    const outputRelativePath = path.join(path.dirname(relativePath), outputFileName);
    return path.join(outputPath, outputRelativePath);
}

function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function convertImage(inputFile, inputDir, tool) {
    const outputPath = getOutputPath(inputFile, inputDir);
    
    if (CONFIG.skipExisting && fs.existsSync(outputPath)) {
        return {
            success: true,
            skipped: true,
            outputPath: outputPath,
            reason: 'WebP already exists'
        };
    }
    
    ensureDirectoryExists(outputPath);
    
    try {
        const command = getToolCommand(tool, inputFile.fullPath, outputPath, CONFIG.quality);
        await execPromise(command);
        
        if (CONFIG.deleteOriginal) {
            fs.unlinkSync(inputFile.fullPath);
        }
        
        return {
            success: true,
            skipped: false,
            outputPath: outputPath,
            originalSize: inputFile.size,
            originalPath: inputFile.fullPath
        };
    } catch (err) {
        return {
            success: false,
            error: err.message,
            outputPath: outputPath
        };
    }
}

async function convertImagesInParallel(imageFiles, inputDir, tool) {
    const results = {
        total: imageFiles.length,
        converted: 0,
        skipped: 0,
        failed: 0,
        totalOriginalSize: 0,
        totalNewSize: 0,
        details: []
    };
    
    const batches = [];
    for (let i = 0; i < imageFiles.length; i += CONFIG.concurrency) {
        batches.push(imageFiles.slice(i, i + CONFIG.concurrency));
    }
    
    let completed = 0;
    const totalFiles = imageFiles.length;
    
    for (const batch of batches) {
        const batchPromises = batch.map(async (file) => {
            const result = await convertImage(file, inputDir, tool);
            
            if (result.success) {
                if (result.skipped) {
                    results.skipped++;
                } else {
                    results.converted++;
                    try {
                        const stats = fs.statSync(result.outputPath);
                        results.totalNewSize += stats.size / (1024 * 1024);
                        result.newSize = stats.size / (1024 * 1024);
                    } catch (err) {}
                    results.totalOriginalSize += file.size;
                }
            } else {
                results.failed++;
            }
            results.details.push({ file, result });
            
            completed++;
            if (completed % 10 === 0 || completed === totalFiles) {
                console.log(`Progress: ${completed}/${totalFiles} files processed`);
            }
            
            return { file, result };
        });
        
        await Promise.all(batchPromises);
    }
    
    return results;
}

function printSummary(results) {
    console.log('\n=== Conversion Summary ===');
    console.log(`Total files found: ${results.total}`);
    console.log(`Successfully converted: ${results.converted}`);
    console.log(`Skipped (already exist): ${results.skipped}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.converted > 0) {
        const savings = results.totalOriginalSize - results.totalNewSize;
        const savingsPercent = (savings / results.totalOriginalSize * 100).toFixed(1);
        console.log(`\nTotal original size: ${results.totalOriginalSize.toFixed(2)} MB`);
        console.log(`Total new size: ${results.totalNewSize.toFixed(2)} MB`);
        console.log(`Saved: ${savings.toFixed(2)} MB (${savingsPercent}%)`);
    }
    
    if (results.failed > 0) {
        console.log('\nFailed conversions:');
        results.details
            .filter(d => !d.result.success)
            .forEach(d => {
                console.log(`  ❌ ${d.file.relativePath}: ${d.result.error}`);
            });
    }
    
    if (CONFIG.deleteOriginal) {
        console.log('\n⚠️  Original files were deleted!');
    }
}

async function main() {
    console.log('=== WebP Image Converter ===\n');
    console.log(`Input directory: ${CONFIG.inputDir}`);
    console.log(`Output directory: ${CONFIG.outputDir || CONFIG.inputDir}`);
    console.log(`Quality: ${CONFIG.quality}`);
    console.log(`Delete original: ${CONFIG.deleteOriginal}`);
    console.log(`Overwrite existing: ${CONFIG.overwrite}`);
    console.log(`Max file size: ${CONFIG.maxFileSizeMB} MB\n`);
    
    if (!fs.existsSync(CONFIG.inputDir)) {
        console.error(`Error: Input directory "${CONFIG.inputDir}" does not exist.`);
        process.exit(1);
    }
    
    console.log('Detecting available image conversion tools...');
    const tool = await detectAvailableTool();
    
    if (!tool) {
        console.error('\nError: No image conversion tool found.');
        console.error('Please install one of the following:');
        console.error('  - cwebp: https://developers.google.com/speed/webp/download');
        console.error('  - ImageMagick: https://imagemagick.org/script/download.php');
        console.error('  - FFmpeg: https://ffmpeg.org/download.html');
        console.error('\nAfter installing, make sure the tool is in your PATH or restart your terminal.');
        process.exit(1);
    }
    
    console.log(`\nScanning for images in ${CONFIG.inputDir}...`);
    const imageFiles = getAllImageFiles(CONFIG.inputDir);
    
    if (imageFiles.length === 0) {
        console.log('No image files found.');
        return;
    }
    
    console.log(`Found ${imageFiles.length} image files to process.\n`);
    
    if (CONFIG.deleteOriginal) {
        console.log('⚠️  WARNING: You have enabled --delete flag. Original files will be deleted.');
        console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('Continuing...\n');
    }
    
    console.log('Starting conversion...');
    const startTime = Date.now();
    const results = await convertImagesInParallel(imageFiles, CONFIG.inputDir, tool);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\nCompleted in ${elapsedTime} seconds`);
    printSummary(results);
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: node convert-images-to-webp.js [input-directory] [output-directory] [quality] [options]

Arguments:
  input-directory   Directory to scan for images (default: parent directory of Utilities)
  output-directory  Directory to save WebP files (default: same as input)
  quality           Image quality 0-100 (default: 80)

Options:
  --delete          Delete original files after conversion
  --overwrite       Overwrite existing WebP files
  --help, -h        Show this help message

Examples:
  node convert-images-to-webp.js ../images
  node convert-images-to-webp.js ../images ../webp-output 85
  node convert-images-to-webp.js ../images ../webp-output 90 --delete --overwrite
            `);
            process.exit(0);
        }
    }
}

parseArgs();
main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});