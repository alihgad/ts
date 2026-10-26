import application from './app';
import database from './config/database';
import environment from './config/env';

class Server {
  async start(): Promise<void> {
    await database.connect();
    const server = application.app.listen(environment.values.PORT, () => {
      console.log(`Server listening on port ${environment.values.PORT}`);
    });
    server.on('error', (error) => {
      console.error('Server failed:', error.message);
      void database.disconnect().finally(() => process.exit(1));
    });
    const shutdown = () => {
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      server.close(() => {
        void database.disconnect().finally(() => process.exit(0));
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}

const server = new Server();
export default server;
void server.start().catch(async (error: unknown) => {
  console.error('Startup failed:', error instanceof Error ? error.message : error);
  await database.disconnect();
  process.exitCode = 1;
});
