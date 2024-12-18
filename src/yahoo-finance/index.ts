import * as fs from 'node:fs/promises';

import type { ScrapperConfig } from '../types';
import type { YahooFinanceScrappingResult } from './yahoo-finance.types';
import {
  YAHOO_FINANCE_WEB_SITE_URL,
  YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR,
} from './yahoo-finance.constants';
import { connectBrowser } from '../helpers';
import {
  acceptYahooFinanceConsentForm,
  analyzeYahooFinanceStoriesWithOpenAI,
  parseYahooFinanceLastStories,
  sendToTelegram,
} from './yahoo-finance.helpers';

export const runYahooFinanceScrapper = async (scrapperConfig: ScrapperConfig = {}) => {
  const { browser, page } = await connectBrowser(YAHOO_FINANCE_WEB_SITE_URL);

  try {
    await acceptYahooFinanceConsentForm(page);

    console.log('Waiting for news stream module');
    await page.waitForSelector(YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR);

    console.log('Scrolling to the news stream module');
    await page.evaluate(() => {
      const element = document.querySelector(YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR);

      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    console.log('Waiting for news stream appearance');
    await page.waitForSelector(
      `${YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR} [data-testid="news-stream"] .stream-items`,
      {
        visible: true,
      },
    );

    const lastStories = await parseYahooFinanceLastStories(page, 10);

    const currentTimestamp = Date.now();
    const scrappingResult: YahooFinanceScrappingResult = {
      timestamp: currentTimestamp,
      lastStories,
    };

    const scrappingResultFileName = `yahoo-finance-scrapping-result-${currentTimestamp}.json`;
    const scrappingResultJSONString = JSON.stringify(scrappingResult, null, 2);

    await fs.writeFile(scrappingResultFileName, scrappingResultJSONString, 'utf8');
    console.log(`Yahoo Finance scrapping result is saved to "${scrappingResultFileName}"`);

    const analyzedAIScrappingResult = await analyzeYahooFinanceStoriesWithOpenAI(scrappingResult);
    if (analyzedAIScrappingResult) {
      console.log('OpenAI Analysis Result:\n', analyzedAIScrappingResult);

      await sendToTelegram(analyzedAIScrappingResult);
    }
  } finally {
    await browser.close();
  }
};
