/*
    “It configures the application logger, which is used to record important information such as requests, errors, events, and application status.”

     In simple words: Used for logging and debugging the application.
*/

const winston = require('winston');
const {config} = require('.');

const logger = winston.createLogger({
     level: config.LOG_LEVEL,
     defaultMeta: {service: config.SERVICE_NAME},
     format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({level, message, timestamp, service}) =>{
               return `[${timestamp}] [${level}] [${service}]: ${message}`
          })
     ),
     transports: [new winston.transports.Console()]
})

module.exports = logger;