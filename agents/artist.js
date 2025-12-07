import fs from "fs";
import path from "path";
import { createImageClient } from "../lib/gemini-client.js";

// ============================================================================
// THE ARTIST - Image Generation Agent (Nano Banana Pro)
// ============================================================================

/**
 * Generate an asset using Gemini's image generation
 * @param {string} prompt - Description of the asset to generate
 * @param {Object} options
 * @param {string} options.outputPath - Where to save the image (optional)
 * @param {string} options.style - Additional style guidance (optional)
 * @returns {Promise<{ success: boolean, image?: Buffer, path?: string, error?: string }>}
 */
export async function generateAsset(prompt, options = {}) {
  const { outputPath, style } = options;

  // Build the full prompt with style guidance
  const fullPrompt = style 
    ? `${prompt}. Style: ${style}`
    : prompt;

  console.log("🎨 Artist: Generating asset...");
  console.log(`   Prompt: ${fullPrompt.substring(0, 100)}...`);

  const model = createImageClient();

  try {
    const result = await model.generateContent(fullPrompt);

    // Log the response structure for debugging
    console.log("   Response structure:", Object.keys(result.response));

    // Handle different possible response formats
    let imageData = null;
    let mimeType = "image/png";

    // Try to extract image from response
    const candidates = result.response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || mimeType;
          break;
        }
        if (part.fileData) {
          // If it returns a URL, we'd need to fetch it
          console.log("   Image URL:", part.fileData.fileUri);
          return {
            success: true,
            url: part.fileData.fileUri,
            mimeType: part.fileData.mimeType,
          };
        }
      }
    }

    if (!imageData) {
      // Log full response for debugging
      console.log("   Full response:", JSON.stringify(result.response, null, 2).substring(0, 500));
      throw new Error("No image data in response - check response structure");
    }

    const imageBuffer = Buffer.from(imageData, "base64");
    console.log(`✅ Artist: Generated ${imageBuffer.length} bytes`);

    // Save if path provided
    if (outputPath) {
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`📁 Saved to: ${outputPath}`);
      return {
        success: true,
        image: imageBuffer,
        path: outputPath,
        mimeType,
      };
    }

    return {
      success: true,
      image: imageBuffer,
      base64: imageData,
      mimeType,
    };
  } catch (e) {
    console.error("❌ Artist: Generation failed:", e.message);
    return {
      success: false,
      error: e.message,
    };
  }
}

/**
 * Generate a UI asset with automatic sizing/styling for web use
 * @param {string} prompt - Asset description
 * @param {Object} options
 * @param {string} options.context - Where this will be used (e.g., "avatar", "hero", "icon")
 * @param {string} options.theme - Color theme (e.g., "dark", "light")
 * @param {string} options.outputPath - Where to save
 * @returns {Promise<Object>}
 */
export async function generateUIAsset(prompt, options = {}) {
  const { context = "general", theme = "dark", outputPath } = options;

  // Build context-aware prompt with quality and resolution specs
  const contextPrompts = {
    avatar: "circular crop, centered subject, suitable for profile picture, 1:1 aspect ratio",
    icon: "simple, recognizable, works at small sizes, transparent background, 1:1 aspect ratio",
    hero: "16:9 aspect ratio, 4K resolution, ultra high quality, cinematic, wide shot, suitable for header background",
    card: "16:9 aspect ratio, high quality, balanced composition, suitable for card thumbnail",
    general: "16:9 aspect ratio, 4K resolution, ultra high quality, professional, web-ready",
  };

  const themePrompts = {
    dark: "designed for dark UI, high contrast, vibrant colors against dark backgrounds, dramatic lighting",
    light: "designed for light UI, soft colors, works on white backgrounds, bright and airy",
  };

  const enhancedPrompt = `${prompt}. ${contextPrompts[context] || contextPrompts.general}. ${themePrompts[theme] || ""}. 4K, ultra detailed, professional photography quality`;

  return generateAsset(enhancedPrompt, { outputPath });
}

// ============================================================================
// CLI RUNNER
// ============================================================================

const isMainModule = process.argv[1]?.includes("artist.js");

if (isMainModule) {
  const prompt = process.argv[2];
  const outputPath = process.argv[3] || "./generated-asset.png";

  if (!prompt) {
    console.log("Usage: node agents/artist.js <prompt> [output-path]");
    console.log("");
    console.log("Examples:");
    console.log('  node agents/artist.js "cyberpunk city skyline" ./assets/hero.png');
    console.log('  node agents/artist.js "minimalist user avatar, dark theme"');
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🧪 FlowState Artist - Standalone Test");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   Prompt: ${prompt}`);
  console.log(`   Output: ${outputPath}`);
  console.log("");

  generateAsset(prompt, { outputPath }).then((result) => {
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📋 RESULT:");
    console.log("═══════════════════════════════════════════════════════════════");

    if (result.success) {
      console.log(`✅ Success!`);
      if (result.path) console.log(`   Saved to: ${result.path}`);
      if (result.url) console.log(`   URL: ${result.url}`);
      if (result.image) console.log(`   Size: ${result.image.length} bytes`);
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
  });
}

export default generateAsset;
