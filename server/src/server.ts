import app from './app.js';
import config from './config/index.js';

const server = app.listen(config.port, config.host, () => {
  console.log(
    `SpaceshipX26 backend running in ${config.env} mode at http://${config.host}:${config.port}`,
  );
});

// Graceful shutdown.
const shutdown = (signal: string): void => {
  console.log(`\n${signal} received. Closing server...`);
  server.close(() => {
    console.log('Server closed. Bye.');
    process.exit(0);
  });

  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

export default server;
