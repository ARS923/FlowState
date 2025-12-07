import fs from "fs";
import path from "path";
import { createGeminiClient } from "../lib/gemini-client.js";
import { parseSurgeonResponse } from "../lib/safe-parse.js";

// ============================================================================
// THE SURGEON - Code Refactoring Agent
// Uses PTCF Framework (Persona, Task, Context, Format)
// ============================================================================

const SURGEON_PROMPT = `
<persona>
You are the "FlowState Surgeon," a Senior Principal Engineer specializing in React, Tailwind CSS, and modern frontend development. You are famous for "Surgical Refactoring"—fixing visual bugs without breaking existing logic.
</persona>

<task>
You will receive:
1. "CURRENT CODE" — The component file that needs fixing
2. "VISUAL DEFECTS" — A list of specific visual issues identified by QA

Your job is to rewrite the code to resolve ALL the defects while preserving existing functionality.
</task>

<rules>
1. **Do No Harm:** Do not change logic, event handlers, state management, or imports unless necessary for the visual fix.
2. **Style Consistency:** Use the existing styling system. If they use inline styles, use inline styles. If they use Tailwind, use Tailwind. If they use CSS modules, use CSS modules.
3. **Fix Everything:** Address ALL defects in the list, not just some of them.
4. **Maintain Structure:** Keep the same component structure. Don't refactor unrelated code.
5. **No Chatter:** Do not explain your changes. Do not say "Here is the fixed code." Return ONLY the code.
</rules>

<output_format>
Return ONLY the complete, valid, compilable code. No markdown fencing. No preamble. No explanation. Just the code.
</output_format>
`.trim();

/**
 * Apply fixes to a component based on visual defects
 * @param {string} codePath - Path to the component file
 * @param {string[]} defects - Array of defect descriptions from Inspector
 * @returns {Promise<{ success: boolean, code: string, error?: string }>}
 */
export async function operate(codePath, defects) {
  // Validate file exists
  if (!fs.existsSync(codePath)) {
    return {
      success: false,
      error: `File not found: ${codePath}`,
      code: null,
    };
  }

  // Validate defects
  if (!defects || defects.length === 0) {
    return {
      success: false,
      error: "No defects provided",
      code: null,
    };
  }

  // Read the current code
  const currentCode = fs.readFileSync(codePath, "utf8");

  // Create the model
  const model = createGeminiClient("gemini-3-pro-preview", SURGEON_PROMPT);

  // Build the prompt
  const prompt = `
CURRENT CODE:
\`\`\`
${currentCode}
\`\`\`

VISUAL DEFECTS TO FIX:
${defects.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Return the fixed code.
`.trim();

  try {
    console.log("🩺 Surgeon: Applying fixes...");
    console.log(`   Defects to fix: ${defects.length}`);

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const parsed = parseSurgeonResponse(responseText);

    if (parsed.success) {
      console.log("✅ Surgeon: Code patched successfully");
      console.log(`   Output length: ${parsed.code.length} chars`);
    }

    return parsed;
  } catch (e) {
    console.error("❌ Surgeon: API call failed:", e.message);
    return {
      success: false,
      error: e.message,
      code: null,
    };
  }
}

/**
 * Apply fixes and write to a preview file (safer for demos)
 * @param {string} codePath - Path to the component file
 * @param {string[]} defects - Array of defect descriptions
 * @param {string} previewPath - Where to write the preview (optional)
 * @returns {Promise<{ success: boolean, code: string, previewPath: string, error?: string }>}
 */
export async function operateWithPreview(codePath, defects, previewPath = null) {
  const result = await operate(codePath, defects);

  if (!result.success) {
    return result;
  }

  // Generate preview path if not provided
  if (!previewPath) {
    const ext = path.extname(codePath);
    const base = path.basename(codePath, ext);
    const dir = path.dirname(codePath);
    previewPath = path.join(dir, `${base}.flowstate-preview${ext}`);
  }

  // Write to preview file
  fs.writeFileSync(previewPath, result.code);
  console.log(`📝 Preview written to: ${previewPath}`);

  return {
    ...result,
    previewPath,
  };
}

/**
 * Apply fixes directly from code string (for API use)
 * @param {string} code - The component code as a string
 * @param {string[]} defects - Array of defect descriptions
 * @returns {Promise<{ success: boolean, code: string, error?: string }>}
 */
export async function operateOnCode(code, defects) {
  if (!defects || defects.length === 0) {
    return {
      success: false,
      error: "No defects provided",
      code: null,
    };
  }

  const model = createGeminiClient("gemini-3-pro-preview", SURGEON_PROMPT);

  const prompt = `
CURRENT CODE:
\`\`\`
${code}
\`\`\`

VISUAL DEFECTS TO FIX:
${defects.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Return the fixed code.
`.trim();

  try {
    console.log("🩺 Surgeon: Applying fixes...");

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return parseSurgeonResponse(responseText);
  } catch (e) {
    console.error("❌ Surgeon: API call failed:", e.message);
    return {
      success: false,
      error: e.message,
      code: null,
    };
  }
}

// ============================================================================
// STANDALONE TEST RUNNER
// Run with: node agents/surgeon.js <path-to-code> <defects-json-file>
// ============================================================================

const isMainModule = process.argv[1]?.includes("surgeon.js");

if (isMainModule) {
  const codePath = process.argv[2];
  const defectsArg = process.argv[3];

  if (!codePath) {
    console.log("Usage: node agents/surgeon.js <path-to-code> [defects-json-file | inline-json]");
    console.log("");
    console.log("Examples:");
    console.log("  node agents/surgeon.js ./components/Button.tsx ./defects.json");
    console.log('  node agents/surgeon.js ./components/Button.tsx \'["padding too small", "color wrong"]\'');
    process.exit(1);
  }

  // Parse defects - either from file or inline JSON
  let defects;
  try {
    if (defectsArg && fs.existsSync(defectsArg)) {
      const defectsFile = fs.readFileSync(defectsArg, "utf8");
      const parsed = JSON.parse(defectsFile);
      defects = parsed.visual_defects || parsed.defects || parsed;
    } else if (defectsArg) {
      defects = JSON.parse(defectsArg);
    } else {
      // Default test defects
      defects = [
        "Button padding is inconsistent with input fields",
        "Button should span full width of container",
        "Button border-radius should match input border-radius",
      ];
      console.log("⚠️  No defects provided, using test defaults");
    }
  } catch (e) {
    console.error("Failed to parse defects:", e.message);
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🧪 FlowState Surgeon - Standalone Test");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   Code: ${codePath}`);
  console.log(`   Defects: ${defects.length}`);
  console.log("");

  operateWithPreview(codePath, defects).then((result) => {
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📋 RESULT:");
    console.log("═══════════════════════════════════════════════════════════════");

    if (result.success) {
      console.log(`✅ Success! Preview at: ${result.previewPath}`);
      console.log("");
      console.log("--- PATCHED CODE (first 500 chars) ---");
      console.log(result.code.substring(0, 500));
      if (result.code.length > 500) console.log("...[truncated]");
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
  });
}

export default operate;
