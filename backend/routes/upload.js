const express = require("express");
const router = express.Router();
const multer = require("multer");
const { extractText } = require("../utils/extractText");
const { analyzeWithGroq } = require("../utils/groq");

// Keep file in memory (no saving to disk needed)
const storage = multer.memoryStorage();

// Only allow PDF and Word files
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word (.docx) files are allowed!"));
    }
  },
});

// This runs when someone uploads a file
router.post("/upload", upload.single("document"), async (req, res) => {
  try {
    // Check a file was actually sent
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // Step 1: Pull text out of the file
    const text = await extractText(req.file);

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from this file." });
    }

    const customPrompt = req.body.customPrompt || "";
    const analysis = await analyzeWithGroq(text, customPrompt);

    // Step 3: Send results back to frontend
    res.json({ success: true, analysis });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message || "Something went wrong." });
  }
});

module.exports = router;