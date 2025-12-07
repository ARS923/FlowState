import fs from "fs";
import path from "path";
import { createGeminiClient } from "../lib/gemini-client.js";
import { parseInspectorResponse } from "../lib/safe-parse.js";

// ============================================================================
// THE INSPECTOR - Visual Analysis Agent
// Uses PTCF Framework (Persona, Task, Context, Format)
// ============================================================================

const INSPECTOR_PROMPT = `
<persona>
You are the "FlowState Inspector," a Google-DeepMind-grade Design QA Agent. You possess the visual acuity of a pixel-perfect graphic designer and the logical reasoning of a frontend test engineer.
</persona>

<task>
Analyze the provided UI screenshot. Your job is to identify "Vibe Drifts"—visual regressions where the implementation fails to meet high-quality design standards. You do not fix the code; you only diagnose the patient.
</task>

<context>
The user is a developer working on a React application. They have submitted a screenshot of their UI that may contain visual defects.

IMPORTANT: The screenshot may contain USER ANNOTATIONS in bright lime/yellow color (#D4FF00):
- Freehand circles or scribbles = "Focus on this area"
- Rectangular dashed boxes = "Analyze everything in this region"
- Arrows pointing at elements = "This specific element has an issue"
- Text labels = Direct instructions (e.g., "too small", "wrong color", "align these")

When you see annotations, PRIORITIZE analyzing the annotated areas. The user is telling you exactly where they see problems.

Common defects to look for:
- Misaligned grids or elements (pixels off center, uneven spacing)
- Inconsistent padding/margins between similar elements
- Clashing colors or poor contrast ratios (text hard to read)
- Broken image placeholders (empty gray boxes, missing images)
- Typography hierarchy issues (headings too small, inconsistent fonts)
- Button styling problems (wrong size, color, border-radius)
- Overflow issues (text cut off, elements escaping containers)
- Z-index problems (elements overlapping incorrectly)
</context>

<output_format>
Return ONLY valid JSON. No markdown fencing. No preamble. No explanation.

{
  "looks_good": boolean,
  "visual_defects": [
    {
      "id": "defect-1",
      "element": "button, input, div, h2, img, etc.",
      "element_text": "The visible text inside the element, if any (e.g., 'Sign Up', 'Email')",
      "selector_hint": "CSS selector hint like 'button', 'input[type=email]', 'h2', 'div:has(img)'",
      "issue": "What is wrong (e.g., 'Padding inconsistent with sibling elements')",
      "expected": "What it should be (e.g., '12px 16px padding to match inputs')",
      "why": "Why this matters (e.g., 'Inconsistent spacing breaks visual rhythm')"
    }
  ],
  "needs_asset_generation": boolean,
  "asset_generation_prompt": "string or null"
}

Rules:
- "looks_good": true ONLY if zero defects are found
- "visual_defects": Array of defect objects with full context
- "id": Unique identifier for each defect (defect-1, defect-2, etc.)
- "element": The HTML element type
- "element_text": Any visible text in the element (helps locate it in DOM)
- "selector_hint": A CSS selector that would find this element
- "issue": Specific description of what's wrong
- "expected": What the correct state should be
- "why": Brief explanation of why this is a problem (design principle)
- "needs_asset_generation": true ONLY if you see a placeholder/broken/missing image
- "asset_generation_prompt": Detailed prompt for generating the missing asset, or null
</output_format>
`.trim();

/**
 * Analyze a UI screenshot for visual defects
 * @param {string} imagePath - Path to the screenshot file
 * @returns {Promise<{ success: boolean, data: object, error?: string }>}
 */
export async function inspect(imagePath) {
  // Validate file exists
  if (!fs.existsSync(imagePath)) {
    return {
      success: false,
      error: `File not found: ${imagePath}`,
      data: null,
    };
  }

  // Read and encode the image
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  // Determine mime type from extension
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const mimeType = mimeTypes[ext] || "image/png";

  // Create the model
  const model = createGeminiClient("gemini-3-pro-preview", INSPECTOR_PROMPT);

  try {
    console.log("👁️  Inspector: Analyzing screenshot...");

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      "Analyze this UI screenshot for visual defects.",
    ]);

    const responseText = result.response.text();
    console.log("   Raw response:", responseText.substring(0, 100) + "...");

    const parsed = parseInspectorResponse(responseText);

    if (parsed.success) {
      console.log("✅ Inspector: Analysis complete");
      console.log(`   Looks good: ${parsed.data.looks_good}`);
      console.log(`   Defects found: ${parsed.data.visual_defects.length}`);
    }

    return parsed;
  } catch (e) {
    console.error("❌ Inspector: API call failed:", e.message);
    return {
      success: false,
      error: e.message,
      data: null,
    };
  }
}

/**
 * Analyze a base64-encoded image directly (for API use)
 * @param {string} base64Image - Base64-encoded image data
 * @param {string} mimeType - Image mime type
 * @returns {Promise<{ success: boolean, data: object, error?: string }>}
 */
export async function inspectBase64(base64Image, mimeType = "image/png") {
  const model = createGeminiClient("gemini-3-pro-preview", INSPECTOR_PROMPT);

  try {
    console.log("👁️  Inspector: Analyzing screenshot...");

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      "Analyze this UI screenshot for visual defects.",
    ]);

    const responseText = result.response.text();
    return parseInspectorResponse(responseText);
  } catch (e) {
    console.error("❌ Inspector: API call failed:", e.message);
    return {
      success: false,
      error: e.message,
      data: null,
    };
  }
}

// ============================================================================
// STANDALONE TEST RUNNER
// Run with: node agents/inspector.js <path-to-screenshot>
// ============================================================================

const isMainModule = process.argv[1]?.includes("inspector.js");

if (isMainModule) {
  const testImagePath = process.argv[2];

  if (!testImagePath) {
    console.log("Usage: node agents/inspector.js <path-to-screenshot>");
    console.log("Example: node agents/inspector.js ./test-assets/broken-button.png");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🧪 FlowState Inspector - Standalone Test");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   Image: ${testImagePath}`);
  console.log("");

  inspect(testImagePath).then((result) => {
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📋 FULL RESULT:");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(JSON.stringify(result, null, 2));
  });
}

export default inspect;
