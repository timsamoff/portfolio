// Utilities/add-selected-work-to-json.js
// Add 'selected: false' to all projects in projects.json

const fs = require('fs');
const path = require('path');
const config = require('./config.js');

// Use config
const projectsPath = config.findProjectsFile() || config.projectsFile;
const backupsDir = config.backupsDir;

// Ensure backups directory exists
config.ensureDir(backupsDir);
console.log(`📁 Backups directory: ${backupsDir}`);

try {
    // Check if projects.json exists
    if (!fs.existsSync(projectsPath)) {
        console.error('❌ projects.json not found!');
        console.error(`   Looked in: ${projectsPath}`);
        process.exit(1);
    }

    // Read the projects file
    const data = fs.readFileSync(projectsPath, 'utf8');
    const projects = JSON.parse(data);
    
    // Create backup with timestamp
    const timestamp = config.getTimestamp();
    const backupPath = path.join(backupsDir, `projects-${timestamp}.json`);
    fs.writeFileSync(backupPath, data, 'utf8');
    console.log(`💾 Backup created: ${backupPath}`);
    
    // Add 'selected: false' to each project that doesn't have it
    let modifiedCount = 0;
    const updatedProjects = projects.map(project => {
        if (project.selected === undefined) {
            modifiedCount++;
            return { ...project, selected: false };
        }
        return project;
    });
    
    // Write back to file
    fs.writeFileSync(projectsPath, JSON.stringify(updatedProjects, null, 2), 'utf8');
    
    console.log(`✅ Migration complete! Added 'selected: false' to ${modifiedCount} project(s).`);
    console.log(`📊 Total projects: ${updatedProjects.length}`);
    console.log(`📁 Backup saved to: ${backupPath}`);
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}