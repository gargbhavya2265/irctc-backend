/*
  If interviewer asks:

  "What does this Inventory Consumer do?"

  You can say:

  "This is a Kafka consumer in my Inventory Service. It subscribes to the Admin Events topic and listens for admin-related events. When it receives a SCHEDULE_CREATED event, it calls the inventory service to initialize inventory for that schedule. When it receives a SCHEDULE_CANCELLED event, it cancels the corresponding inventory. Other admin events are ignored. I also use a DLQ wrapper so that if message processing fails, the failed event can be published to a Dead Letter Queue for later investigation or reprocessing."

  That's a very solid interview answer.
*/

const { consumer, producer, connectProducer } = require('../../config/kafka');

const logger = require('../../config/logger');

const { KAFKA_TOPICS } = require('../../../shared/constants/kafka-topics');

const { withDLQ } = require('../../../shared/utils/dlqHandler');

const inventoryService = require('../../services/inventory.service');

class InventoryConsumer {
  async start() {
    await consumer.connect();

    await connectProducer(); // needed for DLQ publishing

    logger.info('Inventory consumer connected');

    await consumer.subscribe({
      topics: [KAFKA_TOPICS.ADMIN_EVENTS],
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
            case 'SCHEDULE_CREATED':
              await inventoryService.initializeInventory(
                parsedValue.data
              );
              break;

            case 'SCHEDULE_CANCELLED':
              await inventoryService.cancelScheduleInventory(
                parsedValue.data
              );
              break;

            default:
              logger.info(
                `Ignoring admin event: ${parsedValue.eventType}`
              );
          }
        }
      ),
    });

    logger.info('Inventory consumer running...');
  }
}

module.exports = new InventoryConsumer();