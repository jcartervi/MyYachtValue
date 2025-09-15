import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY2) {
  console.error("Missing OPENAI_API_KEY");
}

// Support both old and new API keys
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

export interface AIResponse {
  text: string | null;
  status: 'ok' | 'rate_limited' | 'error';
}

// Dual-path AI function: try Responses API first, fallback to Chat Completions
export async function callOpenAIResponses(
  model: string,
  input: string,
  maxRetries: number = 2
): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { text: null, status: 'error' };
  }

  // Try Responses API first if enabled
  if (process.env.OPENAI_USE_RESPONSES === 'true') {
    const responsesResult = await tryResponsesAPI(apiKey, model, input, maxRetries);
    if (responsesResult.status === 'ok') {
      return responsesResult;
    }
    console.log('Responses API failed, falling back to Chat Completions...');
  }

  // Fallback to Chat Completions API with new key
  let delay = 600; // Start with 0.6s delay
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // Use available model 
          messages: [
            {
              role: "user",
              content: input
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
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
      
      // Parse chat completions response
      let text = null;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        text = data.choices[0].message.content;
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

// Try the Responses API endpoint as requested
async function tryResponsesAPI(
  apiKey: string,
  model: string,
  input: string,
  maxRetries: number
): Promise<AIResponse> {
  let delay = 600;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model === "gpt-4o-mini" ? "gpt-5-nano" : model, // Use requested model
          input,
          store: false // Privacy: don't save user data at OpenAI
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        if (response.status === 429) {
          if (attempt < maxRetries) {
            console.log(`Responses API rate limited, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.8;
            continue;
          }
          return { text: null, status: 'rate_limited' };
        }
        return { text: null, status: 'error' };
      }

      const data = await response.json();
      
      // Parse Responses API response format
      let text = null;
      if (data.output) {
        text = data.output;
      } else if (data.content) {
        text = data.content;
      } else if (data.text) {
        text = data.text;
      }

      return { text, status: 'ok' };
    } catch (error: any) {
      console.log(`Responses API attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
      
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        if (attempt < maxRetries) {
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.8;
          continue;
        }
        return { text: null, status: 'rate_limited' };
      }
      
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