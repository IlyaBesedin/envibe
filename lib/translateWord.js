import { GoogleGenAI } from "@google/genai";

export async function translateWord({ word, dict, targetLanguageCode }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY env variable");
  }

  const normalizedWord = typeof word === "string" ? word.trim() : "";
  const normalizedDict = typeof dict === "string" ? dict.trim() : "";
  const normalizedTargetLanguageCode = typeof targetLanguageCode === "string" ? targetLanguageCode.trim() : "";

  if (!normalizedWord || !normalizedDict || !normalizedTargetLanguageCode) {
    throw new Error("Parameters 'word', 'dict' and 'targetLanguageCode' are required");
  }

  const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are translating vocabulary for a user dictionary.
Target language code: ${normalizedTargetLanguageCode}.
Dictionary context (\${dict}): ${normalizedDict}.
Input word or short phrase: "${normalizedWord}".

Rules:
1. Return exactly one unambiguous translation option in the target language.
2. Do not return alternatives, synonyms, explanations, comments, or examples.
3. Return only the translated word or phrase as plain text.`,
  });

  const text = response?.text ?? response?.response?.text?.() ?? String(response ?? "");
  const normalizedTranslation = String(text).trim();

  if (!normalizedTranslation) {
    throw new Error("Translation result is empty");
  }

  const singleLineTranslation = normalizedTranslation.split("\n")[0].trim();
  const chars = Array.from(singleLineTranslation);
  if (chars.length === 0) {
    throw new Error("Translation result is empty");
  }

  chars[0] = chars[0].toLocaleUpperCase();
  return chars.join("");
}
