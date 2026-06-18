// Utilities/fix-links.js
// Fix malformed links in project descriptions
// Run with: node fix-links.js

const fs = require('fs');
const path = require('path');
const config = require('./config.js');

// Use config for paths
const PROJECTS_FILE = config.findProjectsFile() || config.projectsFile;
const BACKUP_DIR = config.backupsDir;

// Ensure backup directory exists
config.ensureDir(BACKUP_DIR);

// ========================
// LINK CLEANUP FUNCTIONS
// ========================
function cleanupMalformedLinks(html) {
    if (!html) return html;
    
    let cleaned = html;
    
    // Fix href with smart quotes - pattern: href="”URL”" or href=”URL”
    cleaned = cleaned.replace(/href=["'”‘’]\s*["'”‘’]?(https?:\/\/[^"'\s>]+)["'”‘’]\s*["'”‘’]?/g, 'href="$1"');
    cleaned = cleaned.replace(/href=”(https?:\/\/[^”\s>]+)”/g, 'href="$1"');
    cleaned = cleaned.replace(/href=‘([^’\s>]+)’/g, 'href="$1"');
    
    // Fix URLs that got double-wrapped (http://domain.com/"http://actual.com")
    cleaned = cleaned.replace(/href="https?:\/\/[^"]*?(https?:\/\/[^"]+)/g, function(match, captured) {
        return 'href="' + captured;
    });
    
    // Fix URLs with encoded smart quotes
    cleaned = cleaned.replace(/%E2%80%9C/g, '').replace(/%E2%80%9D/g, '');
    cleaned = cleaned.replace(/%E2%80%98/g, '').replace(/%E2%80%99/g, '');
    
    // Fix target and rel attributes with smart quotes
    cleaned = cleaned.replace(/target=”(_blank|_self|_parent|_top)”/g, 'target="$1"');
    cleaned = cleaned.replace(/target=‘(_blank|_self|_parent|_top)’/g, 'target="$1"');
    cleaned = cleaned.replace(/rel=”(noopener noreferrer|nofollow|noopener)”/g, 'rel="$1"');
    cleaned = cleaned.replace(/rel=‘(noopener noreferrer|nofollow|noopener)’/g, 'rel="$1"');
    
    // Fix any href with straight quotes but malformed URL (e.g., href="https://samoff.com/portfolio/\"https://samoff.com/circuit-scout\"")
    cleaned = cleaned.replace(/href="https?:\/\/[^"]*\\"https?:\/\//g, function(match) {
        // Extract just the clean URL after the escaped quote
        const cleanMatch = match.replace(/\\"/g, '').replace(/https?:\/\/[^"]*?(https?:\/\/)/, '$1');
        return 'href="' + cleanMatch;
    });
    
    // Remove any escaped quotes that might be left
    cleaned = cleaned.replace(/\\"/g, '"');
    
    return cleaned;
}

// ========================
// MAIN SCRIPT
// ========================
function main() {
    console.log('🔧 Portfolio Link Fixer');
    console.log('========================\n');
    
    // Check if projects.json exists
    if (!fs.existsSync(PROJECTS_FILE)) {
        console.error('❌ Error: projects.json not found!');
        console.error(`   Looked in: ${PROJECTS_FILE}`);
        process.exit(1);
    }
    
    // Read the file
    console.log('📖 Reading projects.json...');
    const fileContent = fs.readFileSync(PROJECTS_FILE, 'utf8');
    
    // Parse JSON
    let projects;
    try {
        projects = JSON.parse(fileContent);
        console.log(`✅ Loaded ${projects.length} projects\n`);
    } catch (err) {
        console.error('❌ Error parsing JSON:', err.message);
        process.exit(1);
    }
    
    // Create backup with timestamp
    const timestamp = config.getTimestamp();
    const backupFile = path.join(BACKUP_DIR, `projects-backup-${timestamp}.json`);
    
    console.log(`💾 Creating backup: ${backupFile}`);
    fs.writeFileSync(backupFile, fileContent, 'utf8');
    console.log('✅ Backup created!\n');
    
    // Track fixes
    let totalFixed = 0;
    let projectsWithFixes = 0;
    
    // Process each project
    const fixedProjects = projects.map((project, index) => {
        let fixed = false;
        let originalDesc = project.description || '';
        let cleanedDesc = cleanupMalformedLinks(originalDesc);
        
        if (cleanedDesc !== originalDesc) {
            fixed = true;
            totalFixed++;
            console.log(`📝 Project ${index + 1}: "${project.title}"`);
            console.log(`   Before: ${originalDesc.substring(0, 100)}${originalDesc.length > 100 ? '...' : ''}`);
            console.log(`   After:  ${cleanedDesc.substring(0, 100)}${cleanedDesc.length > 100 ? '...' : ''}`);
            console.log('');
            
            // Also check if there are URLs in the description that need fixing
            const urlMatches = originalDesc.match(/https?:\/\/[^\s<>"']+/g) || [];
            const cleanedMatches = cleanedDesc.match(/https?:\/\/[^\s<>"']+/g) || [];
            
            if (urlMatches.length > 0) {
                console.log(`   🔗 URLs found: ${urlMatches.length}`);
                urlMatches.forEach((url, i) => {
                    console.log(`      ${i + 1}. ${url}`);
                });
                console.log('');
            }
        }
        
        return {
            ...project,
            description: cleanedDesc
        };
    });
    
    // Count projects with fixes
    projectsWithFixes = projects.filter((p, i) => p.description !== fixedProjects[i].description).length;
    
    // Save the fixed projects
    console.log(`\n💾 Saving fixed projects.json...`);
    const formattedJson = JSON.stringify(fixedProjects, null, 2);
    fs.writeFileSync(PROJECTS_FILE, formattedJson, 'utf8');
    console.log('✅ Saved!\n');
    
    // Summary
    console.log('📊 SUMMARY');
    console.log('==========');
    console.log(`📁 Total projects: ${projects.length}`);
    console.log(`🔧 Projects fixed: ${projectsWithFixes}`);
    console.log(`📝 Total fixes applied: ${totalFixed}`);
    console.log(`💾 Backup saved to: ${backupFile}`);
    console.log('\n✨ All done! Links have been cleaned up.');
}

// Run the script
main();