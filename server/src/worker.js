import connectDB from './config/db.js';
import env from './config/env.js';
import logger from './utils/logger.js';
import createIndexingWorker from './workers/indexing.worker.js';

const startWorker = async () => {
  logger.info('🚀 Starting SnapFind Worker Process...');

  // Connect to MongoDB
  await connectDB();

  // Create BullMQ Worker
  const indexingWorker = createIndexingWorker();

  indexingWorker.on('error', (err) => {
    // Graceful logging for Redis offline connection warnings
  });

  logger.success(`✅ SnapFind Background Worker active with concurrency = ${env.INDEXING_CONCURRENCY || 3}`);

  const shutdown = async () => {
    logger.info('Shutting down worker process gracefully...');
    await indexingWorker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startWorker();
