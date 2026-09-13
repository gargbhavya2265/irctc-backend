const { Kafka, logLevel } = require('kafkajs');
const logger = require('./logger');
const { config } = require('.');

const kafkaBroker = config.KAFKA_BROKER
     ? config.KAFKA_BROKER.split(',').map((broker) => broker.trim()).filter(Boolean)
     : [];

const kafka = kafkaBroker.length
     ? new Kafka({
          clientId: config.KAFKA_CLIENT_ID,
          brokers: kafkaBroker,
          logLevel: logLevel.ERROR,
          ssl: {
               rejectUnauthorized: false,
          },
          sasl: {
               mechanism: 'scram-sha-512',
               username: config.KAFKA_USERNAME,
               password: config.KAFKA_PASSWORD,
          },
          retry: {
               initialRetryTime: 300,
               retries: 8,
               maxRetryTime: 30000,
          },
     })
     : null;

const producer = kafka
     ? kafka.producer({
          allowAutoTopicCreation: true,
          transactionTimeout: 30000,
          idempotent: true,
          maxInFlightRequests: 5,
          retry: {
               retries: 5,
          },
     })
     : null;

let isConnected = false;

const connectProducer = async () => {
     if (!producer) {
          logger.warn('Kafka broker not configured, skipping Kafka connection');
          return false;
     }

     if (!isConnected) {
          try {
               await Promise.race([
                    producer.connect(),
                    new Promise((_, reject) =>
                         setTimeout(() => reject(new Error('Kafka connection timeout')), 10000)
                    ),
               ]);

               isConnected = true;
               logger.info('Kafka producer connected');
          } catch (error) {
               logger.error('Kafka producer connection failed', {
                    error: error.message,
               });
               return false;
          }
     }

     return true;
};

const disconnectProducer = async () => {
     if (producer && isConnected) {
          await producer.disconnect();
          isConnected = false;
          logger.info('Kafka producer disconnected');
     }
};

module.exports = {
     kafka,
     producer,
     connectProducer,
     disconnectProducer,
};