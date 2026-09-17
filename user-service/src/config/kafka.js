/* 
Client → Interface through which application talks to Kafka
Producer → Sends messages
Broker → Kafka server that stores/serves data
Topic → Named category of messages
Partition → Division of a topic
Message → Actual data/event
Offset → Position of a message inside a partition
Consumer → Reads messages
Consumer Group → Consumers working together
Replication → Copies of partitions for safety
Leader/Follower → Primary and replica copies
Retention → How long Kafka keeps messages
Consumer Lag → Messages waiting to be processed
*/
const { Kafka, logLevel } = require('kafkajs');
const logger = require('./logger');
const {config} = require('.');
const kafka = new Kafka({
     clientId: config.KAFKA_CLIENT_ID,//This gives your application a name/identity when communicating with Kafka.
     brokers: [config.KAFKA_BROKER || 'localhost:9093'],//"Where is the Kafka broker running?"

     ssl: true,

     sasl: {
          mechanism: 'scram-sha-256',
          username: config.KAFKA_USERNAME,
          password: config.KAFKA_PASSWORD,
     },

     logLevel: logLevel.ERROR,// This controls how much Kafka-related logging you want
     retry: {  // If Kafka is temporarily unavailable, the client will retry connecting.
          initialRetryTime: 300, // Initially waits around 300ms
          retries: 8, // Can retry up to 8 times
          maxRetryTime: 30000, // Maximum retry delay can go up to 30000ms
     },
});

const producer = kafka.producer({
     allowAutoTopicCreation: true, //If the producer tries to send a message to a topic that doesn't exist, Kafka can automatically create that topic.
     transactionTimeout: 30000, // If a transaction does not complete within this time, Kafka can abort/fail it.
     idempotent: true, // It helps ensure that:The same message is not stored multiple times because of producer retries.
     maxInFlightRequests: 5, // This means the producer can have a maximum of 5 requests/messages batches being processed simultaneously without receiving their responses yet.
     retry: { // If sending a message fails temporarily, the producer will retry.
          retries: 5,
     },
});

let isConnected = false;

const connectProducer = async () => {
     if (!isConnected) {
          await producer.connect();
          isConnected = true;
          logger.info('Kafka producer connected');
     }
};

const disconnectProducer = async () => {
     if (isConnected) {
          await producer.disconnect();
          isConnected = false;
          logger.info('Kafka producer disconnected');
     }
};

module.exports = { kafka, producer, connectProducer, disconnectProducer };