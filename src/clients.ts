import OpenAI from 'openai';

import { OPENAI_API_KEY } from './config';

export const openAIClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
});
