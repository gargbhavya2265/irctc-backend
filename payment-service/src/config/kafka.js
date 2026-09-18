const { Kafka, logLevel } = require('kafkajs');
const logger = require('./logger');
const { config } = require('.');

const isLocalKafka = config.KAFKA_BROKER === 'kafka:9092';

const kafkaOptions = {
     clientId: config.KAFKA_CLIENT_ID,
     brokers: [config.KAFKA_BROKER],
     logLevel: logLevel.ERROR,
     retry: {
          initialRetryTime: 300,
          retries: 8,
          maxRetryTime: 30000,
     },
};

if (!isLocalKafka) {
     kafkaOptions.ssl = {
          rejectUnauthorized: false,
     };
     kafkaOptions.sasl = {
          mechanism: 'scram-sha-512',
          username: config.KAFKA_USERNAME,
          password: config.KAFKA_PASSWORD,
     };
}

const kafka = new Kafka(kafkaOptions);
// Producer only (payment-service publishes PAYMENT_SUCCESS / PAYMENT_FAILED)
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

module.exports = { kafka, producer, connectProducer, disconnectProducer };
