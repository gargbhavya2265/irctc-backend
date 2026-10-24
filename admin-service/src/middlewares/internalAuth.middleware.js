/*
    “It authenticates requests coming from trusted internal services by verifying the required internal credentials.”

     Simple: Protects communication between backend services.
*/

const { config } = require('../config');
const { ForbiddenError } = require('../utils/error');

const internalAuth = (req, res, next) => {
     const serviceKey = req.headers['x-internal-service-key'];

     if (!serviceKey || serviceKey !== config.INTERNAL_SERVICE_KEY) {
          throw new ForbiddenError('Invalid or missing internal service key');
     }

     next();
};

module.exports = { internalAuth };
