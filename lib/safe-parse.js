/**
 * Safely parse Inspector response with validation
 * Handles both legacy string format and new rich object format
 * @param {string} text - Raw response from Gemini
 * @returns {{ success: boolean, data: object, error?: string }}
 */
export function parseInspectorResponse(text) {
  try {
    // Strip markdown fencing if present
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (typeof parsed.looks_good !== "boolean") {
      throw new Error("Missing or invalid 'looks_good' field (expected boolean)");
    }

    if (!Array.isArray(parsed.visual_defects)) {
      throw new Error("Missing or invalid 'visual_defects' field (expected array)");
    }

    if (typeof parsed.needs_asset_generation !== "boolean") {
      throw new Error("Missing or invalid 'needs_asset_generation' field (expected boolean)");
    }

    // Normalize defects to rich format
    const normalizedDefects = parsed.visual_defects.map((defect, index) => {
      // Handle legacy string format
      if (typeof defect === "string") {
        return {
          id: `defect-${index + 1}`,
          element: "unknown",
          element_text: null,
          selector_hint: "*",
          issue: defect,
          expected: null,
          why: null,
        };
      }
      
      // Rich format - ensure all fields exist
      return {
        id: defect.id || `defect-${index + 1}`,
        element: defect.element || "unknown",
        element_text: defect.element_text || null,
        selector_hint: defect.selector_hint || "*",
        issue: defect.issue || defect.description || "Unknown issue",
        expected: defect.expected || null,
        why: defect.why || null,
      };
    });

    return {
      success: true,
      data: {
        looks_good: parsed.looks_good,
        visual_defects: normalizedDefects,
        needs_asset_generation: parsed.needs_asset_generation,
        asset_generation_prompt: parsed.asset_generation_prompt || null,
      },
    };
  } catch (e) {
    console.error("⚠️  Inspector parse error:", e.message);
    console.error("   Raw response:", text.substring(0, 200) + "...");

    return {
      success: false,
      error: e.message,
      data: {
        looks_good: false,
        visual_defects: [{
          id: "defect-parse-error",
          element: "unknown",
          element_text: null,
          selector_hint: "*",
          issue: "⚠️ Parse error — manual review required",
          expected: null,
          why: null,
        }],
        needs_asset_generation: false,
        asset_generation_prompt: null,
      },
    };
  }
}

/**
 * Safely parse Surgeon response (expects raw code)
 * @param {string} text - Raw response from Gemini
 * @returns {{ success: boolean, code: string, error?: string }}
 */
export function parseSurgeonResponse(text) {
  try {
    // Strip markdown code fencing if present
    let code = text.trim();

    // Handle ```jsx, ```tsx, ```javascript, etc.
    const codeBlockMatch = code.match(/```(?:jsx?|tsx?|javascript|typescript)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1].trim();
    }

    // Basic sanity check - should look like code
    if (code.length < 10) {
      throw new Error("Response too short to be valid code");
    }

    return {
      success: true,
      code: code,
    };
  } catch (e) {
    console.error("⚠️  Surgeon parse error:", e.message);

    return {
      success: false,
      error: e.message,
      code: null,
    };
  }
}
