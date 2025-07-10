import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Retrieve the service account JSON string from environment variables
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. Please check your .env file.');
}

// Parse the JSON string to a JavaScript object
const serviceAccount = JSON.parse(serviceAccountJson);

// IMPORTANT: Replace the literal '\\n' characters in the private key with actual newline characters.
// This is necessary because .env files do not interpret escape sequences like '\n'.
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('Firebase Admin SDK initialized successfully.');

// Export the initialized admin instance for use in other services
export default admin;