import type { Page } from 'puppeteer';
import axios, { AxiosError } from 'axios';

import type {
  YahooFinanceStory,
  YahooFinanceStoryTaxonomy,
  YahooFinanceScrappingResult,
  YahooFinanceStockIndex,
} from './yahoo-finance.types';
import {
  NOTIFICATION_CHANNELS,
  OPENAI_INSTRUCTION,
  OPENAI_MAX_TOKENS,
  OPENAI_MODEL,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from '../config';
import { gracefulTimeout, log } from '../helpers';
import { openAIClient } from '../clients';
import { YAHOO_FINANCE_WEB_SITE_URL } from './yahoo-finance.constants';

export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export const acceptYahooFinanceConsentForm = async (page: Page) => {
  await gracefulTimeout(async () => {
    log('info', 'Waiting for consent form');
    await page.waitForSelector('#consent-page .consent-form', {
      timeout: 10000,
      visible: true,
    });

    log('info', 'Waiting for accepting the consent form button');
    await page.waitForSelector('#consent-page .consent-form button[name="agree"]', {
      visible: true,
    });

    log('info', 'Accepting the consent form');
    await page.$eval('#consent-page .consent-form button[name="agree"]', element =>
      element.click(),
    );
  }, 'No consent form detected within 10 seconds');
};

const yahooFinanceWaitForLoadingStories = async (page: Page) => {
  await gracefulTimeout(async () => {
    log('info', 'Waiting for loading news');
    await page.waitForSelector(
      '[data-testid="module-news-stream"] [data-testid="news-stream"] .stream-items .tw-flex',
      {
        timeout: 5000,
        visible: true,
      },
    );

    log('info', 'Loading news detected. Waiting until the news will be loaded');
    await page.waitForSelector(
      '[data-testid="module-news-stream"] [data-testid="news-stream"] .stream-items .tw-flex',
      {
        timeout: 5000,
        hidden: true,
      },
    );
  }, 'No loading news detected within 5 seconds');
};

export const parseYahooFinanceLastStories = async (
  page: Page,
  maxPages: number,
): Promise<YahooFinanceStory[]> => {
  let totalParsedStoryPages = 0;

  const allParsedStories: YahooFinanceStory[] = [];

  while (totalParsedStoryPages < maxPages) {
    log('info', `Parsing news onto a page: ${totalParsedStoryPages + 1}`);

    const parsedStreamedStories = await page.$$eval(
      '[data-testid="module-news-stream"] [data-testid="news-stream"] [data-testid="storyitem"]',
      (storyElements, totalParsedStories) =>
        storyElements.slice(totalParsedStories).map(storyElement => {
          const storyTitle = storyElement.querySelector('.subtle-link h3')?.textContent?.trim();
          const storyLink = storyElement.querySelector('.subtle-link')?.getAttribute('href');

          const storyPublishingParts = storyElement
            .querySelector('.footer .publishing')
            ?.textContent?.split('•')
            .map(v => v.trim());

          const storyTaxonomies: YahooFinanceStoryTaxonomy[] = [
            ...storyElement.querySelectorAll('.taxonomy-links [data-testid="ticker-container"]'),
          ].map(tickerElement => {
            const quoteName = tickerElement.getAttribute('aria-label');
            const quoteHref = tickerElement.getAttribute('href');
            const percentChange = tickerElement.querySelector(
              '[data-field="regularMarketChangePercent"]',
            )?.textContent;

            if (!quoteName) {
              throw new Error('Yahoo finance quote name cannot be read');
            }

            return {
              name: quoteName,
              percentChange: percentChange ?? null,
              href: `https://finance.yahoo.com${quoteHref}`,
            };
          });

          const parsedStory: YahooFinanceStory = {
            title: storyTitle ?? null,
            // Will be fetched further
            content: null,
            link: storyLink ?? null,
            published: {
              where: storyPublishingParts?.[0] ?? null,
              when: storyPublishingParts?.[1] ?? storyPublishingParts?.[0] ?? null,
            },
            taxonomies: storyTaxonomies,
          };

          return parsedStory;
        }),
      // Pass the value as `totalParsedStories` argument
      allParsedStories.length,
    );

    if (!parsedStreamedStories.length) {
      log('info', `No news found for page: ${totalParsedStoryPages + 1}`);
      break;
    }

    totalParsedStoryPages += 1;
    allParsedStories.push(...parsedStreamedStories);

    log(
      'info',
      `Total parsed news for page ${totalParsedStoryPages}: ${parsedStreamedStories.length}`,
    );

    // If more pages need to be parsed, scroll to the end for loading more news
    if (totalParsedStoryPages < maxPages) {
      try {
        log('info', 'Scrolling down to load the next portion of news');

        await page.evaluate(async () => {
          const elements = document.querySelectorAll(
            '[data-testid="module-news-stream"] [data-testid="news-stream"] .stream-items li',
          );

          const loadNextNewsPageTrigger = elements[elements.length - 1];
          if (!loadNextNewsPageTrigger.innerHTML) {
            return loadNextNewsPageTrigger?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }

          return Promise.reject('end');
        });

        await yahooFinanceWaitForLoadingStories(page);
      } catch (e) {
        if (e === 'end') {
          log('info', 'The last page for news is detected. Exiting.');
          break;
        }

        throw e;
      }
    }
  }

  log('info', `Total parsed news across all pages: ${allParsedStories.length}`);

  return allParsedStories;
};

export const parseYahooFinanceWorldIndices = async (
  page: Page,
): Promise<YahooFinanceStockIndex[]> => {
  await page.goto(`${YAHOO_FINANCE_WEB_SITE_URL}/markets/world-indices`, {
    waitUntil: 'domcontentloaded',
  });

  log('info', 'Waiting for loading world stock indices');
  await page.waitForSelector('[data-testid="table-container"].markets-table', {
    visible: true,
  });

  const worldIndices = await page.$$eval(
    '[data-testid="table-container"].markets-table tbody tr',
    elements =>
      elements.map(element => {
        const tdElements = element.querySelectorAll('td');

        const name = element
          ?.querySelector('[data-testid="table-cell-ticker"] .symbol')
          ?.textContent?.trim();

        const price = element
          ?.querySelector('[data-field="regularMarketPrice"]')
          ?.getAttribute('data-value');

        const change = element
          ?.querySelector('[data-field="regularMarketChange"]')
          ?.getAttribute('data-value');

        const volume = element
          ?.querySelector('[data-field="regularMarketVolume"]')
          ?.getAttribute('data-value');

        const href = element
          ?.querySelector('[data-testid="table-cell-ticker"]')
          ?.getAttribute('href');

        const stockIndex: YahooFinanceStockIndex = {
          name: name ?? null,
          price: price ? +price : null,
          change: change ? +change : null,
          volume: volume ? +volume : null,
          href: `https://finance.yahoo.com${href}`,
        };

        return stockIndex;
      }),
  );

  return worldIndices;
};

export const analyzeYahooFinanceStoriesWithOpenAI = async (
  scrappingResult: YahooFinanceScrappingResult,
) => {
  assert(OPENAI_INSTRUCTION, 'Please set OPENAI_INSTRUCTION in the configuration');
  assert(OPENAI_MAX_TOKENS, 'Please set OPENAI_MAX_TOKENS in the configuration');

  log('info', 'Analyzing data with OpenAI...');

  const storiesText = scrappingResult.lastStories
    .map(story => {
      const taxonomiesText =
        story.taxonomies
          ?.map(taxonomy => `${taxonomy.name} (${taxonomy.percentChange || 'N/A'})`)
          .join(', ') || '-';

      return `
        Title: ${story.title}
        Content: ${story.content || 'No content available'}
        Published: ${story.published?.where || 'Unknown source'} on ${story.published?.when || 'Unknown date'}
        Link: ${story.link || 'No link available'}
        Taxonomies: ${taxonomiesText}
      `;
    })
    .join('\n\n');

  const worldIndicesText = scrappingResult.worldIndices
    .map(
      stockIndex =>
        `${stockIndex.name || 'UNKNOWN'}: Price ${stockIndex.price || 'N/A'}, Change ${
          stockIndex.change || 'N/A'
        }, Volume ${stockIndex.volume || 'N/A'}`,
    )
    .join('\n');

  try {
    const chatCompletion = await openAIClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: OPENAI_MAX_TOKENS,
      n: 1,
      messages: [
        {
          role: 'system',
          content: OPENAI_INSTRUCTION,
        },
        {
          role: 'user',
          content: `
            Timestamp: ${scrappingResult.timestamp}
            Stories:
            ${storiesText}
            
            World Indices:
            ${worldIndicesText}
          `,
        },
      ],
    });

    return chatCompletion.choices[0].message.content;
  } catch (e) {
    log('error', 'Error during OpenAI analysis:', e as Error);
  }
};

export const sendToTelegram = async (text: string) => {
  if (!NOTIFICATION_CHANNELS.includes('telegram')) {
    return;
  }

  assert(TELEGRAM_BOT_TOKEN, 'Please set TELEGRAM_BOT_TOKEN in the configuration');
  assert(TELEGRAM_CHAT_ID, 'Please set TELEGRAM_CHAT_ID in the configuration');

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      text,
      chat_id: TELEGRAM_CHAT_ID,
    });
  } catch (e) {
    if (e instanceof AxiosError) {
      log('error', 'Error sending message to Telegram:', e.response?.data || e.message);
    } else {
      log('error', '', e as Error);
    }
  }
};
