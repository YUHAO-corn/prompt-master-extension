// extension/src/services/utils/aiProxyClient.ts

// --- AI Proxy Service Configuration ---
// Updated to point to the backend AI proxy service
const AI_PROXY_API_URL = 'https://ai-proxy-service-423266303314.us-west2.run.app/api/proxy/qwen';
const MAX_RETRIES = 1; // Consistent retry count
const RETRY_DELAY = 500; // Consistent delay
// --- End Configuration ---

/**
 * Helper delay function.
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define expected message format (remains the same for now)
interface AIProxyMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Define options for the API call (remains largely the same, model is handled by proxy)
interface AIProxyOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean; // Added stream option as proxy supports it
}

/**
 * Core function to call the AI Proxy Service.
 * Handles request building, fetch execution, retries, and basic error handling.
 * 
 * @param messages - An array of message objects { role: string, content: string }.
 * @param options - Optional parameters like temperature and max_tokens.
 * @returns A promise resolving to the content string of the assistant's reply (if not streaming).
 *          If streaming, the response might need different handling based on proxy's stream format.
 *          For now, assuming non-streaming returns similar to previous structure.
 * @throws An error if the request fails after retries, or the response format is invalid.
 *         Specific error messages are provided.
 */
export async function callAIProxy(
    messages: AIProxyMessage[],
    options: AIProxyOptions = {} // Default to empty options object
): Promise<string> { // Assuming string response for non-streaming, adjust if proxy streams differently

    const headers = {
        'Content-Type': 'application/json',
        // No Authorization header needed, proxy handles Qwen auth
    };

    const body = JSON.stringify({
        // No model field, proxy service determines the model (e.g., Qwen)
        messages: messages,
        // Spread options, providing defaults if necessary
        temperature: options.temperature ?? 0.5,
        max_tokens: options.max_tokens ?? 1000,
        top_p: options.top_p ?? 0.9,
        frequency_penalty: options.frequency_penalty ?? 0,
        presence_penalty: options.presence_penalty ?? 0,
        stop: options.stop ?? undefined,
        stream: options.stream ?? false, // Default to non-streaming
    });

    let retries = MAX_RETRIES;
    while (retries >= 0) {
        try {
            console.log('[AIProxyClient] Calling AI Proxy Service with options:', options);
            const response = await fetch(AI_PROXY_API_URL, {
                method: 'POST',
                headers: headers,
                body: body
            });

            if (!response.ok) {
                // Handle retryable errors (e.g., 5xx, 429)
                if ((response.status >= 500 || response.status === 429) && retries > 0) {
                    console.warn(`[AIProxyClient] API Request Failed (${response.status}), retrying in ${RETRY_DELAY}ms (${retries} retries left)...`);
                    await delay(RETRY_DELAY);
                    retries--;
                    continue; // Retry the fetch
                }
                // Non-retryable errors or final retry failed
                const errorDataText = await response.text(); // Get raw text to avoid JSON parse error if not JSON
                let errorData;
                try {
                    errorData = JSON.parse(errorDataText);
                } catch (e) {
                    errorData = { message: 'Failed to parse error response as JSON', raw: errorDataText };
                }
                console.error(`[AIProxyClient] AI Proxy Service Request Failed: ${response.status} ${response.statusText}`, errorData);
                throw new Error(`AI Proxy Request Failed (${response.status}): ${errorData.error || errorData.message || response.statusText}`);
            }

            // Process successful response
            // Assuming the proxy service relays the same response structure for choices[0].message.content
            // This might need adjustment based on the actual proxy response for Qwen.
            const responseData = await response.json();
            if (responseData.choices?.[0]?.message?.content) {
                const assistantReply = responseData.choices[0].message.content;
                console.log('[AIProxyClient] AI Proxy Service Call Successful.');
                return assistantReply; // Return the content string
            } else if (responseData.choices?.[0]?.delta?.content && options.stream) {
                // Basic handling for a streaming response chunk, assuming OpenAI-like delta format
                // Proper stream handling would involve accumulating these deltas.
                // For now, if it's a stream, this function's Promise<string> return type is insufficient.
                // This part needs more robust design if streaming is a primary use case.
                console.log('[AIProxyClient] AI Proxy Service Stream chunk received.');
                return responseData.choices[0].delta.content; // For simplicity, returning first chunk
            }
            else {
                console.error('[AIProxyClient] Invalid AI Proxy Service response format:', responseData);
                throw new Error('Invalid AI Proxy Service Response Format');
            }

        } catch (error: unknown) {
            if (error instanceof Error && error.message.startsWith('AI Proxy Request Failed')) {
                 throw error;
            }
            
            if (retries <= 0) {
                console.error('[AIProxyClient] API request failed after maximum retries or other error occurred:', error);
                 throw new Error(`AI Proxy Call Failed (${error instanceof Error ? error.message : 'Unknown Network/Fetch Error'})`);
            } else {
                 console.warn(`[AIProxyClient] Network or fetch error occurred, retrying in ${RETRY_DELAY}ms (${retries} retries left)...`, error);
                 await delay(RETRY_DELAY);
                 retries--;
            }
        }
    }
    // This line should technically be unreachable if MAX_RETRIES >= 0
    throw new Error('AI Proxy Call Failed (Max Retries Exceeded)');
} 