import * as ChatAPI from 'openai/src/resources/chat/chat';

export const SCHEDULE = process.env.SCHEDULE;
export const BROWSER_WS = process.env.BROWSER_WS;
export const NOTIFICATION_CHANNELS = process.env.NOTIFICATION_CHANNELS?.split(',') ?? [];

export const OPENAI_ENABLED =
  process.env.OPENAI_ENABLED === 'true' || process.env.OPENAI_ENABLED === '1';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_MODEL: ChatAPI.ChatModel =
  (process.env.OPENAI_MODEL as ChatAPI.ChatModel) ?? 'gpt-3.5-turbo';
export const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS);
export const OPENAI_INSTRUCTION = process.env.OPENAI_INSTRUCTION;

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const YAHOO_FINANCE_NEWS_PAGES_LIMIT = Number(process.env.YAHOO_FINANCE_NEWS_PAGES_LIMIT);
