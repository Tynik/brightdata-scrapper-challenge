import * as fs from 'node:fs/promises';

import type { ScrapperConfig } from '../types';
import type { YahooFinanceScrappingResult } from './yahoo-finance.types';
import { YAHOO_FINANCE_WEB_SITE_URL } from './yahoo-finance.constants';
import { OPENAI_ENABLED, YAHOO_FINANCE_NEWS_PAGES_LIMIT } from '../config';
import { cleanupContent, connectBrowser, log } from '../helpers';
import {
  acceptYahooFinanceConsentForm,
  analyzeYahooFinanceStoriesWithOpenAI,
  parseYahooFinanceLastStories,
  parseYahooFinanceWorldIndices,
  sendToTelegram,
} from './yahoo-finance.helpers';

export const runYahooFinanceScrapper = async (scrapperConfig: ScrapperConfig = {}) => {
  const { browser, page } = await connectBrowser(YAHOO_FINANCE_WEB_SITE_URL);

  try {
    await acceptYahooFinanceConsentForm(page);

    log('info', 'Waiting for news stream module');
    await page.waitForSelector('[data-testid="module-news-stream"]');

    log('info', 'Scrolling to the news stream module');
    await page.evaluate(() => {
      const element = document.querySelector('[data-testid="module-news-stream"]');

      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    log('info', 'Waiting for news stream appearance');
    await page.waitForSelector(
      `[data-testid="module-news-stream"] [data-testid="news-stream"] .stream-items li`,
      {
        visible: true,
      },
    );

    const lastStories = await parseYahooFinanceLastStories(page, YAHOO_FINANCE_NEWS_PAGES_LIMIT);

    for (const story of lastStories) {
      if (!story.link) {
        log('warn', 'Story has no link, skipping...');
        continue;
      }

      const storyPage = await browser.newPage();

      try {
        log('info', `Navigating to: ${story.link}`);

        await storyPage.goto(story.link, { waitUntil: 'domcontentloaded' });
        await storyPage.waitForSelector('section.main article');

        story.content =
          cleanupContent(
            await storyPage.evaluate(
              () => document.querySelector('section.main article .body-wrap')?.textContent,
            ),
          ) ?? null;
      } catch (e) {
        log('error', `Error navigating to ${story.link}:`, e as Error);
      } finally {
        await storyPage.close();
      }
    }

    const worldIndices = await parseYahooFinanceWorldIndices(page);

    const currentTimestamp = Date.now();
    const scrappingResult: YahooFinanceScrappingResult = {
      timestamp: currentTimestamp,
      lastStories,
      worldIndices,
    };

    const scrappingResultFileName = `yahoo-finance-scrapping-result-${currentTimestamp}.json`;
    const scrappingResultJSONString = JSON.stringify(scrappingResult, null, 2);

    await fs.writeFile(scrappingResultFileName, scrappingResultJSONString, 'utf8');
    log('info', `Yahoo Finance scrapping result is saved to "${scrappingResultFileName}"`);

    if (OPENAI_ENABLED) {
      const analyzedAIScrappingResult = await analyzeYahooFinanceStoriesWithOpenAI(scrappingResult);
      if (analyzedAIScrappingResult) {
        log('info', `OpenAI Analysis Result: ${analyzedAIScrappingResult}`);

        await sendToTelegram(analyzedAIScrappingResult);
      }
    }
  } finally {
    await browser.close();
  }
};
