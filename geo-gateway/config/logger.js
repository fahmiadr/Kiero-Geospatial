import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

const { combine, timestamp, json, colorize, printf, align } = winston.format;

const logDir = 'logs';

const consoleFormat = combine(
  colorize(),
  timestamp(),
  align(),
  printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
);

const fileFormat = combine(
  timestamp(),
  printf((info) => {
    const { requestData } = info;
    const orderedLog = {
      timestamp: info.timestamp,
      level: info.level,
      'status-code': requestData['status-code'],
      method: requestData.method,
      url: requestData.url,
      'response-time': `${requestData['response-time']} ms`,
      message: requestData.message,
      from: requestData.from,
    };
    return JSON.stringify(orderedLog);
  })
);

const createFileTransport = (level) => {
  const transport = new winston.transports.DailyRotateFile({
    level: level,
    format: combine(
      winston.format((info) => (info.level === level ? info : false))(),
      fileFormat
    ),
    filename: path.join(logDir, `geo_gateway_%DATE%_logs`, `geo_gateway_%DATE%-${level}.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxFiles: '45d',
  });
  return transport;
};

const logger = winston.createLogger({
  // Set the lowest level to capture all messages.
  level: process.env.LOG_LEVEL || 'debug',
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    createFileTransport('error'),
    createFileTransport('warn'),
    createFileTransport('info'),
    createFileTransport('debug'),
  ],
  // Do not exit the process on an unhandled exception.
  exitOnError: false,
});

export default logger;