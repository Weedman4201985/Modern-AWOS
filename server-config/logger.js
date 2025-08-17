const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        // Powershell and Node combined errors
        new winston.transports.File({ filename: path.join(__dirname, '../logs/combined.log'), level: 'error' }),

        // Powershell
        new winston.transports.File({ filename: path.join(__dirname, '../logs/error-powershell.log'), level: 'error' }),

        // Node-specific errors
        new winston.transports.File({ filename: path.join(__dirname, '../logs/error-node.log'), level: 'error' }),

        // Server lifecycle
        new winston.transports.File({ filename: path.join(__dirname, '../logs/server.log') }),

        // Launcher events
        new winston.transports.File({ filename: path.join(__dirname, '../logs/launcher.log') }),

        // Shutdown events
        new winston.transports.File({ filename: path.join(__dirname, '../logs/shutdown.log') }),

        // Console output (optional)
        //new winston.transports.Console()
    ]
});
module.exports = logger;
