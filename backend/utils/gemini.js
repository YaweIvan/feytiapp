const { GoogleGenerativeAI } = require("@google/generative-ai");

async function analyzeWithGemini(text) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in backend/.env");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Use a currently supported fast model.
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Limit text to avoid hitting free tier limits
  const trimmedText = text.slice(0, 8000);

  const prompt = `You are a document analysis assistant. Analyze the document below and return ONLY a valid JSON object with no extra text, no markdown, no backticks. Just the raw JSON.

The JSON must have exactly these fields:
{
  "title": "document title or Unknown",
  "author": "author name or Unknown",  
  "summary": "3-5 sentence summary of the document",
  "mainContent": "5-6 key bullet points from the document using • as bullet symbol",
  "documentType": "type of document e.g. Report, Assignment, Letter, Contract"
}

Document to analyze:
${trimmedText}`;

  let raw = "";
  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (error) {
    if (error?.message?.includes("API_KEY_INVALID")) {
      throw new Error(
        "Gemini API key is invalid. Create a new key in Google AI Studio and set GEMINI_API_KEY in backend/.env"
      );
    }
    if (error?.message?.includes("429 Too Many Requests") || error?.message?.includes("Quota exceeded")) {
      throw new Error(
        "Gemini quota exceeded for this project. Enable billing or use a project with available quota."
      );
    }
    throw error;
  }

  // Safely extract and parse the JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON.");

  return JSON.parse(jsonMatch[0]);
}

module.exports = { analyzeWithGemini };