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
          return;
     }

     if (!isConnected) {
          await producer.connect();
          isConnected = true;
          logger.info('Kafka producer connected');
     }
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