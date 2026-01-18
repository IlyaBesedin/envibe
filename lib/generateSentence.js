import { GoogleGenAI } from "@google/genai";
import { resolveSentenceTopic } from "./sentenceTopics";

export async function generateSentence({ word, dict, level, topic }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY env variable");
  }

  if (!word || !level || !topic) {
    throw new Error("Parameters 'word', 'dict', 'level' and 'topic' are required");
  }

  const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

  const resolvedTopic = resolveSentenceTopic(topic);
  const topicPrompt = resolvedTopic?.prompt;

  if (!topicPrompt) {
    throw new Error("Unable to resolve topic for sentence generation");
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Write one sentence with ${dict} Level ${level} with word '${word}' and in the context of the topic '${topicPrompt}'. The sentence must be natural and concise. Return only the sentence.`,
  });

  // Some SDKs return { text } or { response.text() }. Normalize best-effort.
  const text = response?.text ?? response?.response?.text?.() ?? String(response ?? "");
  return String(text).trim();
}
