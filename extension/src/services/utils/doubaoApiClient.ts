// extension/src/services/utils/doubaoApiClient.ts

// Consistent retry count
const MAX_RETRIES = 1; 
// Consistent delay
const RETRY_DELAY = 500; 

/**
 * Helper delay function. Exported for potential other uses.
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Potentially other shared utility functions or constants related to API clients can go here in the future. 