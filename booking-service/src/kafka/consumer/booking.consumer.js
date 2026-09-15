const { consumer } = require('../../config/kafka');
const { producer, connectProducer } = require('../../config/kafka');
const logger = require('../../config/logger');
const { KAFKA_TOPICS } = require('../../../shared/constants/kafka-topics');
const { withDLQ } = require('../../../shared/utils/dlqHandler');
const bookingService = require('../../services/booking.service');

const start = async () => {
  await consumer.connect();
  await connectProducer();

  logger.info('Booking consumer connected');

  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.PAYMENT_EVENTS,
      KAFKA_TOPICS.ADMIN_EVENTS,
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: withDLQ(
      producer,
      KAFKA_TOPICS.DLQ_EVENTS,
      logger,
      async ({ topic, partition, message, parsedValue }) => {
        logger.info(`Received message on topic: ${topic}`, {
          partition,
          offset: message.offset,
          key: message.key?.toString(),
        });

        switch (parsedValue.eventType) {
          case 'PAYMENT_SUCCESS':
            await bookingService.handlePaymentSuccess(
              parsedValue.data.paymentOrderId,
              parsedValue.data.gatewayPaymentId,
              parsedValue.data.amount
            );
            break;

          case 'PAYMENT_FAILED':
            await bookingService.handlePaymentFailure(
              parsedValue.data.paymentOrderId,
              parsedValue.data.reason
            );
            break;

          case 'SCHEDULE_CANCELLED': {
            const scheduleId =
              parsedValue.data?.scheduleId ||
              parsedValue.data?.id;

            await bookingService.handleScheduleCancelled(scheduleId);
            break;
          }

          default:
            logger.warn(`Unknown event type: ${parsedValue.eventType}`, {
              topic,
            });
        }
      }
    ),
  });

  logger.info('Booking consumer running');
};

module.exports = { start };