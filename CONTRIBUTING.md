# Contributing to FlowState

First off, thank you for considering contributing to FlowState! We believe the best developer tools are built in the open, and your contributions help make visual debugging accessible to everyone.

## Quick Start

1. Fork the repository and clone it locally
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`
4. Make your changes and test them locally
5. Submit a pull request

## Ways to Contribute

### Report Bugs

Found something broken? Open an issue with:

- A clear description of the bug
- Steps to reproduce it
- Screenshots if it's a visual issue (fitting for a visual linter!)
- Your browser and OS

### Suggest Features

Have an idea? We'd love to hear it. Open an issue tagged `enhancement` and describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

### Submit Code

Ready to dive in? Here are some good first issues to tackle:

- Documentation improvements
- Adding new visual inspection rules
- UI/UX polish
- Performance optimizations

## Development Guidelines

### Code Style

- We use ESLint and Prettier—run `npm run lint` before committing
- Write descriptive commit messages
- Keep pull requests focused on a single feature or fix

### Architecture Overview

FlowState uses a chain-of-thought architecture with specialized agents:

- **The Inspector**: Analyzes screenshots and identifies visual defects
- **The Surgeon**: Applies targeted code fixes based on defect reports
- **The Artist**: Generates assets when needed (via Nano Banana Pro / Imagen integration)
- **Usage Tracker**: Monitors API calls, tokens, and budget limits

When contributing to the AI pipeline, maintain this separation of concerns.

### Key Systems

- **Design Knowledge Base** (`lib/design-knowledge.js`): Educational content for 10 design topics
- **Usage Tracking** (`lib/usage-tracker.js`): Singleton for monitoring API costs and budget
- **Onboarding Flow**: 4-step guided tour for new users

### Testing

- Test your changes locally with real UI components
- For visual inspection changes, include before/after screenshots in your PR

## Pull Request Process

1. Update documentation if you're changing behavior
2. Ensure your code passes linting (`npm run lint`)
3. Write a clear PR description explaining what and why
4. Link any related issues

## Community

- Be respectful and inclusive
- Ask questions—there are no dumb ones
- Help others when you can
