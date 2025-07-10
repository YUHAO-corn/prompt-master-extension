// extension/src/background/aiFeaturesHandler.ts

// TODO: Import necessary services for API calls, key management, etc.
// import { getDoubaoApiKey } from '../services/optimizationService'; // Example if using Doubao
// import { ... } from '../services/messaging'; // For potential message sending

// Example API constants (adjust as needed)
// const AI_API_URL = '...';
// const AI_MODEL_ID = '...';

// Import the centralized AI service for generating titles
// import { generateTitleService } from '../services/aiService'; // Old incorrect import
import { generateTitle } from '@/services/utils/aiService'; // Corrected import

/**
 * Handles the GENERATE_TITLE message by calling the aiService.
 * 
 * @param payload - Expected to have { content: string }
 * @param sender - The message sender, contains tab ID.
 * @param sendResponse - Callback function to send the response.
 */
export async function handleGenerateTitle(
  payload: { content?: string }, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): Promise<void> {
  console.log('[AIHandler] Received GENERATE_TITLE request, content length:', payload?.content?.length);

  if (!sender.tab?.id || !payload?.content) {
    console.error('[AIHandler] Invalid GENERATE_TITLE request: Missing tab ID or content.', { payload, sender });
    sendResponse({ success: false, error: { code: 'ai/invalid-request', message: 'Invalid payload or sender tab info'} });
    return;
  }

  const tabId = sender.tab.id;
  const contentToSummarize = payload.content;

  try {
    console.log('[AIHandler] Calling aiService.generateTitleService...');
    // Call the centralized service
    // const generatedTitle = await generateTitleService(contentToSummarize); // Old call
    const generatedTitle = await generateTitle(contentToSummarize); // Corrected call

    console.log('[AIHandler] Title generation successful via service:', generatedTitle);
    
    // Send the generated title back to the content script that requested it
    chrome.tabs.sendMessage(tabId, {
        type: 'TITLE_GENERATED', // Ensure content script listens for this
        payload: { title: generatedTitle }
    }).catch(error => console.error(`[AIHandler] Error sending TITLE_GENERATED to Tab ${tabId}:`, error));

    // Acknowledge the background request was processed successfully
    sendResponse({ success: true }); 

  } catch (error: any) {
    console.error('[AIHandler] Error calling generateTitleService:', error);
    // Send error back to the original caller 
    sendResponse({ 
        success: false, 
        error: {
            // Use error code/message from the service if available, otherwise provide defaults
            code: error.code || 'ai/title-gen-failed', 
            message: error.message || 'Title generation failed' 
        }
    });
  }
  // sendResponse is handled asynchronously. Listener needs to return true.
} 