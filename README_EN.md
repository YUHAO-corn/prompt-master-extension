# 🌊 Prompt Master Extension

> **Your Prompts, All In One Place. Everywhere.**  
> **让您的提示词，随处可见，随时可用**

**English | [中文](README.md)**

A powerful Chrome extension for AI prompt management that helps you save, organize, and optimize your prompts across all AI platforms.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

## ✨ Features

### 🚀 Quick Access
- **Instant Activation**: Press `/` on any AI platform to instantly access your prompt library
- **Universal Compatibility**: Works on ChatGPT, Claude, Gemini, and 50+ AI platforms
- **One-Click Insert**: Select and insert prompts with a single click

### 📚 Smart Organization
- **Centralized Library**: All your prompts in one organized location
- **Smart Categories**: Auto-categorize prompts or create custom tags
- **Powerful Search**: Find any prompt instantly with intelligent search
- **Cloud Sync**: Access your prompts across all devices

### 🤖 AI-Powered Optimization
- **Prompt Enhancement**: AI analyzes and suggests improvements to your prompts
- **Performance Metrics**: Track which prompts work best
- **Template Generation**: Create reusable prompt templates
- **Context Awareness**: Prompts adapt to different AI platforms

### 🔄 Seamless Integration
- **Platform Detection**: Automatically detects which AI platform you're using
- **Format Adaptation**: Adjusts prompt format for optimal platform compatibility
- **Batch Operations**: Manage multiple prompts efficiently
- **Export/Import**: Easy backup and sharing capabilities

## 🚀 Quick Start

### For Users

1. **Install the Extension**
   ```bash
   # Download from Chrome Web Store (coming soon)
   # Or build from source (see Development section)
   ```

2. **First-Time Setup**
   - Create your account or sign in
   - Import existing prompts (optional)
   - Start organizing your prompt library

3. **Start Using**
   - Visit any supported AI platform
   - Press `/` to open the prompt selector
   - Choose your prompt and let the magic happen!

### For Developers

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/prompt-master-extension.git
   cd prompt-master-extension
   ```

2. **Setup Environment**
   ```bash
   # Copy environment configuration
   cp .env.example .env.local
   
   # Edit .env.local with your Firebase config
   # See .env.example for detailed instructions
   ```

3. **Install Dependencies**
   ```bash
   # Extension dependencies
   cd extension && npm install
   
   # Backend dependencies  
   cd ../backend && npm install
   ```

4. **Start Development**
   ```bash
   # Start backend server
   cd backend && npm run dev
   
   # Build extension (in another terminal)
   cd extension && npm run build:dev
   
   # Load in Chrome: chrome://extensions/ > Load unpacked > extension/build/
   ```

## 🏗️ Architecture

### System Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Chrome        │    │   Backend API    │    │   Firebase      │
│   Extension     │◄──►│   (Node.js)      │◄──►│   (Auth + DB)   │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  AI Platforms   │    │  Prompt Engine   │    │  User Data      │
│  (ChatGPT, etc) │    │  (Optimization)  │    │  (Prompts, etc) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Technical Stack

**Frontend (Chrome Extension)**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Webpack 5 with Chrome Extension support
- **Styling**: Tailwind CSS for responsive design
- **State Management**: React Context + Hooks
- **Authentication**: Firebase Auth integration

**Backend (API Server)**
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript for type safety
- **Database**: Firebase Firestore
- **Authentication**: Firebase Admin SDK
- **API Design**: RESTful with JSON responses

**Infrastructure**
- **Hosting**: Google Cloud Run (auto-scaling)
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Authentication
- **Storage**: Firebase Storage for assets
- **Monitoring**: Google Cloud Monitoring

## 🛠️ Development

### Prerequisites
- Node.js 16+ and npm
- Chrome browser
- Firebase account
- Git

### Project Structure
```
prompt-master-extension/
├── extension/                 # Chrome extension source
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/           # Custom React hooks  
│   │   ├── services/        # API and Firebase services
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   └── manifest.json        # Extension manifest
├── backend/                  # Backend API server
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Express middleware
│   │   └── utils/           # Utility functions
│   └── config/              # Configuration files
├── docs/                     # Documentation
├── scripts/                  # Build and deployment scripts
└── tests/                    # Test suites
```

### Available Scripts

**Extension Development**
```bash
cd extension
npm run dev          # Development build with watch
npm run build        # Production build
npm run build:dev    # Development build
npm run test         # Run tests
npm run lint         # Lint code
```

**Backend Development**
```bash
cd backend  
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run tests
npm run lint         # Lint code
```

### Testing

```bash
# Run all tests
npm run test

# Run extension tests
cd extension && npm test

# Run backend tests  
cd backend && npm test

# Run E2E tests
npm run test:e2e
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest new features
- 🛠️ Submit code improvements
- 📖 Improve documentation
- 🌍 Help with translations

### Development Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests and documentation
5. Submit a pull request

## 🌟 Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| ChatGPT | ✅ Full Support | All features available |
| Claude | ✅ Full Support | All features available |
| Google Gemini | ✅ Full Support | All features available |
| Bing Chat | ✅ Full Support | All features available |
| Character.AI | ✅ Supported | Basic features |
| Poe | ✅ Supported | Basic features |
| 50+ Others | ✅ Supported | Basic prompt insertion |

## 📊 Roadmap

### Current Version (v1.0)
- ✅ Core prompt management
- ✅ Universal "/" shortcut
- ✅ Cloud synchronization
- ✅ Basic AI optimization

### Upcoming Features (v1.1-v1.2)
- 🔄 Advanced prompt templates
- 🔄 Team collaboration features
- 🔄 Prompt performance analytics
- 🔄 Mobile companion app

### Future Vision (v2.0+)
- 🔮 AI-native prompt generation
- 🔮 Cross-platform desktop app
- 🔮 Enterprise team features
- 🔮 API for third-party integrations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- 📖 **Documentation**: Check our [docs](./docs/) folder
- 💬 **Discussions**: Use GitHub Discussions for questions
- 🐛 **Bug Reports**: Open an issue with the bug template
- 💡 **Feature Requests**: Open an issue with the feature template
- 📧 **Direct Contact**: reach out for sensitive matters

## 🎉 Acknowledgments

- Thanks to all contributors who help make this project better
- Inspired by the amazing AI community and their prompt-sharing culture
- Built with love for developers, content creators, and AI enthusiasts

---

**Made with ❤️ by the Aetherflow Team**

*Simplifying AI prompt management, one shortcut at a time.*

---

**English | [中文](README.md)** 