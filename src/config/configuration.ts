export default () => ({
    port: parseInt(process.env.PORT, 10) || 5007,
    environment: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || '',
    logLevel: process.env.LOG_LEVEL,
    kafkaBroker: process.env.KAFKA_BROKER,
    kafkaBrokers: process.env.KAFKA_BROKERS,
    kafkaClientId: process.env.KAFKA_CLIENT_ID,
    kafkaGroupId: process.env.KAFKA_GROUP_ID
});
