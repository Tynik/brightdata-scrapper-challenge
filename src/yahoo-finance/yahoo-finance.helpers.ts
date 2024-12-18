import type { Page } from 'puppeteer';
import axios, { AxiosError } from 'axios';

import type {
  YahooFinanceLastStory,
  YahooFinanceLastStoryTaxonomy,
  YahooFinanceScrappingResult,
} from './yahoo-finance.types';
import {
  NOTIFICATION_CHANNELS,
  OPENAI_API_MODEL,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from '../config';
import { YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR } from './yahoo-finance.constants';
import { openAIClient } from '../clients';

export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export const acceptYahooFinanceConsentForm = async (page: Page) => {
  try {
    console.log('Waiting for consent form');
    await page.waitForSelector('#consent-page .consent-form', {
      timeout: 10000,
      visible: true,
    });

    console.log('Waiting for accepting the consent form button');
    await page.waitForSelector('#consent-page .consent-form button[name="agree"]', {
      visible: true,
    });

    console.log('Accepting the consent form');
    await page.$eval('#consent-page .consent-form button[name="agree"]', element =>
      element.click(),
    );
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') {
      console.log('Timeout reached: No consent form detected within 10 seconds');
    } else {
      throw e;
    }
  }
};

const yahooFinanceWaitForLoadingStories = async (page: Page) => {
  try {
    console.log('Waiting for loading news');
    await page.waitForSelector(
      `${YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR} [data-testid="news-stream"] .stream-items .tw-flex`,
      {
        timeout: 5000,
        visible: true,
      },
    );

    console.log('Loading news detected. Waiting until the news will be loaded');
    await page.waitForSelector(
      `${YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR} [data-testid="news-stream"] .stream-items .tw-flex`,
      {
        timeout: 5000,
        hidden: true,
      },
    );
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') {
      console.log('Timeout reached: No loading news detected within 5 seconds');
    } else {
      throw e;
    }
  }
};

export const parseYahooFinanceLastStories = async (
  page: Page,
  maxPages = 1,
): Promise<YahooFinanceLastStory[]> => {
  let totalParsedStoryPages = 0;

  const allParsedStories: YahooFinanceLastStory[] = [];

  while (totalParsedStoryPages < maxPages) {
    console.log(`Parsing news onto a page: ${totalParsedStoryPages + 1}`);

    await yahooFinanceWaitForLoadingStories(page);

    const parsedStreamedStories = await page.$$eval(
      `${YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR} [data-testid="news-stream"] [data-testid="storyitem"]`,
      (storyElements, totalParsedStories) =>
        storyElements.slice(totalParsedStories).map(storyElement => {
          const storyTitle = storyElement.querySelector('.subtle-link h3')?.textContent?.trim();
          const storyContent = storyElement.querySelector('.subtle-link p')?.textContent?.trim();
          const storyLink = storyElement.querySelector('.subtle-link')?.getAttribute('href');

          const storyPublishingParts = storyElement
            .querySelector('.footer .publishing')
            ?.textContent?.split('•')
            .map(v => v.trim());

          const storyTaxonomies: YahooFinanceLastStoryTaxonomy[] = [
            ...storyElement.querySelectorAll('.taxonomy-links [data-testid="ticker-container"]'),
          ].map(element => {
            const quoteName = element.getAttribute('aria-label');
            const percentChange = element.querySelector(
              '[data-field="regularMarketChangePercent"]',
            )?.textContent;

            if (!quoteName) {
              throw new Error('Yahoo finance quote name cannot be read');
            }

            return {
              name: quoteName,
              percentChange: percentChange ?? null,
              link: `https://finance.yahoo.com/quote/${quoteName}`,
            };
          });

          const parsedStory: YahooFinanceLastStory = {
            title: storyTitle ?? null,
            content: storyContent ?? null,
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
      console.log(`No news found for page: ${totalParsedStoryPages + 1}`);
      break;
    }

    totalParsedStoryPages += 1;
    allParsedStories.push(...parsedStreamedStories);

    console.log(
      `Total parsed news for page ${totalParsedStoryPages}: ${parsedStreamedStories.length}`,
    );

    // If more pages need to be parsed, scroll to load more
    if (totalParsedStoryPages < maxPages) {
      try {
        console.log('Scrolling down to load the next portion of news');

        await page.evaluate(async () => {
          const elements = document.querySelectorAll(
            `${YAHOO_FINANCE_NEWS_STREAM_MODULE_SELECTOR} [data-testid="news-stream"] .stream-items li`,
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
          console.log('The last page for news is detected. Exiting.');
          break;
        }

        throw e;
      }
    }
  }

  console.log(`Total parsed news across all pages: ${allParsedStories.length}`);

  return allParsedStories;
};

export const analyzeYahooFinanceStoriesWithOpenAI = async (
  scrappingResult: YahooFinanceScrappingResult,
) => {
  console.log('Analyzing data with OpenAI...');

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

  try {
    const chatCompletion = await openAIClient.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a financial analyst AI. Analyze the following financial news data, summarize trends, and highlight key positive or negative sentiments about the stock market.',
        },
        {
          role: 'user',
          content: `
            Timestamp: ${scrappingResult.timestamp}
            Stories: ${storiesText}
          `,
        },
      ],
      max_tokens: 1000,
    });

    return chatCompletion.choices[0].message.content;
  } catch (e) {
    console.error('Error during OpenAI analysis:', (e as Error).message);
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

    console.log('Message sent to Telegram!');
  } catch (e) {
    if (e instanceof AxiosError) {
      console.error('Error sending message to Telegram:', e.response?.data || e.message);
    } else {
      console.error(e);
    }
  }
};
