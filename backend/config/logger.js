import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

const { combine, timestamp, json, colorize, printf, align } = winston.format;

const logDir = 'logs';

/**
 * @constant {winston.format} consoleFormat
 * Mendefinisikan format log untuk output konsol.
 * Format ini mencakup pewarnaan, timestamp, perataan (alignment), dan fungsi printf kustom
 * untuk pesan log satu baris yang mudah dibaca.
 */
const consoleFormat = combine(
  colorize(),
  timestamp(),
  align(),
  printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
);

/**
 * @constant {winston.format} fileFormat
 * Mendefinisikan format log untuk output file.
 * Format ini mencakup timestamp dan fungsi printf kustom yang menyusun entri log
 * ke dalam format JSON tertentu dengan kunci yang terurut. Ini digunakan untuk logging terstruktur.
 * `requestData` diharapkan untuk dilewatkan dalam metadata log.
 */
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

/**
 * Membuat transport file yang berotasi harian untuk Winston.
 * Setiap level log ('error', 'warn', 'info', 'debug') mendapatkan transportnya sendiri,
 * memastikan bahwa log hanya ditulis ke file yang sesuai dengan levelnya.
 * @param {string} level - Level log untuk transport yang akan dibuat (misalnya, 'error', 'info').
 * @returns {winston.transport} Sebuah instance transport DailyRotateFile yang telah dikonfigurasi.
 */
const createFileTransport = (level) => {
  const transport = new winston.transports.DailyRotateFile({
    level: level,
    format: combine(
      winston.format((info) => (info.level === level ? info : false))(),
      fileFormat
    ),
    filename: path.join(logDir, `backend_%DATE%_logs`, `backend_%DATE%-${level}.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxFiles: '45d',
  });
  return transport;
};

/**
 * @constant {winston.Logger} logger
 * Instance logger utama untuk aplikasi.
 * Dikonfigurasi dengan transport konsol untuk pengembangan dan
 * empat transport file berotasi harian yang terpisah untuk logging terstruktur yang persisten
 * dari berbagai level (error, warn, info, debug).
 * Level log dapat dikonfigurasi melalui variabel lingkungan `LOG_LEVEL`.
 */
const logger = winston.createLogger({
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
  exitOnError: false,
});

export default logger;