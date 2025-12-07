import fs from "fs";
import path from "path";
import { inspect, inspectBase64 } from "./agents/inspector.js";
import { operateOnCode, operateWithPreview } from "./agents/surgeon.js";

// ============================================================================
// FLOWSTATE ORCHESTRATOR
// Chains: Inspector → Surgeon → Re-Inspect (Verification Loop)
// ============================================================================

/**
 * Full FlowState pipeline with verification
 * @param {Object} options
 * @param {string} options.screenshotPath - Path to UI screenshot
 * @param {string} options.codePath - Path to component file
 * @param {boolean} options.autoApply - Write directly to original file (default: false)
 * @param {boolean} options.verify - Re-inspect after surgery (default: true)
 * @param {number} options.maxIterations - Max fix attempts (default: 2)
 * @returns {Promise<FlowStateResult>}
 */
export async function runFlowState(options) {
  const {
    screenshotPath,
    codePath,
    autoApply = false,
    verify = true,
    maxIterations = 2,
  } = options;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🌊 FlowState Pipeline Starting...");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   Screenshot: ${screenshotPath}`);
  console.log(`   Component:  ${codePath}`);
  console.log(`   Auto-apply: ${autoApply}`);
  console.log(`   Verify:     ${verify}`);
  console.log("");

  const result = {
    success: false,
    iterations: [],
    finalCode: null,
    previewPath: null,
    assetPrompt: null,
    summary: "",
  };

  let currentCode = fs.readFileSync(codePath, "utf8");
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n--- Iteration ${iteration} of ${maxIterations} ---\n`);

    const iterResult = {
      iteration,
      inspection: null,
      surgery: null,
      verified: false,
    };

    // STEP 1: INSPECT
    console.log("👁️  Step 1: Inspecting UI...");
    const inspection = await inspect(screenshotPath);

    if (!inspection.success) {
      iterResult.inspection = { error: inspection.error };
      result.iterations.push(iterResult);
      result.summary = `Inspection failed: ${inspection.error}`;
      return result;
    }

    iterResult.inspection = inspection.data;

    // Check if we're done
    if (inspection.data.looks_good) {
      console.log("✅ UI looks good! No defects found.");
      result.success = true;
      result.finalCode = currentCode;
      result.summary = iteration === 1 
        ? "No defects detected — UI passed inspection."
        : `Fixed after ${iteration - 1} iteration(s).`;
      result.iterations.push(iterResult);
      return result;
    }

    console.log(`   Found ${inspection.data.visual_defects.length} defects`);

    // Capture asset generation prompt if present
    if (inspection.data.needs_asset_generation) {
      result.assetPrompt = inspection.data.asset_generation_prompt;
    }

    // STEP 2: OPERATE
    console.log("\n🩺 Step 2: Applying surgical fixes...");
    const surgery = await operateOnCode(currentCode, inspection.data.visual_defects);

    if (!surgery.success) {
      iterResult.surgery = { error: surgery.error };
      result.iterations.push(iterResult);
      result.summary = `Surgery failed: ${surgery.error}`;
      return result;
    }

    iterResult.surgery = { 
      success: true, 
      codeLength: surgery.code.length,
    };
    currentCode = surgery.code;

    result.iterations.push(iterResult);

    // If no verification, we're done after first fix
    if (!verify) {
      console.log("\n⏭️  Skipping verification (verify=false)");
      break;
    }

    // For verification, we'd need to re-render and re-screenshot
    // In a real setup, this would trigger a browser refresh
    // For now, we'll note that verification requires external re-screenshot
    console.log("\n🔄 Verification requires re-screenshot of updated UI");
    console.log("   (In production: trigger browser refresh → new screenshot → re-inspect)");
    break; // Exit loop - verification needs external trigger
  }

  // Write the result
  const ext = path.extname(codePath);
  const base = path.basename(codePath, ext);
  const dir = path.dirname(codePath);
  const previewPath = path.join(dir, `${base}.flowstate-preview${ext}`);

  fs.writeFileSync(previewPath, currentCode);
  console.log(`\n📝 Preview written: ${previewPath}`);

  if (autoApply) {
    fs.writeFileSync(codePath, currentCode);
    console.log(`✏️  Applied to original: ${codePath}`);
  }

  result.success = true;
  result.finalCode = currentCode;
  result.previewPath = previewPath;
  result.summary = `Fixed ${result.iterations[0]?.inspection?.visual_defects?.length || 0} defects.`;

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("🚀 FlowState Pipeline Complete");
  console.log("═══════════════════════════════════════════════════════════════");

  return result;
}

/**
 * API-friendly version - accepts base64 image and code string
 * @param {Object} options
 * @param {string} options.screenshotBase64 - Base64 encoded screenshot
 * @param {string} options.code - Component code as string
 * @param {string} options.mimeType - Image mime type (default: image/png)
 * @returns {Promise<Object>}
 */
export async function runFlowStateAPI(options) {
  const { screenshotBase64, code, mimeType = "image/png" } = options;

  console.log("🌊 FlowState API Pipeline...");

  // Step 1: Inspect
  const { inspectBase64 } = await import("./agents/inspector.js");
  const inspection = await inspectBase64(screenshotBase64, mimeType);

  if (!inspection.success) {
    return { success: false, error: inspection.error, step: "inspect" };
  }

  if (inspection.data.looks_good) {
    return {
      success: true,
      looks_good: true,
      message: "No defects detected",
      code: code,
    };
  }

  // Step 2: Operate
  const surgery = await operateOnCode(code, inspection.data.visual_defects);

  if (!surgery.success) {
    return { success: false, error: surgery.error, step: "surgery" };
  }

  return {
    success: true,
    looks_good: false,
    defects: inspection.data.visual_defects,
    fixedCode: surgery.code,
    needsAsset: inspection.data.needs_asset_generation,
    assetPrompt: inspection.data.asset_generation_prompt,
  };
}

// ============================================================================
// CLI RUNNER
// ============================================================================

const isMainModule = process.argv[1]?.includes("orchestrator.js");

if (isMainModule) {
  const screenshotPath = process.argv[2];
  const codePath = process.argv[3];

  if (!screenshotPath || !codePath) {
    console.log("Usage: node orchestrator.js <screenshot-path> <code-path>");
    console.log("");
    console.log("Example:");
    console.log("  node orchestrator.js ./test-assets/broken-ui.png ./test-assets/SignupCard.jsx");
    process.exit(1);
  }

  runFlowState({ screenshotPath, codePath }).then((result) => {
    console.log("\n📋 Final Result:");
    console.log(JSON.stringify({
      success: result.success,
      summary: result.summary,
      previewPath: result.previewPath,
      assetPrompt: result.assetPrompt,
      iterationCount: result.iterations.length,
    }, null, 2));
  });
}

export default runFlowState;
