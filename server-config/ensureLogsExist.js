const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
const logFiles = [
    'combined.log',
    'error-powershell.log',
    'error-node.log',
    'server.log',
    'launcher.log',
    'shutdown.log'
];

function ensureLogsExist() {
    // Create logs folder if missing
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        console.log(`Created logs directory at ${logDir}`);
    }

    // Create each log file if missing
    logFiles.forEach(file => {
        const filePath = path.join(logDir, file);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '');
            console.log(`Created log file: ${filePath}`);
        }
    });
}

module.exports = ensureLogsExist;
