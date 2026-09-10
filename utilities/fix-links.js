// Utilities/fix-links.js
// Fix malformed links in project descriptions
// Run with: node fix-links.js

const fs = require('fs');
const path = require('path');
const config = require('./config.js');

const PROJECTS_FILE = config.findProjectsFile() || config.projectsFile;
const BACKUP_DIR = config.backupsDir;

config.ensureDir(BACKUP_DIR);

// ========================
// LINK CLEANUP FUNCTIONS
// ========================
function cleanupMalformedLinks(html) {
    if (!html) return html;
    
    let cleaned = html;

    // href wrapped in smart quotes: href="”URL”" or href=”URL”
    cleaned = cleaned.replace(/href=["'”‘’]\s*["'”‘’]?(https?:\/\/[^"'\s>]+)["'”‘’]\s*["'”‘’]?/g, 'href="$1"');
    cleaned = cleaned.replace(/href=”(https?:\/\/[^”\s>]+)”/g, 'href="$1"');
    cleaned = cleaned.replace(/href=‘([^’\s>]+)’/g, 'href="$1"');

    // Double-wrapped URLs: href="http://domain.com/"http://actual.com""
    cleaned = cleaned.replace(/href="https?:\/\/[^"]*?(https?:\/\/[^"]+)/g, function(match, captured) {
        return 'href="' + captured;
    });

    cleaned = cleaned.replace(/%E2%80%9C/g, '').replace(/%E2%80%9D/g, '');
    cleaned = cleaned.replace(/%E2%80%98/g, '').replace(/%E2%80%99/g, '');

    cleaned = cleaned.replace(/target=”(_blank|_self|_parent|_top)”/g, 'target="$1"');
    cleaned = cleaned.replace(/target=‘(_blank|_self|_parent|_top)’/g, 'target="$1"');
    cleaned = cleaned.replace(/rel=”(noopener noreferrer|nofollow|noopener)”/g, 'rel="$1"');
    cleaned = cleaned.replace(/rel=‘(noopener noreferrer|nofollow|noopener)’/g, 'rel="$1"');

    // Escaped-quote + malformed URL, e.g. href="https://samoff.com/portfolio/\"https://samoff.com/circuit-scout\""
    cleaned = cleaned.replace(/href="https?:\/\/[^"]*\\"https?:\/\//g, function(match) {
        const cleanMatch = match.replace(/\\"/g, '').replace(/https?:\/\/[^"]*?(https?:\/\/)/, '$1');
        return 'href="' + cleanMatch;
    });

    cleaned = cleaned.replace(/\\"/g, '"');

    return cleaned;
}

// ========================
// MAIN SCRIPT
// ========================
function main() {
    console.log('🔧 Portfolio Link Fixer');
    console.log('========================\n');

    if (!fs.existsSync(PROJECTS_FILE)) {
        console.error('❌ Error: projects.json not found!');
        console.error(`   Looked in: ${PROJECTS_FILE}`);
        process.exit(1);
    }

    console.log('📖 Reading projects.json...');
    const fileContent = fs.readFileSync(PROJECTS_FILE, 'utf8');

    let projects;
    try {
        projects = JSON.parse(fileContent);
        console.log(`✅ Loaded ${projects.length} projects\n`);
    } catch (err) {
        console.error('❌ Error parsing JSON:', err.message);
        process.exit(1);
    }
    
    const timestamp = config.getTimestamp();
    const backupFile = path.join(BACKUP_DIR, `projects-backup-${timestamp}.json`);
    
    console.log(`💾 Creating backup: ${backupFile}`);
    fs.writeFileSync(backupFile, fileContent, 'utf8');
    console.log('✅ Backup created!\n');

    let totalFixed = 0;
    let projectsWithFixes = 0;

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
    
    projectsWithFixes = projects.filter((p, i) => p.description !== fixedProjects[i].description).length;

    console.log(`\n💾 Saving fixed projects.json...`);
    const formattedJson = JSON.stringify(fixedProjects, null, 2);
    fs.writeFileSync(PROJECTS_FILE, formattedJson, 'utf8');
    console.log('✅ Saved!\n');

    console.log('📊 SUMMARY');
    console.log('==========');
    console.log(`📁 Total projects: ${projects.length}`);
    console.log(`🔧 Projects fixed: ${projectsWithFixes}`);
    console.log(`📝 Total fixes applied: ${totalFixed}`);
    console.log(`💾 Backup saved to: ${backupFile}`);
    console.log('\n✨ All done! Links have been cleaned up.');
}

main();