import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Creates a configured Gemini model instance
 * @param {string} modelName - The model to use (e.g., 'gemini-3-pro-preview')
 * @param {string} systemInstruction - The system prompt for this agent
 * @returns {GenerativeModel}
 */
export function createGeminiClient(modelName, systemInstruction = null) {
  const config = { model: modelName };
  
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }
  
  return genAI.getGenerativeModel(config);
}

/**
 * Creates the image generation model (different config, no system instruction)
 * @returns {GenerativeModel}
 */
export function createImageClient() {
  return genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });
}

export { genAI };
