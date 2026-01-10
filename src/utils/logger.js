const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Định dạng log tùy chỉnh
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        if (stack) {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`;
        }
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
);

// Cấu hình transport cho file log theo ngày
const dailyRotateFileTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../logs/app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat
});

// Cấu hình transport cho error logs riêng
const errorRotateFileTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../logs/error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat
});

// Tạo logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        dailyRotateFileTransport,
        errorRotateFileTransport,
        // Console output với màu sắc
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `[${timestamp}] ${level}: ${message}`;
                })
            )
        })
    ]
});

module.exports = logger;
