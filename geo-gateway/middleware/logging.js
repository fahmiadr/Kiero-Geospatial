import morgan from 'morgan';
import logger from '../config/logger.js';

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

      // Pass a structured object to Winston.
      // 'message' will be used by the console.
      // 'requestData' will be used by the file logger.
      logger.log({
        level: level,
        message: `${data.method} ${data.url} ${data['status-code']} - ${data['response-time']} ms`,
        requestData: data,
      });
    },
  },
});

export default loggingMiddleware;