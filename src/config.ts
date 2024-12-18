import * as ChatAPI from 'openai/src/resources/chat/chat';

export const NOTIFICATION_CHANNELS = process.env.NOTIFICATION_CHANNELS?.split(',') ?? [];

export const BROWSER_WS = process.env.BROWSER_WS;

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_API_MODEL: ChatAPI.ChatModel =
  (process.env.OPENAI_API_MODEL as ChatAPI.ChatModel) ?? 'gpt-3.5-turbo';

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
