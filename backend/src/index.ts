import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Initialize Firebase Admin SDK first to ensure it's available for all routes.
import './services/firebase.service';

import authRoutes from './api/auth.routes'; // Import the auth routes
import dataRoutes from './api/data.routes'; // Import the data routes

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8080;

// --- Universal Request Logger (Sentry Middleware) ---
// This will be the very first middleware to run for ANY incoming request.
app.use((req, res, next) => {
  console.log(`[Sentry Log] Request Received: ${req.method} ${req.originalUrl}`);
  next();
});

// Middlewares
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // To parse JSON bodies

// A simple root route to check if the server is running
app.get('/', (req: Request, res: Response) => {
  res.send('Aetherflow Backend Server is running!');
});

// API Routes
app.use('/api/auth', authRoutes); // Authentication routes
app.use('/api/data', dataRoutes); // Data operations routes (requires authentication)

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

// Export the app instance for Vercel's serverless environment
export default app; 