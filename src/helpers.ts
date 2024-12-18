import puppeteer from 'puppeteer';

import { BROWSER_WS } from './config';

const DEFAULT_PAGE_TIMEOUT_MS = 60000;

export const connectBrowser = async (url: string) => {
  const browser = await puppeteer.launch({
    // browserWSEndpoint: BROWSER_WS,
    headless: false,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: DEFAULT_PAGE_TIMEOUT_MS,
  });

  return {
    browser,
    page,
  };
};
