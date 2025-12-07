import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { runFlowStateAPI } from "./orchestrator.js";
import { inspect } from "./agents/inspector.js";
import { operateOnCode } from "./agents/surgeon.js";
import { generateAsset, generateUIAsset } from "./agents/artist.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import usageTracker, { UsageTracker } from "./lib/usage-tracker.js";
import dotenv from "dotenv";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Large limit for base64 images

/**
 * Serve frontend at root
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index-v3.html'));
});

// Serve static files (after explicit routes so they don't override)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'frontend')));

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "flowstate" });
});

/**
 * Full FlowState pipeline
 * POST /api/heal
 * Body: { screenshot: base64, code: string, mimeType?: string }
 */
app.post("/api/heal", async (req, res) => {
  try {
    const { screenshot, code, mimeType = "image/png" } = req.body;

    if (!screenshot || !code) {
      return res.status(400).json({
        error: "Missing required fields: screenshot (base64) and code (string)",
      });
    }

    console.log("\n🌊 /api/heal request received");
    console.log(`   Code length: ${code.length} chars`);
    console.log(`   Image type: ${mimeType}`);

    const result = await runFlowStateAPI({
      screenshotBase64: screenshot,
      code,
      mimeType,
    });

    res.json(result);
  } catch (e) {
    console.error("❌ /api/heal error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Inspect only (no code modification)
 * POST /api/inspect
 * Body: { screenshot?: base64, context?: object, mimeType?: string }
 */
app.post("/api/inspect", async (req, res) => {
  try {
    const { screenshot, context, mimeType = "image/png" } = req.body;

    console.log("\n👁️ /api/inspect request received");

    // If we have a screenshot, use vision-based inspection
    if (screenshot) {
      const tempPath = `/tmp/flowstate-inspect-${Date.now()}.png`;
      fs.writeFileSync(tempPath, Buffer.from(screenshot, "base64"));

      const result = await inspect(tempPath);

      // Cleanup
      fs.unlinkSync(tempPath);

      return res.json(result);
    }
    
    // If we only have context (from overlay), do context-based analysis
    if (context) {
      console.log("   Context-based analysis for:", context.element);
      
      // Analyze based on computed styles and element info
      const defects = analyzeElementContext(context);
      
      return res.json({
        success: true,
        data: {
          looks_good: defects.length === 0,
          visual_defects: defects,
          needs_asset_generation: false,
          asset_generation_prompt: null,
        }
      });
    }

    return res.status(400).json({
      error: "Missing required field: screenshot (base64) or context (object)",
    });
  } catch (e) {
    console.error("❌ /api/inspect error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Analyze element based on context (styles, dimensions, etc.)
 * Used by the browser overlay when screenshots aren't available
 */
function analyzeElementContext(context) {
  const defects = [];
  const { element, currentStyles, dimensions, parentTag } = context;
  
  if (!currentStyles) return defects;
  
  // Parse padding
  const padding = currentStyles.padding || '';
  const paddingValues = padding.split(' ').map(v => parseInt(v) || 0);
  
  // Check for common issues
  
  // 1. Button-specific checks
  if (element === 'button') {
    // Check padding consistency
    if (paddingValues.some(v => v < 10)) {
      defects.push({
        id: 'defect-1',
        element: 'button',
        element_text: context.text,
        selector_hint: context.selector || 'button',
        issue: `Button padding is too small (${padding})`,
        expected: '12px 16px for comfortable click target',
        why: 'Small padding makes buttons hard to tap on mobile'
      });
    }
    
    // Check border-radius consistency
    const borderRadius = parseInt(currentStyles.borderRadius) || 0;
    if (borderRadius < 6 && borderRadius > 0) {
      defects.push({
        id: 'defect-2',
        element: 'button',
        element_text: context.text,
        selector_hint: context.selector || 'button',
        issue: `Button border-radius (${borderRadius}px) may look dated`,
        expected: '8px for a modern, friendly appearance',
        why: 'Slightly rounded corners feel more approachable'
      });
    }
    
    // Check for full-width in form context
    if (dimensions.width && parentTag === 'div') {
      const parentWidth = 400; // Assume standard form width
      if (dimensions.width < parentWidth * 0.5) {
        defects.push({
          id: 'defect-3',
          element: 'button',
          element_text: context.text,
          selector_hint: context.selector || 'button',
          issue: 'Button width may be inconsistent with form inputs',
          expected: 'Full width (100%) to match input fields',
          why: 'Consistent widths create visual harmony in forms'
        });
      }
    }
  }
  
  // 2. Input-specific checks
  if (element === 'input') {
    if (paddingValues.some(v => v < 8)) {
      defects.push({
        id: 'defect-input-1',
        element: 'input',
        element_text: context.text,
        selector_hint: context.selector || 'input',
        issue: 'Input padding is cramped',
        expected: '12px 16px for comfortable text entry',
        why: 'Adequate padding improves readability and usability'
      });
    }
  }
  
  // 3. Color contrast checks
  const bgColor = currentStyles.backgroundColor;
  const textColor = currentStyles.color;
  if (bgColor && textColor) {
    // Simple contrast check (not WCAG-accurate but indicative)
    const isDarkBg = bgColor.includes('rgb(0') || bgColor.includes('#0') || bgColor.includes('#1');
    const isDarkText = textColor.includes('rgb(0') || textColor.includes('#0') || textColor.includes('#1') || textColor.includes('#2') || textColor.includes('#3');
    
    if (isDarkBg && isDarkText) {
      defects.push({
        id: 'defect-contrast',
        element: element,
        element_text: context.text,
        selector_hint: context.selector || element,
        issue: 'Text may have low contrast against background',
        expected: 'Light text (#FFFFFF or similar) on dark backgrounds',
        why: 'Good contrast is essential for readability and accessibility'
      });
    }
  }
  
  return defects;
}

/**
 * Inspect annotated screenshot
 * POST /api/inspect-annotations
 * Body: { screenshot: base64, annotations: string[], voiceInstructions?: string[], mimeType?: string }
 */
app.post("/api/inspect-annotations", async (req, res) => {
  try {
    const { screenshot, annotations = [], voiceInstructions = [], mimeType = "image/png" } = req.body;

    if (!screenshot) {
      return res.status(400).json({
        error: "Missing required field: screenshot (base64)",
      });
    }

    console.log("\n🖊️ /api/inspect-annotations request received");
    console.log(`   Annotations: ${annotations.length}`);
    annotations.forEach((a, i) => console.log(`   ${i + 1}. ${a}`));
    
    if (voiceInstructions.length > 0) {
      console.log(`   🎙️ Voice instructions: ${voiceInstructions.length}`);
      voiceInstructions.forEach((v, i) => console.log(`      ${i + 1}. "${v}"`));
    }

    // Write temp file for inspector
    const tempPath = `/tmp/flowstate-annotated-${Date.now()}.png`;
    fs.writeFileSync(tempPath, Buffer.from(screenshot, "base64"));

    // Use the inspector with additional context about annotations
    const result = await inspect(tempPath);
    
    // Cleanup
    fs.unlinkSync(tempPath);

    // Enhance the result with annotation context
    if (result.success && result.data) {
      result.data.annotation_context = annotations;
      result.data.voice_instructions = voiceInstructions;
    }

    res.json(result);
  } catch (e) {
    console.error("❌ /api/inspect-annotations error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Surgery only (fix code based on provided defects)
 * POST /api/fix
 * Body: { code: string, defects: string[] }
 */
app.post("/api/fix", async (req, res) => {
  try {
    const { code, defects } = req.body;

    if (!code || !defects || !Array.isArray(defects)) {
      return res.status(400).json({
        error: "Missing required fields: code (string) and defects (array)",
      });
    }

    console.log("\n🩺 /api/fix request received");
    console.log(`   Defects: ${defects.length}`);

    const result = await operateOnCode(code, defects);

    res.json(result);
  } catch (e) {
    console.error("❌ /api/fix error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Generate diff between original and fixed code
 * POST /api/diff
 * Body: { original: string, fixed: string }
 */
app.post("/api/diff", (req, res) => {
  try {
    const { original, fixed } = req.body;

    if (!original || !fixed) {
      return res.status(400).json({
        error: "Missing required fields: original and fixed",
      });
    }

    // Simple line-by-line diff
    const originalLines = original.split("\n");
    const fixedLines = fixed.split("\n");

    const diff = [];
    const maxLines = Math.max(originalLines.length, fixedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || "";
      const fixedLine = fixedLines[i] || "";

      if (origLine !== fixedLine) {
        diff.push({
          line: i + 1,
          type: !origLine ? "added" : !fixedLine ? "removed" : "changed",
          original: origLine,
          fixed: fixedLine,
        });
      }
    }

    res.json({
      totalChanges: diff.length,
      diff,
    });
  } catch (e) {
    console.error("❌ /api/diff error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Generate an asset using Nano Banana / Gemini Image Generation
 * POST /api/generate-asset
 * Body: { prompt: string, context?: string, theme?: string }
 */
app.post("/api/generate-asset", async (req, res) => {
  try {
    const { prompt, context = "general", theme = "dark" } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "Missing required field: prompt",
      });
    }

    console.log("\n🎨 /api/generate-asset request received");
    console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`   Context: ${context}, Theme: ${theme}`);

    // Check budget before making request
    const budgetCheck = usageTracker.checkBudget(0.02); // Estimated cost for image gen
    if (!budgetCheck.allowed) {
      return res.status(402).json({
        success: false,
        error: `Budget exceeded. Remaining: $${budgetCheck.remaining.toFixed(4)}`,
        budgetRemaining: budgetCheck.remaining,
      });
    }

    const result = await generateUIAsset(prompt, { context, theme });

    if (result.success) {
      // Track usage
      const usage = usageTracker.track({
        model: 'gemini-2.0-flash-preview-image-generation',
        endpoint: '/api/generate-asset',
        isImage: true,
        prompt,
      });

      // Return base64 image data with usage info
      res.json({
        success: true,
        image: result.base64 || null,
        url: result.url || null,
        mimeType: result.mimeType,
        usage: {
          cost: usage.cost.toFixed(4),
          budgetRemaining: usage.budgetRemaining.toFixed(4),
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (e) {
    console.error("❌ /api/generate-asset error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Generate and save an asset to disk
 * POST /api/generate-asset-file
 * Body: { prompt: string, filename: string, context?: string, theme?: string }
 */
app.post("/api/generate-asset-file", async (req, res) => {
  try {
    const { prompt, filename, context = "general", theme = "dark" } = req.body;

    if (!prompt || !filename) {
      return res.status(400).json({
        error: "Missing required fields: prompt and filename",
      });
    }

    // Ensure safe filename
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const outputPath = path.join(process.cwd(), "generated-assets", safeName);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log("\n🎨 /api/generate-asset-file request received");
    console.log(`   Output: ${outputPath}`);

    const result = await generateUIAsset(prompt, { context, theme, outputPath });

    if (result.success) {
      res.json({
        success: true,
        path: result.path,
        mimeType: result.mimeType,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (e) {
    console.error("❌ /api/generate-asset-file error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * AI-powered CSS suggestions
 * POST /api/suggest-css
 * Body: { element: string, currentCSS: string, systemInstructions?: string, designSystem?: object }
 */
app.post("/api/suggest-css", async (req, res) => {
  try {
    const { element, currentCSS, systemInstructions = '', designSystem } = req.body;

    console.log("\n🤖 /api/suggest-css request received");
    console.log(`   Element: ${element}`);
    if (systemInstructions) {
      console.log(`   System Instructions: ${systemInstructions.substring(0, 50)}...`);
    }

    const prompt = `You are a CSS expert. Improve the following CSS for a ${element} element.

${systemInstructions ? `DESIGN SYSTEM INSTRUCTIONS:\n${systemInstructions}\n\n` : ''}
${designSystem ? `DETECTED PATTERNS:\n- Button padding: ${designSystem.buttonPadding || 'not set'}\n- Border radius: ${designSystem.buttonRadius || 'not set'}\n\n` : ''}
CURRENT CSS:
${currentCSS}

Return ONLY improved CSS (no markdown, no explanation). Keep the same format with property: value; on each line.
Focus on:
- Consistent spacing (use 4px/8px/12px/16px/24px scale)
- Accessible contrast
- Modern, polished appearance
- Matching the design system if provided`;

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
    const result = await model.generateContent(prompt);
    const suggestedCSS = result.response.text().trim();

    res.json({
      success: true,
      css: suggestedCSS
    });

  } catch (e) {
    console.error("❌ /api/suggest-css error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// USAGE TRACKING ROUTES (Marathon Agent - Budget Management)
// ============================================================================

/**
 * Get usage summary
 * GET /api/usage
 */
app.get("/api/usage", (req, res) => {
  try {
    const summary = usageTracker.getSummary();
    res.json({ success: true, ...summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Check budget before a request
 * POST /api/usage/check
 * Body: { estimatedCost?: number }
 */
app.post("/api/usage/check", (req, res) => {
  try {
    const { estimatedCost = 0.01 } = req.body;
    const result = usageTracker.checkBudget(estimatedCost);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Set budget limit
 * POST /api/usage/budget
 * Body: { amount: number }
 */
app.post("/api/usage/budget", (req, res) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: "Invalid budget amount" });
    }
    usageTracker.setBudget(amount);
    res.json({ success: true, newBudget: amount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Reset usage session
 * POST /api/usage/reset
 */
app.post("/api/usage/reset", (req, res) => {
  try {
    usageTracker.resetSession();
    res.json({ success: true, message: "Session reset" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Save generated asset with tracking
 * POST /api/save-asset
 * Body: { image: base64, prompt: string, filename?: string }
 */
app.post("/api/save-asset", async (req, res) => {
  try {
    const { image, prompt, filename } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    // Create assets directory if needed
    const assetsDir = path.join(process.cwd(), 'generated-assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = filename
      ? filename.replace(/[^a-zA-Z0-9.-]/g, '_')
      : `asset-${timestamp}.png`;

    const outputPath = path.join(assetsDir, safeName);

    // Remove base64 prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(outputPath, imageBuffer);

    // Track the asset
    usageTracker.trackAsset({
      filename: safeName,
      prompt: prompt || 'No prompt',
      model: 'gemini-2.0-flash-preview-image-generation',
      path: outputPath,
    });

    console.log(`📁 Asset saved: ${outputPath}`);

    res.json({
      success: true,
      path: outputPath,
      filename: safeName,
      size: imageBuffer.length,
    });
  } catch (e) {
    console.error("❌ /api/save-asset error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * List saved assets
 * GET /api/assets
 */
app.get("/api/assets", (req, res) => {
  try {
    const assetsDir = path.join(process.cwd(), 'generated-assets');

    if (!fs.existsSync(assetsDir)) {
      return res.json({ success: true, assets: [] });
    }

    const files = fs.readdirSync(assetsDir)
      .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
      .map(f => {
        const stats = fs.statSync(path.join(assetsDir, f));
        return {
          filename: f,
          path: path.join(assetsDir, f),
          size: stats.size,
          created: stats.birthtime,
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({ success: true, assets: files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve generated assets
app.use('/assets', express.static(path.join(process.cwd(), 'generated-assets')));

/**
 * Restart server endpoint
 * POST /api/restart
 * Triggers a graceful restart of the server
 */
app.post("/api/restart", (req, res) => {
  console.log("\n🔄 Restart requested from FlowState panel");
  res.json({ success: true, message: "Server restarting..." });

  // Give time for response to be sent, then exit
  // The process manager (or manual restart) will bring it back up
  setTimeout(() => {
    console.log("🔄 Restarting server...");
    process.exit(0);
  }, 500);
});

/**
 * Refresh frontend (clear caches, reload)
 * POST /api/refresh-frontend
 */
app.post("/api/refresh-frontend", (req, res) => {
  console.log("\n🔄 Frontend refresh requested");
  res.json({ success: true, message: "Refresh signal sent" });
});

/**
 * Design Chat - Ask questions about design topics
 * POST /api/chat
 * Body: { message: string, context?: string, history?: Array<{role, content}> }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, context, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("\n💬 /api/chat request");
    console.log(`   Message: ${message.substring(0, 100)}...`);
    console.log(`   Context: ${context || 'none'}`);

    // Build the conversation with system context
    const systemPrompt = `You are a helpful UI/UX design expert assistant integrated into FlowState, a visual design healing tool.
Your role is to help users understand design concepts, CSS properties, accessibility guidelines, and best practices.

Key areas of expertise:
- CSS properties (padding, margin, border-radius, colors, flexbox, grid)
- Accessibility (WCAG guidelines, contrast ratios, touch targets)
- Visual design principles (hierarchy, spacing, typography, color theory)
- Modern web design patterns and trends

Keep responses concise but informative. Use code examples when helpful.
Format responses with markdown for readability.

${context ? `Current context: The user is learning about "${context}".` : ''}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt
    });

    // Build chat history
    const chatHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: chatHistory
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    // Track usage
    if (result.response.usageMetadata) {
      usageTracker.trackRequest('chat', result.response.usageMetadata);
    }

    console.log(`✅ Chat response: ${response.substring(0, 100)}...`);

    res.json({
      success: true,
      response,
      usage: usageTracker.getUsage()
    });

  } catch (e) {
    console.error("❌ /api/chat error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🌊 FlowState Server Running");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   Port: ${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`     POST /api/heal           - Full pipeline (inspect + fix)`);
  console.log(`     POST /api/inspect        - Vision analysis only`);
  console.log(`     POST /api/fix            - Apply fixes to code`);
  console.log(`     POST /api/diff           - Generate diff view`);
  console.log(`     POST /api/generate-asset - Generate image (Nano Banana)`);
  console.log(`     GET  /api/usage          - Usage & budget tracking`);
  console.log(`     POST /api/save-asset     - Save generated asset`);
  console.log(`     GET  /health             - Health check`);
  console.log("");
});

export default app;
