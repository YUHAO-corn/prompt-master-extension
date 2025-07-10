# Development Setup Guide

This guide will help you set up the Prompt Master Extension for local development.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or later) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download here](https://git-scm.com/)
- **Chrome Browser** (for testing the extension)
- **Firebase Account** - [Sign up here](https://firebase.google.com/)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/prompt-master-extension.git
cd prompt-master-extension

# Install extension dependencies
cd extension
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "prompt-master-dev")
4. Enable Google Analytics (optional)
5. Create project

#### Configure Authentication
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable these providers:
   - Email/Password
   - Google (recommended)
3. Add authorized domains if needed

#### Configure Firestore Database
1. Go to **Firestore Database**
2. Click "Create database"
3. Start in **test mode** (for development)
4. Choose a location close to your users

#### Get Firebase Configuration
1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click "Web app" icon to add a web app
4. Register your app (name: "Prompt Master Extension")
5. Copy the configuration object

#### Setup Firebase Admin SDK
1. Go to **Project Settings** > **Service Accounts**
2. Click "Generate new private key"
3. Download the JSON file
4. Save it as `backend/config/firebase-admin-key.json`

### 3. Environment Configuration

```bash
# In the project root
cp .env.example .env.local

# Edit .env.local with your Firebase configuration
```

Example `.env.local`:
```bash
# Replace with your actual Firebase config
FIREBASE_CONFIG='{"apiKey":"AIza...","authDomain":"your-project.firebaseapp.com","projectId":"your-project-id","storageBucket":"your-project.firebasestorage.app","messagingSenderId":"123456789","appId":"1:123456789:web:abcdef123456"}'

# Backend configuration
BACKEND_API_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
FIREBASE_ADMIN_SDK_PATH=./config/firebase-admin-key.json
FIREBASE_PROJECT_ID=your-project-id
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
CORS_ORIGIN=http://localhost:3000,chrome-extension://your-extension-id-here
```

### 4. Start Development

#### Terminal 1: Backend Server
```bash
cd backend
npm run dev
```
The backend will start on http://localhost:3000

#### Terminal 2: Extension Build
```bash
cd extension
npm run dev
```
This will build the extension and watch for changes.

#### Terminal 3: Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension/build/` folder
5. Copy the extension ID from the loaded extension
6. Update `CORS_ORIGIN` in `.env.local` with the extension ID

## 🔧 Development Workflow

### Making Changes

#### Extension Changes
- Edit files in `extension/src/`
- The build process will automatically rebuild
- Refresh the extension in Chrome: click the refresh icon on the extension card

#### Backend Changes
- Edit files in `backend/src/`
- The server will automatically restart (using nodemon)
- No additional action needed

### Testing

#### Extension Testing
```bash
cd extension
npm test                    # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
```

#### Backend Testing
```bash
cd backend
npm test                    # Run API tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
```

#### Manual Testing
1. Load the extension in Chrome
2. Visit supported AI platforms (ChatGPT, Claude, etc.)
3. Press `/` to test the prompt selector
4. Test prompt management features

## 🐛 Troubleshooting

### Common Issues

#### "Firebase config not found"
- Check that `FIREBASE_CONFIG` is properly set in `.env.local`
- Ensure the JSON string is properly escaped
- Restart the development server

#### Extension not loading
- Check Chrome developer console for errors
- Ensure `extension/build/` directory exists and contains built files
- Try running `npm run build:dev` manually

#### Backend connection errors
- Verify backend is running on port 3000
- Check `BACKEND_API_URL` in environment configuration
- Ensure CORS is properly configured

#### Database permission errors
- Check Firestore security rules
- Ensure your Firebase project has authentication enabled
- Verify the admin SDK key file exists

### Debug Mode

#### Enable Extension Debug Logging
Add to your local extension build:
```javascript
// In extension/src/utils/debug.ts
export const DEBUG = true;
```

#### Enable Backend Debug Logging
```bash
# In .env.local
LOG_LEVEL=debug
```

### Reset Development Environment

If things get messed up, try this:

```bash
# Clean and reinstall
rm -rf extension/node_modules backend/node_modules
rm -rf extension/build

# Reinstall dependencies
cd extension && npm install
cd ../backend && npm install

# Rebuild everything
cd extension && npm run build:dev
cd ../backend && npm run dev
```

## 📚 Additional Resources

- [Chrome Extension Development Guide](https://developer.chrome.com/docs/extensions/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🆘 Getting Help

If you're stuck:

1. Check the [troubleshooting section](#troubleshooting) above
2. Search [existing issues](https://github.com/your-username/prompt-master-extension/issues)
3. Create a new issue with:
   - Your operating system
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Complete error messages
   - Steps to reproduce the problem

Happy coding! 🚀 