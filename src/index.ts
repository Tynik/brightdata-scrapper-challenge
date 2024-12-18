import schedule from 'node-schedule';

import { runYahooFinanceScrapper } from './yahoo-finance';
import { BROWSER_WS } from './config';

console.log(BROWSER_WS);

schedule.scheduleJob('4 * * * *', async () => {
  console.log('Running Yahoo Finance Scrapper...');

  try {
    await runYahooFinanceScrapper({
      notificationChannels: ['telegram'],
    });
    console.log('Scrapper completed successfully.');
  } catch (e) {
    console.error('Error during scrapper execution:', (e as Error).message);
  }
});

const gracefulShutdown = async () => {
  console.log('Graceful shutdown initiated...');
  await schedule.gracefulShutdown();

  console.log('Scheduled scrapping job canceled');
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown); // Handle Ctrl+C
process.on('SIGTERM', gracefulShutdown); // Handle Docker or system termination signals
