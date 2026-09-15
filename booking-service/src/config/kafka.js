const { Kafka, logLevel } = require('kafkajs');
const logger = require('./logger');
const { config } = require('.');

const kafka = new Kafka({
     clientId: config.KAFKA_CLIENT_ID,

     brokers: [config.KAFKA_BROKER],

     // Aiven Kafka uses TLS + SASL authentication
     ssl: {
          ca: [config.KAFKA_CA_CERT],
     },

     sasl: {
          mechanism: 'scram-sha-256',
          username: config.KAFKA_USERNAME,
          password: config.KAFKA_PASSWORD,
     },

     logLevel: logLevel.ERROR,

     retry: {
          initialRetryTime: 300,
          retries: 8,
          maxRetryTime: 30000,
     },
});

// Producer (for publishing BOOKING_CONFIRMED / BOOKING_CANCELLED / BOOKING_FAILED)
const producer = kafka.producer({
     allowAutoTopicCreation: true,
     transactionTimeout: 30000,
     idempotent: true,
     maxInFlightRequests: 5,
     retry: {
          retries: 5,
     },
});

let isProducerConnected = false;

const connectProducer = async () => {
     if (!isProducerConnected) {
          await producer.connect();
          isProducerConnected = true;
          logger.info('Kafka producer connected');
     }
};

const disconnectProducer = async () => {
     if (isProducerConnected) {
          await producer.disconnect();
          isProducerConnected = false;
          logger.info('Kafka producer disconnected');
     }
};

// Consumer (for PAYMENT_SUCCESS, PAYMENT_FAILED)
const consumer = kafka.consumer({
     groupId: 'booking-service-group',
     sessionTimeout: 30000,
     heartbeatInterval: 3000,
});

const disconnectConsumer = async () => {
     await consumer.disconnect();
     logger.info('Kafka consumer disconnected');
};

const disconnectAll = async () => {
     await disconnectProducer();
     await disconnectConsumer();
};

module.exports = {
     kafka,
     producer,
     consumer,
     connectProducer,
     disconnectProducer,
     disconnectConsumer,
     disconnectAll,
};