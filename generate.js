import { generateSentence } from "./lib/generateSentence.js";
import dotenv from "dotenv";

dotenv.config();

// Accept params from CLI: node generate.js "word here" B2
const [, , wordArg, levelArg] = process.argv;
const word = wordArg || process.env.GENERATE_WORD || "Despair";
const level = levelArg || process.env.GENERATE_LEVEL || "B2";

async function main() {
  const sentence = await generateSentence({ word, level });
  // Print JSON for easy parsing
  console.log(JSON.stringify({ word, level, sentence }));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});