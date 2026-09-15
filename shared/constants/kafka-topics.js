const KAFKA_TOPICS = {
  // Domain event topics
  ADMIN_EVENTS: 'admin.events',
  INVENTORY_EVENTS: 'inventory.events',
  PAYMENT_EVENTS: 'payment.events',
  BOOKING_EVENTS: 'booking.events',

  // One common DLQ topic
  DLQ_EVENTS: 'dlq.events',
};

const DLQ_MAX_RETRIES = 3;

module.exports = {
  KAFKA_TOPICS,
  DLQ_MAX_RETRIES,
};