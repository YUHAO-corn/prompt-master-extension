# Contributing to Prompt Master Extension

Thank you for your interest in contributing to Prompt Master Extension! This document provides guidelines and information for contributors.

## 🌟 Ways to Contribute

- 🐛 **Bug Reports**: Found a bug? Let us know!
- 💡 **Feature Requests**: Have an idea? We'd love to hear it!
- 🛠️ **Code Contributions**: Submit pull requests for fixes or features
- 📖 **Documentation**: Help improve our docs
- 🌍 **Translations**: Help make the extension accessible worldwide

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Git
- Chrome browser for testing

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/prompt-master-extension.git
   cd prompt-master-extension
   ```

2. **Install Dependencies**
   ```bash
   # Install extension dependencies
   cd extension
   npm install
   
   # Install backend dependencies
   cd ../backend
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy example environment file
   cp .env.example .env.local
   
   # Edit .env.local with your configurations
   # See .env.example for detailed instructions
   ```

4. **Firebase Setup**
   - Create a Firebase project at https://console.firebase.google.com/
   - Enable Authentication and Firestore
   - Download service account key to `backend/config/firebase-admin-key.json`
   - Update `.env.local` with your Firebase config

5. **Start Development**
   ```bash
   # Start backend server
   cd backend
   npm run dev
   
   # In another terminal, build extension
   cd extension
   npm run build:dev
   
   # Load extension in Chrome
   # 1. Open chrome://extensions/
   # 2. Enable Developer mode
   # 3. Click "Load unpacked" and select extension/build/
   ```

## 🛠️ Development Workflow

### Project Structure
```
prompt-master-extension/
├── extension/              # Chrome extension code
│   ├── src/
│   ├── public/
│   └── manifest.json
├── backend/               # Node.js API server
│   ├── src/
│   └── config/
├── docs/                  # Documentation
└── scripts/               # Build and utility scripts
```

### Making Changes

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Write tests if applicable

3. **Test Your Changes**
   ```bash
   # Run tests
   npm test
   
   # Manual testing
   # Load extension in Chrome and test functionality
   ```

4. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

## 📝 Code Style Guidelines

### General Principles
- Write self-documenting code with clear variable names
- Use TypeScript for type safety
- Follow existing patterns and conventions
- Keep functions small and focused

### JavaScript/TypeScript
- Use ES6+ features
- Prefer `const` and `let` over `var`
- Use async/await over Promise chains
- Add JSDoc comments for public functions

### React Components
- Use functional components with hooks
- Follow React best practices
- Use descriptive component names
- Implement proper error boundaries

### Git Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for test additions/modifications

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear Description**: What happened vs. what was expected
2. **Steps to Reproduce**: Detailed steps to recreate the issue
3. **Environment**: OS, Chrome version, extension version
4. **Screenshots**: If applicable
5. **Error Logs**: Check browser console for errors

Use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md)

## 💡 Feature Requests

For feature requests, please provide:

1. **Problem Statement**: What problem does this solve?
2. **Proposed Solution**: How should it work?
3. **Alternatives**: Any alternative solutions considered?
4. **Use Cases**: Who would benefit from this feature?

Use our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md)

## 🔍 Pull Request Process

1. **Check Existing Issues**: Link your PR to relevant issues
2. **Update Documentation**: Include doc updates if needed
3. **Add Tests**: Write tests for new functionality
4. **Update Changelog**: Add entry to CHANGELOG.md
5. **Request Review**: Tag maintainers for review

### PR Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
- [ ] Linked to relevant issue(s)

## 🏷️ Release Process

We use semantic versioning (SemVer):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## 🤝 Community Guidelines

### Code of Conduct
We follow the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

### Getting Help
- 💬 **Discussions**: Use GitHub Discussions for questions
- 🐛 **Issues**: Use GitHub Issues for bugs and features
- 📧 **Email**: Contact maintainers directly for sensitive matters

## 🎉 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Invited to join our contributors team

## 📚 Additional Resources

- [Chrome Extension Development Guide](https://developer.chrome.com/docs/extensions/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

Thank you for contributing to Prompt Master Extension! 🚀 