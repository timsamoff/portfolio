// Utilities/add-selected-work-to-json.js
// Add 'selected: false' to all projects in projects.json

const fs = require('fs');
const path = require('path');
const config = require('./config.js');

const projectsPath = config.findProjectsFile() || config.projectsFile;
const backupsDir = config.backupsDir;

config.ensureDir(backupsDir);
console.log(`📁 Backups directory: ${backupsDir}`);

try {
    if (!fs.existsSync(projectsPath)) {
        console.error('❌ projects.json not found!');
        console.error(`   Looked in: ${projectsPath}`);
        process.exit(1);
    }

    const data = fs.readFileSync(projectsPath, 'utf8');
    const projects = JSON.parse(data);

    const timestamp = config.getTimestamp();
    const backupPath = path.join(backupsDir, `projects-${timestamp}.json`);
    fs.writeFileSync(backupPath, data, 'utf8');
    console.log(`💾 Backup created: ${backupPath}`);

    let modifiedCount = 0;
    const updatedProjects = projects.map(project => {
        if (project.selected === undefined) {
            modifiedCount++;
            return { ...project, selected: false };
        }
        return project;
    });

    fs.writeFileSync(projectsPath, JSON.stringify(updatedProjects, null, 2), 'utf8');
    
    console.log(`✅ Migration complete! Added 'selected: false' to ${modifiedCount} project(s).`);
    console.log(`📊 Total projects: ${updatedProjects.length}`);
    console.log(`📁 Backup saved to: ${backupPath}`);
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}