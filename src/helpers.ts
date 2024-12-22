import puppeteer from 'puppeteer';

import {
  BROWSER_WS,
  NOTIFICATION_CHANNELS,
  OPENAI_INSTRUCTION,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_ENABLED,
  SCHEDULE,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  OPENAI_MAX_TOKENS,
  YAHOO_FINANCE_NEWS_PAGES_LIMIT,
} from './config';

const DEFAULT_PAGE_TIMEOUT_MS = 60000;

export const log = (level: 'info' | 'warn' | 'error', message: string, error?: Error) => {
  const timestamp = new Date().toISOString();
  const errorDetails = error ? ` | Error: ${error.message}` : '';

  console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}${errorDetails}`);
};

const maskSensitive = (value: string | undefined, visibleChars = 4): string => {
  if (!value) {
    return '***';
  }

  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }

  return value.length > visibleChars * 2
    ? `${value.slice(0, visibleChars)}${'*'.repeat(value.length - visibleChars * 2)}${value.slice(-visibleChars)}`
    : `${value.slice(0, visibleChars)}${'*'.repeat(value.length - visibleChars)}`;
};

export const logConfiguration = () => {
  console.log(`
Configuration:
  SCHEDULE: ${SCHEDULE}
  BROWSER_WS: ${maskSensitive(BROWSER_WS)}
  NOTIFICATION_CHANNELS: ${NOTIFICATION_CHANNELS.length > 0 ? NOTIFICATION_CHANNELS.join(', ') : ''}
  OPENAI_ENABLED: ${OPENAI_ENABLED}
  OPENAI_API_KEY: ${maskSensitive(OPENAI_API_KEY)}
  OPENAI_MODEL: ${OPENAI_MODEL}
  OPENAI_MAX_TOKENS: ${OPENAI_MAX_TOKENS}
  OPENAI_INSTRUCTION: ${OPENAI_INSTRUCTION}
  TELEGRAM_BOT_TOKEN: ${maskSensitive(TELEGRAM_BOT_TOKEN)}
  TELEGRAM_CHAT_ID: ${maskSensitive(TELEGRAM_CHAT_ID)}
  YAHOO_FINANCE_NEWS_PAGES_LIMIT: ${YAHOO_FINANCE_NEWS_PAGES_LIMIT}
  `);
};

export const connectBrowser = async (url: string) => {
  const browser = BROWSER_WS
    ? await puppeteer.connect({
        browserWSEndpoint: BROWSER_WS,
      })
    : await puppeteer.launch({
        headless: false,
      });

  const page = await browser.newPage();
  page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);

  if (BROWSER_WS) {
    const cdpSession = await page.createCDPSession();
    const {
      frameTree: { frame },
    } = await cdpSession.send('Page.getFrameTree');

    // @ts-expect-error
    const response: { url: string } = await cdpSession.send('Page.inspect', {
      frameId: frame.id,
    });

    log('info', `Inspect session at ${response.url}`);
  }

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: DEFAULT_PAGE_TIMEOUT_MS,
  });

  return {
    browser,
    page,
  };
};

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const withRetries = async <T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelay = 3000,
  delayFactor = 2, // Multiply delay by this factor on each retry
): Promise<T> => {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (e) {
      attempt++;

      if (attempt > maxRetries) {
        throw e; // Exhausted retries
      }

      log(
        'warn',
        `Retrying (${attempt}/${maxRetries}) in ${delay}ms after error: ${(e as Error).message}`,
      );
      await wait(delay);

      // Increment delay for next retry
      delay *= delayFactor;
    }
  }

  throw new Error('Unexpected error in retry logic');
};

export const cleanupContent = (rawContent: string | null | undefined) =>
  rawContent?.replace(/\s+/g, ' ').trim();
