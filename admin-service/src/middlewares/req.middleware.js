/*
    “It performs common processing on incoming requests before they reach the controller or route handler.”

     Simple: Does common request-level processing.
*/

const logger = require('../config/logger');

const reqLogger = (req, res, next) => {
     logger.debug(`[${req.method}] ${req.originalUrl}`);
     const start = Date.now();

     res.on('finish', () => {
          const duration = Date.now() - start;
          logger.info(
               `[${req.method}] ${req.originalUrl} - status: ${res.statusCode} - ${duration}ms`
          );
     });

     next();
};

module.exports = {
     reqLogger,
};
