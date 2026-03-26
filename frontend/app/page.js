"use client";
import { useState } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export default function Home() {
  const [file, setFile]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [dragOver, setDragOver]         = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const handleFileChange = (e) => { setFile(e.target.files[0]); setResult(null); setError(""); };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setResult(null); setError(""); }
  };

  const handleUpload = async () => {
    if (!file) { setError("Please select a file first."); return; }
    const fd = new FormData();
    fd.append("document", file);
    if (customPrompt.trim()) fd.append("customPrompt", customPrompt.trim());
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/upload`, fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(res.data.analysis);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  const handleReset = () => { setFile(null); setResult(null); setError(""); };

  const mainContent = Array.isArray(result?.main_content) ? result.main_content : [];
  const keyIdeas    = Array.isArray(result?.key_ideas)    ? result.key_ideas    : [];

  const buildExportText = () => {
    if (!result) return "";
    const lines = [
      `TITLE:  ${result.title  || "Not specified"}`,
      `AUTHOR: ${result.author || "Not specified"}`,
      "", "SUMMARY", "─".repeat(50),
      result.summary || "Not available",
      "", "MAIN CONTENT", "─".repeat(50),
    ];
    mainContent.forEach(({ section, summary }, i) => {
      lines.push("", `${i + 1}. ${section}`, summary);
    });
    lines.push("", "KEY IDEAS", "─".repeat(50));
    keyIdeas.forEach((idea, i) => lines.push(`${i + 1}. ${idea}`));
    return lines.join("\n");
  };

  const saveBlob = async (blob, filename, description, ext, mime) => {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description, accept: { [mime]: [ext] } }],
        });
        const w = await handle.createWritable();
        await w.write(blob); await w.close();
      } catch { /* cancelled */ }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadWord = async () => {
    if (!result) return;

    const children = [];

    // Title
    children.push(
      new Paragraph({
        text: result.title || "Untitled",
        heading: HeadingLevel.TITLE,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Author: ", bold: true, size: 24 }),
          new TextRun({ text: result.author || "Not specified", size: 24 }),
        ],
        spacing: { after: 300 },
      })
    );

    // Main Content Summary
    children.push(
      new Paragraph({
        text: "Main Content Summary",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: result.summary || "Not available", size: 22 })],
        spacing: { after: 300 },
      })
    );

    // Main Content sections
    if (mainContent.length > 0) {
      children.push(
        new Paragraph({
          text: "Main Content",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 120 },
        })
      );
      mainContent.forEach(({ section, summary }, i) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${i + 1}. ${section}`, bold: true, size: 23 })],
            spacing: { before: 160, after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: summary, size: 22 })],
            spacing: { after: 160 },
          })
        );
      });
    }

    // Key Ideas
    if (keyIdeas.length > 0) {
      children.push(
        new Paragraph({
          text: "Key Ideas",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 120 },
        })
      );
      keyIdeas.forEach((idea, i) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${i + 1}.  ${idea}`, size: 22 })],
            spacing: { after: 100 },
          })
        );
      });
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size: 22 },
          },
        },
      },
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    saveBlob(blob, "document-summary.docx", "Word Document", ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  };

  const handleDownloadPdf = () => {
    if (!result) return;
    const doc = new jsPDF();
    let y = 20;
    const W = 180;

    const write = (text, size, bold) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(30, 30, 30);
      doc.splitTextToSize(String(text), W).forEach((line) => {
        if (y > 278) { doc.addPage(); y = 20; }
        doc.text(line, 15, y);
        y += size * 0.52;
      });
      y += 2;
    };

    write(result.title || "Untitled", 15, true);
    write(`Author: ${result.author || "Not specified"}`, 11, false);
    y += 4;
    write("SUMMARY", 12, true);
    write(result.summary || "Not available", 10.5, false);
    y += 4;
    write("MAIN CONTENT", 12, true);
    mainContent.forEach(({ section, summary }, i) => {
      y += 3;
      write(`${i + 1}. ${section}`, 11, true);
      write(summary, 10.5, false);
    });
    y += 4;
    write("KEY IDEAS", 12, true);
    keyIdeas.forEach((idea, i) => write(`${i + 1}. ${idea}`, 10.5, false));

    saveBlob(doc.output("blob"), "document-summary.pdf", "PDF Document", ".pdf", "application/pdf");
  };

  /* ── shared text styles ── */
  const label = { fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", marginBottom: "4px" };
  const sectionTitle = { fontSize: "13.5px", fontWeight: 700, color: "#111", marginBottom: "6px" };
  const bodyText = { fontSize: "13.5px", color: "#222", lineHeight: 1.85, margin: 0 };
  const divider = { border: "none", borderTop: "1px solid #e2ecf5", margin: "20px 0" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#daeeff" }}>

      {/* TOPBAR */}
      <header style={{
        background: "#1565c0", height: "48px", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        borderBottom: "1px solid #1255a0",
      }}>
        <div style={{
          width: "26px", height: "26px", borderRadius: "6px", background: "#2196f3",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: "9px",
        }}>SuNo</div>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>SummaryNote</span>
        <span style={{ color: "#90caf9", fontSize: "11px", borderLeft: "1px solid #2d6fad", paddingLeft: "10px" }}>
          AI-powered document analysis
        </span>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", gap: "14px", padding: "14px", overflow: "hidden" }}>

        {/* LEFT PANEL */}
        <aside style={{
          width: "300px", flexShrink: 0, background: "#fff",
          border: "1px solid #c5dff0", borderRadius: "14px",
          padding: "22px 20px", display: "flex", flexDirection: "column",
          gap: "18px", overflowY: "auto",
        }}>
          <div>
            <p style={{ ...label, color: "#2196f3", marginBottom: "4px" }}>Upload Workspace</p>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0a0a0a", marginBottom: "6px" }}>Document Assistant</h2>
            <p style={{ fontSize: "12.5px", color: "#4a5568", lineHeight: 1.6 }}>
              Upload a PDF or DOCX and get a detailed structured summary.
            </p>
          </div>

          {/* drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? "#2196f3" : "#b3d9f5"}`,
              background: dragOver ? "#e3f2fd" : "#f5fbff",
              borderRadius: "10px", padding: "24px 16px",
              textAlign: "center", transition: "all 0.2s", cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
            <p style={{ fontSize: "12px", color: "#4a5568", marginBottom: "12px" }}>Drag &amp; drop PDF or DOCX here</p>
            <input type="file" accept=".pdf,.docx" onChange={handleFileChange}
              style={{ width: "100%", fontSize: "12px", color: "#555" }} />
          </div>

          {file && (
            <div style={{
              background: "#e3f2fd", border: "1px solid #90caf9",
              borderRadius: "8px", padding: "10px 14px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ fontSize: "16px" }}>📎</span>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#1565c0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </span>
            </div>
          )}

          {/* custom prompt */}
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", marginBottom: "6px" }}>Custom Instructions</p>
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="e.g. Give me a 200-word summary focused on technical skills, or explain this document like I am a beginner..."
              rows={4}
              style={{
                width: "100%", fontSize: "12.5px", color: "#222",
                border: "1.5px solid #c5dff0", borderRadius: "8px",
                padding: "10px 12px", resize: "vertical",
                outline: "none", lineHeight: 1.6,
                fontFamily: "inherit", background: "#f5fbff",
                transition: "border 0.18s",
              }}
              onFocus={e => e.target.style.borderColor = "#2196f3"}
              onBlur={e => e.target.style.borderColor = "#c5dff0"}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={handleUpload} disabled={loading}
              style={{
                width: "100%", padding: "12px 20px",
                background: loading ? "#90caf9" : "#64b5f6",
                color: "#0d2a4a", fontWeight: 700, fontSize: "14px",
                border: "none", borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 14px -4px rgba(100,181,246,0.7)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#42a5f5"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#64b5f6"; }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: "15px", height: "15px",
                    border: "2px solid rgba(13,42,74,0.25)", borderTopColor: "#0d2a4a",
                    borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite",
                  }} />
                  Analyzing...
                </>
              ) : "Send to SuNo"}
            </button>

            <button
              onClick={handleReset}
              style={{
                width: "100%", padding: "11px 20px", background: "transparent",
                color: "#4a5568", fontWeight: 600, fontSize: "13px",
                border: "1.5px solid #c5dff0", borderRadius: "8px",
                cursor: "pointer", transition: "all 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#e8f4fd"; e.currentTarget.style.color = "#1565c0"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4a5568"; }}
            >
              Clear
            </button>
          </div>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #feb2b2", borderRadius: "8px", padding: "10px 14px", fontSize: "12.5px", color: "#c53030" }}>
              {error}
            </div>
          )}
        </aside>

        {/* RIGHT PANEL */}
        <main style={{
          flex: 1, background: "#fff", border: "1px solid #c5dff0",
          borderRadius: "14px", display: "flex", flexDirection: "column",
          overflow: "hidden", minWidth: 0,
        }}>
          {/* panel header */}
          <div style={{
            padding: "14px 24px", borderBottom: "1px solid #e2ecf5",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0, background: "#f8fcff", borderRadius: "14px 14px 0 0",
          }}>
            <div>
              <p style={{ ...label, color: "#2196f3", marginBottom: "2px" }}>Output</p>
              <h2 style={{ fontSize: "17px", fontWeight: 800, color: "#0a0a0a" }}>Analysis Summary</h2>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleDownloadWord} disabled={!result}
                style={{
                  padding: "8px 16px", fontSize: "12.5px", fontWeight: 600,
                  background: "#fff", color: "#1565c0", border: "1.5px solid #90caf9",
                  borderRadius: "8px", cursor: result ? "pointer" : "not-allowed",
                  opacity: result ? 1 : 0.4, display: "flex", alignItems: "center", gap: "6px",
                  transition: "all 0.18s",
                }}
                onMouseEnter={e => { if (result) e.currentTarget.style.background = "#e3f2fd"; }}
                onMouseLeave={e => { if (result) e.currentTarget.style.background = "#fff"; }}
              >
                <DownloadIcon /> Word
              </button>
              <button
                onClick={handleDownloadPdf} disabled={!result}
                style={{
                  padding: "8px 16px", fontSize: "12.5px", fontWeight: 600,
                  background: "#2196f3", color: "#fff", border: "none",
                  borderRadius: "8px", cursor: result ? "pointer" : "not-allowed",
                  opacity: result ? 1 : 0.4, display: "flex", alignItems: "center", gap: "6px",
                  boxShadow: result ? "0 4px 12px -4px rgba(33,150,243,0.55)" : "none",
                  transition: "all 0.18s",
                }}
                onMouseEnter={e => { if (result) e.currentTarget.style.background = "#1976d2"; }}
                onMouseLeave={e => { if (result) e.currentTarget.style.background = "#2196f3"; }}
              >
                <DownloadIcon /> PDF
              </button>
            </div>
          </div>

          {/* scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 30px" }}>

            {loading && (
              <div style={{ textAlign: "center", padding: "70px 20px" }}>
                <div style={{
                  width: "44px", height: "44px", margin: "0 auto 16px",
                  border: "3px solid #e3f2fd", borderTopColor: "#2196f3",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }} />
                <p style={{ fontWeight: 700, fontSize: "16px", color: "#0a0a0a" }}>Preparing your summary…</p>
                <p style={{ fontSize: "13px", color: "#4a5568", marginTop: "6px" }}>This may take a few seconds.</p>
              </div>
            )}

            {!loading && !result && (
              <div style={{
                textAlign: "center", padding: "70px 20px",
                border: "2px dashed #c5dff0", borderRadius: "12px", background: "#f8fcff",
              }}>
                <div style={{ fontSize: "52px", marginBottom: "14px" }}>📋</div>
                <p style={{ fontSize: "17px", fontWeight: 800, color: "#0a0a0a", marginBottom: "8px" }}>No summary yet</p>
                <p style={{ fontSize: "13px", color: "#4a5568" }}>
                  Upload a file on the left and click <strong>Summarize Document</strong>.
                </p>
              </div>
            )}

            {result && !loading && (
              <div style={{ maxWidth: "820px" }}>

                {/* TITLE */}
                <div style={{ marginBottom: "6px" }}>
                  <p style={label}>Title</p>
                  <p style={{ fontSize: "20px", fontWeight: 800, color: "#0a0a0a", lineHeight: 1.3 }}>
                    {result.title || "Unknown"}
                  </p>
                </div>

                {/* AUTHOR */}
                <div style={{ marginBottom: "20px" }}>
                  <p style={label}>Author</p>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#333" }}>
                    {result.author || "Not specified"}
                  </p>
                </div>

                <hr style={divider} />

                {/* SUMMARY */}
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ ...label, marginBottom: "10px" }}>Main Content Summary</p>
                  <p style={bodyText}>{result.summary || "Not available"}</p>
                </div>

                {mainContent.length > 0 && <hr style={divider} />}

                {/* MAIN CONTENT */}
                {mainContent.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <p style={{ ...label, marginBottom: "14px" }}>Main Content</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      {mainContent.map(({ section, summary }, i) => (
                        <div key={i}>
                          <p style={sectionTitle}>{i + 1}. {section}</p>
                          <p style={bodyText}>{summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <hr style={divider} />

                {/* KEY IDEAS */}
                <div>
                  <p style={{ ...label, marginBottom: "14px" }}>Key Ideas</p>
                  {keyIdeas.length > 0 ? (
                    <ol style={{ paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "10px", margin: 0 }}>
                      {keyIdeas.map((idea, i) => (
                        <li key={i} style={{ ...bodyText, paddingLeft: "4px" }}>{idea}</li>
                      ))}
                    </ol>
                  ) : (
                    <p style={{ fontSize: "13px", color: "#999" }}>No key ideas found.</p>
                  )}
                </div>

              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
