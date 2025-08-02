import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

const word = "Despair";
const level = "B2";

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Write one sentence with English Level ${level} with word '${word}'`,
  });
  console.log(response.text);
}

main();