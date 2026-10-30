// middlewares/error.middleware.js
const { AppError } = require('../utils/error');
const { config } = require('../config');
const logger = require('../config/logger');
module.exports = (err, req, res, next) => {
     if (err instanceof AppError) {
          const response = {
               success: false,
               error: err.code,
               message: err.message
          };
          if (err.retryAfter !== undefined) {
               response.retryAfter = err.retryAfter;
          }
          return res.status(err.statusCode).json(response);
     }
     console.error('UNHANDLED ERROR:', err);
     if (config.NODE_ENV !== 'production') {
          logger.error({
               message: err.message,
               stack: err.stack,
               path: req.path,
               method: req.method,
               body: req.body,
               query: req.query
          });
     }
     return res.status(500).json({
          success: false,
          error: 'SERVER_ERROR',
          message: 'Internal Server Error'
     });
};
