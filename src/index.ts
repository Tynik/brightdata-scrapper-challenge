import schedule from 'node-schedule';

import { SCHEDULE } from './config';
import { log, logConfiguration, withRetries } from './helpers';
import { runYahooFinanceScrapper } from './yahoo-finance';

logConfiguration();

if (SCHEDULE) {
  log('info', `Initializing scheduled scrapers with cron: ${SCHEDULE}`);

  schedule.scheduleJob(SCHEDULE, async () => {
    log('info', 'Scheduled job started: Running scrapers');

    try {
      log('info', 'Executing Yahoo Finance Scraper with retries');

      await withRetries(() => runYahooFinanceScrapper(), 3);
      log('info', 'Yahoo Finance Scraper completed successfully');
    } catch (e) {
      log('error', 'Error occurred while running Yahoo Finance Scraper after retries', e as Error);
    }
  });

  const gracefulShutdown = async () => {
    log('info', 'Graceful shutdown initiated. Cancelling scheduled jobs...');
    await schedule.gracefulShutdown();

    log('info', 'Shutdown complete. Exiting process.');
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown); // Handle Ctrl+C
  process.on('SIGTERM', gracefulShutdown); // Handle Docker or system termination signals
} else {
  log('info', 'No schedule provided. Running Yahoo Finance Scraper immediately.');

  withRetries(() => runYahooFinanceScrapper(), 3).catch(e =>
    log('error', 'Error occurred while running Yahoo Finance Scraper after retries', e as Error),
  );
}
