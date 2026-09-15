const { consumer, producer, connectProducer } = require('../../config/kafka');

const searchService = require('../../services/search.service');

const logger = require('../../config/logger');

const { KAFKA_TOPICS } = require('../../../shared/constants/kafka-topics');

const { withDLQ } = require('../../../shared/utils/dlqHandler');

class SearchConsumer {
  async start() {
    await consumer.connect();

    await connectProducer(); // needed for DLQ publishing

    logger.info('Search consumer connected');

    await consumer.subscribe({
      topics: [
        KAFKA_TOPICS.ADMIN_EVENTS,
        KAFKA_TOPICS.INVENTORY_EVENTS,
      ],
      fromBeginning: true,
    });

    await consumer.run({
      eachMessage: withDLQ(
        producer,
        KAFKA_TOPICS.DLQ_EVENTS,
        logger,
        async ({ topic, partition, message, parsedValue }) => {
          logger.info(`Processing ${topic}`, {
            partition,
            offset: message.offset,
            eventType: parsedValue.eventType,
          });

          switch (parsedValue.eventType) {
            case 'STATION_CREATED':
              await searchService.indexStation(parsedValue.data);
              break;

            case 'ROUTE_CREATED':
              await searchService.indexTrainRoute(parsedValue.data);
              break;

            case 'SCHEDULE_CREATED':
              await searchService.indexSchedule(parsedValue.data);
              break;

            case 'SCHEDULE_CANCELLED':
              await searchService.cancelSchedule(parsedValue.data);
              break;

            case 'SEAT_AVAILABILITY_UPDATED':
              await searchService.updateSeatAvailability(parsedValue.data);
              break;

            default:
              logger.info(
                `Ignoring event: ${parsedValue.eventType}`
              );
          }
        }
      ),
    });

    logger.info('Search consumer running...');
  }
}

module.exports = new SearchConsumer();