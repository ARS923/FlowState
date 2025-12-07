# FlowState 🌊 - WINNER 2nd PLACE - GEMINI HACKATHON

**Visual Healing for Vibe Coders** — Click it. Learn it. Fix it.

> "Stitch helps you start a design. FlowState helps you finish it."

Built for the **Google Gemini API Developer Competition December 2025**

## Demo Video

Demo Video  

## Built With

| Component | Model | Purpose |
|-----------|-------|---------|
| **Inspector** | `gemini-3-pro-preview` | Vision analysis & defect detection |
| **Surgeon** | `gemini-3-pro-preview` | Code patching & style fixes |
| **Artist** | `gemini-3-pro-image-preview`| Image generation (Nano Banana Pro) |
| **EDU Mode** | `gemini-3-pro-preview` | Interactive Q&A about design principles |
| **Debug Mode** | `gemini-3-pro-preview` | JavaScript error analysis & fixes |

## What It Does

FlowState is a **browser overlay** that lets you heal broken UI directly on your site:

1. **Click 🌊** → Enter FlowState mode
2. **Click any element** → See defects + design variations
3. **Click 📚 Learn** → Understand WHY the fix matters
4. **Click 💬 EDU Mode** → Chat with AI about design principles
5. **Click 🐛 Debug** → Capture and analyze JavaScript errors
6. **Click ✨ Apply** → AI fixes everything instantly

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/flowstate.git
cd flowstate

# 2. Install dependencies
npm install

# 3. Add your API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 4. Start the server
npm start

# 5. Open the demos
open http://localhost:3001/demos/
```

## Live Demos

Visit `http://localhost:3001/demos/` for interactive demos:

| Demo | Description | Features |
|------|-------------|----------|
| **1. Ugly Button** | Fix a broken signup button | Quick Fix, Learn Panel, Variations |
| **2. Hero Image** | Regenerate stale hero images | Nano Banana Pro, Image Gen |
| **3. Annotation** | Draw and batch-heal issues | Draw Tools, Batch Heal |
| **4. Voice Commands** | Speak your fixes | Voice Input, Speech-to-Fix |
| **5. Debug Mode** | Fix a broken frontend | Error Capture, AI Analysis |

## Key Features

### 🔍 Visual Linting
Click any UI element to instantly detect:
- Padding & spacing issues
- Color contrast problems
- Border radius inconsistencies
- Touch target sizes
- Typography issues

### 📚 Learn Mode
Every defect includes educational content:
- What's wrong and why
- Code examples
- Pro tips
- Enter **EDU Mode** for deep-dive Q&A with AI

### 🐛 Debug Mode (NEW!)
Capture JavaScript errors automatically:
- Uncaught exceptions
- Promise rejections
- Console errors & warnings
- Stack traces
- **AI-powered error analysis and fix suggestions**

### 🎨 Design Variations
Get multiple fix options:
- Original
- Healed (recommended)
- Minimal
- Bold
- Soft
- Glass
- Neon

### 🖼️ Image Generation (Nano Banana Pro)
Click any image to regenerate it:
- AI-powered image generation
- Style-aware prompts
- Before/after comparison
- Save to assets folder

### ⚡ Workspace Mode
Toggle between:
- Compact view (460px panel)
- Workspace mode (side-by-side editing)

## Architecture

```
flowstate/
├── public/
│   ├── flowstate-overlay.js   # 🌟 THE MAIN FEATURE - browser overlay
│   ├── overlay-setup.html     # Setup instructions + bookmarklet
│   └── demos/                 # Interactive demo pages
│       ├── index.html         # Demo launcher
│       ├── 1-ugly-button.html
│       ├── 2-hero-image.html
│       ├── 3-annotation.html
│       ├── 4-voice.html
│       └── 5-broken-frontend.html
├── agents/
│   ├── inspector.js   # Vision → JSON diagnosis
│   ├── surgeon.js     # Code + defects → patched code
│   └── artist.js      # Prompt → generated image
├── lib/
│   ├── gemini-client.js   # Shared SDK config
│   └── safe-parse.js      # Response parsing
├── server.js          # Express API server
└── package.json
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/heal` | POST | Full pipeline (inspect + fix) |
| `/api/inspect` | POST | Vision analysis only |
| `/api/fix` | POST | Apply fixes to code |
| `/api/diff` | POST | Generate diff view |
| `/api/generate-asset` | POST | Generate image |
| `/api/save-asset` | POST | Save generated image |
| `/api/chat` | POST | EDU Mode Q&A |
| `/api/usage` | GET | Usage & budget tracking |
| `/api/restart` | POST | Restart dev server |
| `/health` | GET | Health check |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Exit FlowState mode |
| `Ctrl+Z` | Undo last change |
| `W` | Toggle Workspace Mode |
| `Ctrl+Shift+D` | Toggle Demo Mode (cached responses) |

## Browser Overlay Installation

Add FlowState to ANY localhost site:

**Option 1: Script tag**
```html
<script src="http://localhost:3001/flowstate-overlay.js"></script>
```

**Option 2: Bookmarklet**
Visit `http://localhost:3001/overlay-setup.html` and drag the bookmarklet to your toolbar.

**Option 3: Console**
```javascript
const s=document.createElement('script');s.src='http://localhost:3001/flowstate-overlay.js';document.body.appendChild(s);
```

## Technology Stack

- **Backend**: Node.js + Express
- **AI**: Google Gemini API (gemini-2.0-flash, imagen-3.0)
- **Frontend**: Vanilla JavaScript (zero dependencies)
- **Styling**: CSS-in-JS (injected styles)

## Problem Statements Addressed

- ✅ **Statement Two (Vibe Debugging)**: Circle + voice debugging on actual sites
- ✅ **Statement Four (Multi-Modality)**: Vision + voice + annotation + image generation
- ✅ **Educational**: Learn panel + EDU Mode for understanding design principles
- ✅ **Developer Tools**: Debug Mode for JavaScript error capture and analysis

## Team

Built by Andrew Smith, Efficient Frontier Labs, FlowState for the Google Gemini API Developer Competition 12.2025

## License

MIT
