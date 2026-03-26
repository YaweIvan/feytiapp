const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Walks the raw string and escapes any bare double-quotes found inside JSON string values
function repairJson(str) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        // peek ahead: if next non-space char is : , } ] then this is a closing quote
        let j = i + 1;
        while (j < str.length && (str[j] === " " || str[j] === "\n" || str[j] === "\r" || str[j] === "\t")) j++;
        const next = str[j];
        if (next === ":" || next === "," || next === "}" || next === "]") {
          inString = false;
          result += ch;
        } else {
          // unescaped quote inside a string value — escape it
          result += '\\"';
        }
      }
      continue;
    }

    // strip real control characters that break JSON
    if (inString && ch.charCodeAt(0) < 32 && ch !== "\t") {
      result += " ";
      continue;
    }

    result += ch;
  }

  return result;
}

function normalizeResult(parsed) {
  return {
    title: typeof parsed?.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Unknown",
    author: typeof parsed?.author === "string" && parsed.author.trim() ? parsed.author.trim() : "Not specified",
    summary: typeof parsed?.summary === "string" ? parsed.summary.trim() : "",
    main_content: Array.isArray(parsed?.main_content)
      ? parsed.main_content
          .map((item) => ({
            section: String(item?.section || "").trim(),
            summary: String(item?.summary || "").trim(),
          }))
          .filter((item) => item.section && item.summary)
      : [],
    key_ideas: Array.isArray(parsed?.key_ideas)
      ? parsed.key_ideas.map((k) => String(k).trim()).filter(Boolean)
      : [],
  };
}

async function analyzeWithGroq(text, customPrompt = "") {
  const trimmedText = text.slice(0, 12000);

  const charCount = trimmedText.length;
  const summaryInstruction = customPrompt.trim()
    ? `Follow this instruction for the summary: "${customPrompt.trim()}"`
    : charCount < 1500
    ? "Write exactly 2 sentences. Be concise and capture only the core purpose and main point."
    : charCount < 4000
    ? "Write exactly 3 sentences. Capture the purpose, main themes, and conclusion. Do not exceed 3 sentences."
    : charCount < 8000
    ? "Write exactly 4 sentences. Cover the purpose, key themes, and main findings. Do not exceed 4 sentences."
    : "Write exactly 5 sentences. Cover the purpose, context, major themes, key findings, and conclusion. Do not exceed 5 sentences.";

  const prompt = `You are a professional document analysis assistant. Produce a thorough, meaningful analysis of the document below.

Tasks:
1. title: The actual document title. If not found, write "Unknown".
2. author: The author name. If not found, write "Not specified".
3. summary: ${summaryInstruction}
4. main_content: Identify every major section or topic. For EACH section, write exactly 1 sentence of 15-20 words that answers what that section says using document-specific details.
5. key_ideas: A list of exactly 4 key ideas or takeaways from the document. Each one must be a single clear sentence.

Rules:
- Do NOT hallucinate. Only use information from the document.
- Do NOT skip or truncate sections.
- Write in clear, professional English.
- Each main content summary must be 15-20 words.
- Do not repeat section names as summaries. Write what the section actually states.
- Include at least one concrete detail from the section when available (for example criteria, amount, rule, timeline, role, or process).
- Do NOT use double quotes inside any string value. Use single quotes or rephrase instead.
- Return ONLY raw JSON — no markdown, no backticks, no extra text.

JSON shape:
{
  "title": "",
  "author": "",
  "summary": "",
  "main_content": [
    { "section": "Section Name", "summary": "Detailed paragraph..." }
  ],
  "key_ideas": ["idea one", "idea two"]
}

Document text:
${trimmedText}`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const raw = response.choices[0].message.content;

  // strip markdown code fences if present
  const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON. Raw: " + raw.slice(0, 300));

  let jsonStr = jsonMatch[0];

  // Robustly fix the JSON string by parsing it character by character
  // to escape any unescaped double quotes inside string values
  jsonStr = repairJson(jsonStr);

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("JSON parse failed: " + e.message + " | snippet: " + jsonStr.slice(2780, 2860));
  }

  return normalizeResult(parsed);
}

module.exports = { analyzeWithGroq };
