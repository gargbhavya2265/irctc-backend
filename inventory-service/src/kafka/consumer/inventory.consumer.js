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