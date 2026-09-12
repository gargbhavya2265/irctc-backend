const { producer, connectProducer } = require('../../config/kafka');
const logger = require('../../config/logger');
const { KAFKA_TOPICS } = require('../../../shared/constants/kafka-topics');

class AdminProducer {
     constructor() {
          this.isInitialized = false;
     }

     async initialize() {
          if (!producer) {
               return false;
          }

          if (!this.isInitialized) {
               await connectProducer();
               this.isInitialized = true;
          }

          return true;
     }

     async sendMessage(topic, key, value) {
          try {
               const initialized = await this.initialize();

               if (!initialized) {
                    logger.warn(`Kafka unavailable, skipping message for topic: ${topic}`);
                    return null;
               }

               const result = await producer.send({
                    topic,
                    messages: [{
                         key: key || `${topic}-${Date.now()}`,
                         value: JSON.stringify(value),
                         timestamp: Date.now().toString(),
                    }],
               });

               logger.info(`Message sent to topic: ${topic}`, {
                    key,
                    partition: result[0].partition,
                    offset: result[0].offset,
               });

               return result;
          } catch (error) {
               logger.error(`Failed to send message to topic: ${topic}`, {
                    error: error.message,
                    key,
               });

               return null;
          }
     }

     async publishStationCreated(station) {
          return this.sendMessage(
               KAFKA_TOPICS.STATION_CREATED,
               `station-${station.id}`,
               {
                    eventType: 'STATION_CREATED',
                    data: station,
                    timestamp: new Date().toISOString()
               }
          );
     }

     async publishTrainCreated(trainData) {
          return this.sendMessage(
               KAFKA_TOPICS.TRAIN_CREATED,
               `train-${trainData.id}`,
               trainData
          );
     }

     async publishRouteCreated(routeData) {
          return this.sendMessage(
               KAFKA_TOPICS.ROUTE_CREATED,
               `route-${routeData.train.id}`,
               routeData
          );
     }

     async publishScheduleCreated(scheduleData) {
          return this.sendMessage(
               KAFKA_TOPICS.SCHEDULE_CREATED,
               `schedule-${scheduleData.scheduleId}`,
               scheduleData
          );
     }

     async publishScheduleCancelled(schedule) {
          return this.sendMessage(
               KAFKA_TOPICS.SCHEDULE_CANCELLED,
               `schedule-${schedule.id}`,
               {
                    eventType: 'SCHEDULE_CANCELLED',
                    data: schedule,
                    timestamp: new Date().toISOString()
               }
          );
     }
}

module.exports = new AdminProducer();