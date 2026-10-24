/*
    “It configures CORS (Cross-Origin Resource Sharing) to control which origins are allowed to access the backend APIs.”

     In simple words: Controls who can access the API from another origin/domain.
*/

const cors = require('cors');
const { config } = require('../config');

const allowedOrigins = config.ALLOWED_ORIGINS
     ? config.ALLOWED_ORIGINS.split(',').map(o => o.trim())
     : [];

const corsMiddleware = cors({
     origin: function (origin, callback) {

          if (!origin) return callback(null, true);

          if (allowedOrigins.includes(origin)) {
               callback(null, true);
          } else {
               callback(new Error('Not allowed by CORS'));
          }
     },
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization'],
});

module.exports = { corsMiddleware };
