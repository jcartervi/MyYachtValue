import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AIResponse {
  text: string | null;
  status: 'ok' | 'rate_limited' | 'error';
}

export async function callOpenAI(
  model: string,
  messages: any[],
  options: any = {},
  maxRetries: number = 2
): Promise<AIResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return { text: null, status: 'error' };
  }

  let delay = 600; // Start with 0.6s delay
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        ...options,
        timeout: 15000 // 15 second timeout
      });

      return {
        text: response.choices[0].message.content,
        status: 'ok'
      };
    } catch (error: any) {
      console.log(`OpenAI attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
      
      // Handle rate limit errors specifically
      if (error.status === 429 || error.message?.includes('429') || error.message?.includes('rate')) {
        if (attempt < maxRetries) {
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.8; // Exponential backoff
          continue;
        }
        return { text: null, status: 'rate_limited' };
      }
      
      // Other API errors (5xx, auth, etc)
      if (error.status >= 400) {
        return { text: null, status: 'error' };
      }
      
      // Network or other errors
      return { text: null, status: 'error' };
    }
  }
  
  return { text: null, status: 'error' };
}

export function openAIHealth(): { ok: boolean; reason: string } {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, reason: 'no_api_key' };
  }
  return { ok: true, reason: 'key_present' };
}