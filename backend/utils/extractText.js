const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

async function extractText(file) {
  const { mimetype, buffer } = file;

  // If it's a PDF
  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  // If it's a Word document
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Unsupported file type.");
}

module.exports = { extractText };