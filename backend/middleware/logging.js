import morgan from 'morgan';
import logger from '../config/logger.js';

/**
 * Mengekstrak pesan deskriptif dari respons HTTP.
 * Untuk respons error (status >= 400), fungsi ini memprioritaskan pesan error kustom,
 * kemudian mencari properti 'error' di body JSON, dan jika tidak ada, menggunakan pesan generik.
 * Untuk respons sukses, fungsi ini mencari properti 'message' di `res.locals` atau body JSON.
 * Hal ini memastikan bahwa log yang dihasilkan bermakna dan kaya akan konteks.
 *
 * @param {import('express').Request} req - Objek request Express.
 * @param {import('express').Response} res - Objek response Express, yang mungkin memiliki properti `body`.
 * @returns {string} Pesan log yang diekstrak.
 */
const getMessage = (req, res) => {
  let message = '';
  let body;
  try {
    body = JSON.parse(res.body);
  } catch (e) {
    body = {};
  }

  if (res.statusCode >= 400) {
    if (res.locals.errorMessage) {
      message = res.locals.errorMessage;
    } else if (body && body.error) {
      message = typeof body.error === 'object' ? JSON.stringify(body.error) : body.error;
    } else {
      message = "An unexpected error occurred.";
    }
  } else {
    if (res.locals.message) {
      message = res.locals.message;
    } else if (body && body.message) {
      message = body.message;
    }
  }
  return message;
};

/**
 * Fungsi format kustom untuk Morgan yang mengkompilasi data log menjadi string JSON terstruktur.
 * Fungsi ini menggunakan helper `getMessage` untuk mengekstrak pesan yang bermakna dan menggabungkannya dengan
 * data request/response standar (method, URL, status, response time) dan info klien
 * (IP, origin, user agent) ke dalam satu objek JSON untuk logging yang konsisten dan dapat di-parse.
 *
 * @param {object} tokens - Objek fungsi token yang disediakan oleh Morgan.
 * @param {import('express').Request} req - Objek request Express.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {string} String JSON yang merepresentasikan entri log terstruktur.
 */
const morganFormat = (tokens, req, res) => {
  const message = getMessage(req, res);
  return JSON.stringify({
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    'status-code': tokens.status(req, res),
    'response-time': tokens['response-time'](req, res, 0),
    from: {
      origin: tokens.req(req, res, 'origin'),
      ip: req.ip || req.connection.remoteAddress,
      agent: tokens['user-agent'](req, res),
    },
    message: message
  });
};

/**
 * @constant {function} loggingMiddleware
 * Middleware logging utama untuk aplikasi, didukung oleh Morgan dan Winston.
 * Middleware ini menggunakan `morganFormat` kustom untuk menghasilkan string log JSON terstruktur.
 * String ini kemudian diteruskan ke fungsi `write` dari stream kustom, yang akan mem-parse-nya,
 * menentukan level log yang sesuai berdasarkan status code (error untuk >=500,
 * warn untuk >=400, info sebaliknya), dan menulis objek log terstruktur akhir
 * ke logger Winston. Pengaturan ini memungkinkan logging yang fleksibel dan kuat ke
 * berbagai transport (konsol, file, dll.).
 */
const loggingMiddleware = morgan(morganFormat, {
  stream: {
    write: (message) => {
      const data = JSON.parse(message);
      const statusCode = parseInt(data['status-code'], 10);
      let level;
      if (statusCode >= 500) {
        level = 'error';
      } else if (statusCode >= 400) {
        level = 'warn';
      } else {
        level = 'info';
      }

      logger.log({
        level: level,
        message: `${data.method} ${data.url} ${data['status-code']} - ${data['response-time']} ms`,
        requestData: data,
      });
    },
  },
});

export default loggingMiddleware;