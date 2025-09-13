import { GoogleGenAI } from "@google/genai";

export async function generateSentence({ word, level }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY env variable");
  }

  if (!word || !level) {
    throw new Error("Both 'word' and 'level' are required");
  }

  const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Write one sentence with English Level ${level} with word '${word}'. The sentence must be natural and concise. Return only the sentence.`,
  });

  // Some SDKs return { text } or { response.text() }. Normalize best-effort.
  const text = response?.text ?? response?.response?.text?.() ?? String(response ?? "");
  return String(text).trim();
}
