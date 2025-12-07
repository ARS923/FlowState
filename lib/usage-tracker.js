import fs from 'fs';
import path from 'path';

// ============================================================================
// USAGE TRACKER - Token counts, API calls, budget management
// For Hackathon Statement One: Marathon Agent (budget management)
// ============================================================================

const USAGE_FILE = path.join(process.cwd(), 'usage-data.json');
const ASSETS_DIR = path.join(process.cwd(), 'generated-assets');

// Pricing estimates (per 1K tokens/images) - adjust based on actual Gemini pricing
const PRICING = {
  'gemini-3-pro-preview': {
    input: 0.00025,   // per 1K input tokens
    output: 0.0005,   // per 1K output tokens
  },
  'gemini-2.0-flash-preview-image-generation': {
    perImage: 0.02,   // per generated image (estimate)
  },
  'gemini-2.0-flash': {
    input: 0.0001,
    output: 0.0002,
  }
};

// Default budget limit ($)
const DEFAULT_BUDGET = 10.00;

class UsageTracker {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load usage data:', e.message);
    }

    return this.getDefaultData();
  }

  getDefaultData() {
    return {
      session: {
        startTime: new Date().toISOString(),
        budget: DEFAULT_BUDGET,
        budgetUsed: 0,
      },
      totals: {
        apiCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        imagesGenerated: 0,
        estimatedCost: 0,
      },
      byModel: {},
      byEndpoint: {},
      history: [],
      assets: [],
    };
  }

  save() {
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Failed to save usage data:', e.message);
    }
  }

  /**
   * Track an API call
   * @param {Object} params
   * @param {string} params.model - Model name
   * @param {string} params.endpoint - API endpoint
   * @param {number} params.inputTokens - Input token count (estimated)
   * @param {number} params.outputTokens - Output token count (estimated)
   * @param {boolean} params.isImage - Whether this generated an image
   * @param {string} params.prompt - The prompt used (for history)
   */
  track({ model, endpoint, inputTokens = 0, outputTokens = 0, isImage = false, prompt = '' }) {
    const timestamp = new Date().toISOString();

    // Calculate cost
    let cost = 0;
    const pricing = PRICING[model] || PRICING['gemini-2.0-flash'];

    if (isImage) {
      cost = pricing.perImage || 0.02;
      this.data.totals.imagesGenerated++;
    } else {
      cost = (inputTokens / 1000) * (pricing.input || 0.0001) +
             (outputTokens / 1000) * (pricing.output || 0.0002);
    }

    // Update totals
    this.data.totals.apiCalls++;
    this.data.totals.inputTokens += inputTokens;
    this.data.totals.outputTokens += outputTokens;
    this.data.totals.estimatedCost += cost;
    this.data.session.budgetUsed += cost;

    // Update by model
    if (!this.data.byModel[model]) {
      this.data.byModel[model] = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
    this.data.byModel[model].calls++;
    this.data.byModel[model].inputTokens += inputTokens;
    this.data.byModel[model].outputTokens += outputTokens;
    this.data.byModel[model].cost += cost;

    // Update by endpoint
    if (!this.data.byEndpoint[endpoint]) {
      this.data.byEndpoint[endpoint] = { calls: 0, cost: 0 };
    }
    this.data.byEndpoint[endpoint].calls++;
    this.data.byEndpoint[endpoint].cost += cost;

    // Add to history (keep last 100)
    this.data.history.unshift({
      timestamp,
      model,
      endpoint,
      inputTokens,
      outputTokens,
      isImage,
      cost,
      prompt: prompt.substring(0, 100),
    });
    if (this.data.history.length > 100) {
      this.data.history = this.data.history.slice(0, 100);
    }

    this.save();

    return {
      cost,
      budgetRemaining: this.data.session.budget - this.data.session.budgetUsed,
      overBudget: this.data.session.budgetUsed > this.data.session.budget,
    };
  }

  /**
   * Track a saved asset
   */
  trackAsset({ filename, prompt, model, path: assetPath }) {
    this.data.assets.unshift({
      timestamp: new Date().toISOString(),
      filename,
      prompt,
      model,
      path: assetPath,
    });
    this.save();
  }

  /**
   * Get current usage summary
   */
  getSummary() {
    const budgetRemaining = this.data.session.budget - this.data.session.budgetUsed;
    const budgetPercent = (this.data.session.budgetUsed / this.data.session.budget) * 100;

    return {
      session: {
        ...this.data.session,
        budgetRemaining,
        budgetPercent: budgetPercent.toFixed(1),
      },
      totals: {
        ...this.data.totals,
        estimatedCost: this.data.totals.estimatedCost.toFixed(4),
      },
      byModel: this.data.byModel,
      byEndpoint: this.data.byEndpoint,
      recentHistory: this.data.history.slice(0, 10),
      assets: this.data.assets.slice(0, 20),
    };
  }

  /**
   * Check if budget allows for a request
   */
  checkBudget(estimatedCost = 0.01) {
    const remaining = this.data.session.budget - this.data.session.budgetUsed;
    return {
      allowed: remaining >= estimatedCost,
      remaining,
      estimatedCost,
    };
  }

  /**
   * Set budget limit
   */
  setBudget(amount) {
    this.data.session.budget = amount;
    this.save();
  }

  /**
   * Reset session
   */
  resetSession() {
    this.data = this.getDefaultData();
    this.save();
  }

  /**
   * Estimate tokens from text (rough approximation)
   */
  static estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// Singleton instance
const tracker = new UsageTracker();

export default tracker;
export { UsageTracker, PRICING };
