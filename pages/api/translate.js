import { translateWord } from "../../lib/translateWord";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { word, dict, targetLanguageCode } = req.body || {};
    const translation = await translateWord({ word, dict, targetLanguageCode });
    return res.status(200).json({ translation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
