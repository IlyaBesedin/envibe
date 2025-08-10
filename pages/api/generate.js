import { generateSentence } from "../../lib/generateSentence";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { word, level } = req.body || {};
    const sentence = await generateSentence({ word, level });
    return res.status(200).json({ sentence });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}


