import OpenAI from "openai";

// Support both old and new API keys
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY 
});

export interface AIResponse {
  text: string | null;
  status: 'ok' | 'rate_limited' | 'error';
}

// New function for the /v1/responses endpoint using direct HTTP
export async function callOpenAIResponses(
  model: string,
  input: string,
  maxRetries: number = 2
): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { text: null, status: 'error' };
  }

  let delay = 600; // Start with 0.6s delay
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input,
          store: false // Privacy: don't save user data at OpenAI
        }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (!response.ok) {
        if (response.status === 429) {
          if (attempt < maxRetries) {
            console.log(`Rate limited, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.8; // Exponential backoff
            continue;
          }
          return { text: null, status: 'rate_limited' };
        }
        return { text: null, status: 'error' };
      }

      const data = await response.json();
      
      // Parse response - try different response formats
      let text = null;
      if (data.output) {
        text = data.output;
      } else if (data.content && Array.isArray(data.content)) {
        text = data.content.map((c: any) => c.text || c).join('');
      } else if (data.content) {
        text = data.content;
      } else if (data.text) {
        text = data.text;
      }

      return {
        text,
        status: 'ok'
      };
    } catch (error: any) {
      console.log(`OpenAI Responses attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
      
      // Handle rate limit errors specifically
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        if (attempt < maxRetries) {
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.8; // Exponential backoff
          continue;
        }
        return { text: null, status: 'rate_limited' };
      }
      
      // Network or other errors
      return { text: null, status: 'error' };
    }
  }
  
  return { text: null, status: 'error' };
}

// Legacy function for backwards compatibility (keeping for fallback)
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
  const hasKey2 = !!process.env.OPENAI_API_KEY2;
  const hasKey1 = !!process.env.OPENAI_API_KEY;
  
  if (hasKey2) {
    return { ok: true, reason: 'key2_present' };
  } else if (hasKey1) {
    return { ok: true, reason: 'key1_present' };
  }
  return { ok: false, reason: 'no_api_key' };
}