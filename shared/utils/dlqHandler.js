
const { DLQ_MAX_RETRIES } = require('../constants/kafka-topics');

function withDLQ(producer, dlqTopic, logger, handler) {
     const retryMap = new Map();

     return async ({ topic, partition, message }) => {
          const msgKey = `${topic}:${partition}:${message.offset}`;
          const attempt = (retryMap.get(msgKey) || 0) + 1;

          retryMap.set(msgKey, attempt);

          let parsedValue;

          try {
               parsedValue = JSON.parse(message.value.toString());
          } catch (parseErr) {
               logger.error(`Unparseable message on ${topic}`, {
                    partition,
                    offset: message.offset,
                    error: parseErr.message,
               });

               await sendToDLQ(
                    producer,
                    dlqTopic,
                    topic,
                    partition,
                    message,
                    parseErr,
                    logger
               );

               retryMap.delete(msgKey);
               return;
          }

          try {
               await handler({
                    topic,
                    partition,
                    message,
                    parsedValue,
               });

               retryMap.delete(msgKey);

          } catch (error) {
               logger.error(
                    `Error processing ${topic} (attempt ${attempt}/${DLQ_MAX_RETRIES})`,
                    {
                         error: error.message,
                         partition,
                         offset: message.offset,
                    }
               );

               if (attempt >= DLQ_MAX_RETRIES) {
                    logger.error(`Max retries exceeded for ${topic}`, {
                         partition,
                         offset: message.offset,
                    });

                    await sendToDLQ(
                         producer,
                         dlqTopic,
                         topic,
                         partition,
                         message,
                         error,
                         logger
                    );

                    retryMap.delete(msgKey);
                    return;
               }

               throw error;
          }
     };
}

async function sendToDLQ(
     producer,
     dlqTopic,
     originalTopic,
     partition,
     message,
     error,
     logger
) {
     try {
          await producer.send({
               topic: dlqTopic,
               messages: [{
                    key: message.key,
                    value: message.value,
                    headers: {
                         ...(message.headers || {}),
                         'dlq-original-topic': originalTopic,
                         'dlq-original-partition': String(partition),
                         'dlq-original-offset': message.offset,
                         'dlq-error': error.message || String(error),
                         'dlq-timestamp': new Date().toISOString(),
                    },
               }],
          });

          logger.info(`Message sent to DLQ: ${dlqTopic}`, {
               originalTopic,
               partition,
               offset: message.offset,
          });

     } catch (dlqError) {
          logger.error(`Failed to send message to DLQ ${dlqTopic}`, {
               error: dlqError.message,
               originalTopic,
               partition,
               offset: message.offset,
          });

          // Important: Do not acknowledge the original message
          // when DLQ publishing fails.
          throw dlqError;
     }
}

module.exports = { withDLQ };
