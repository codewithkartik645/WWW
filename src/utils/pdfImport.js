import {
  SEM_START, SEM_END,
} from "../theme";

/* ---------- Academic-calendar PDF import (admin) ---------- */
const MONTH_MAP = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const existing = document.querySelector("script[data-pdfjs]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.pdfjsLib));
      existing.addEventListener("error", () => reject(new Error("Couldn't load the PDF reader.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.dataset.pdfjs = "true";
    script.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      } catch (err) { reject(err); }
    };
    script.onerror = () => reject(new Error("Couldn't load the PDF reader — check your connection."));
    document.head.appendChild(script);
  });
}

async function pdfToLines(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = [];
  const maxPages = Math.min(pdf.numPages, 40);
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const byY = {};
    content.items.forEach((it) => {
      const y = Math.round(it.transform[5] / 2) * 2; // bucket nearby baselines into one line
      const x = it.transform[4];
      (byY[y] = byY[y] || []).push({ x, str: it.str });
    });
    // Sort each line's fragments left-to-right by x-position before joining — pdf.js returns
    // text items in drawing order, not reading order, so multi-column/table layouts (dates in
    // one column, event names in another) were coming out scrambled and failing to match the
    // date regexes below, which made valid text PDFs look like "no dated events found".
    Object.keys(byY).map(Number).sort((a, b) => b - a).forEach((y) => {
      const line = byY[y].sort((a, b) => a.x - b.x).map((f) => f.str).join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
    });
  }
  return lines;
}

function inferYear(month) {
  const startM = SEM_START.getMonth() + 1, startY = SEM_START.getFullYear(), endY = SEM_END.getFullYear();
  return month >= startM ? startY : endY;
}

function findDateInLine(line) {
  let m = line.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) {
    const day = Number(m[1]), month = Number(m[2]);
    let year = Number(m[3]); if (m[3].length === 2) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return { day, month, year, matchStr: m[0] };
  }
  m = line.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s*(\d{4})?\b/i);
  if (m) {
    const day = Number(m[1]), month = MONTH_MAP[m[2].toLowerCase().slice(0, 3)];
    const year = m[3] ? Number(m[3]) : inferYear(month);
    return { day, month, year, matchStr: m[0] };
  }
  m = line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/i);
  if (m) {
    const month = MONTH_MAP[m[1].toLowerCase().slice(0, 3)], day = Number(m[2]);
    const year = m[3] ? Number(m[3]) : inferYear(month);
    return { day, month, year, matchStr: m[0] };
  }
  return null;
}

function classifyEventType(title) {
  const t = title.toLowerCase();
  if (/holiday|vacation|break|festival|jayanti|puja|diwali|deepavali|dussehra|christmas|independence day|republic day|\beid\b|gandhi|nanak|pongal|onam|\bholi\b|raksha bandhan|bhaiya dooj|janmashtami/.test(t)) return "holiday";
  if (/exam|test|sessional|practical|viva|\bst-?1\b|\bst-?2\b|\bput\b/.test(t)) return "exam";
  return "milestone";
}

async function parseCalendarPdf(file) {
  const lines = await pdfToLines(file);
  const seen = new Set();
  const out = [];
  for (const raw of lines) {
    const found = findDateInLine(raw);
    if (!found) continue;
    const { day, month, year, matchStr } = found;
    const test = new Date(year, month - 1, day);
    if (test.getMonth() !== month - 1 || test.getDate() !== day) continue; // e.g. Feb 30 — invalid, skip
    let title = raw.replace(matchStr, " ").replace(/^[\s:\-–—,.|]+|[\s:\-–—,.|]+$/g, "").replace(/\s{2,}/g, " ").trim();
    if (title.length < 3 || /^page\s*\d+/i.test(title)) continue;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const key = `${date}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date, title, type: classifyEventType(title) });
    if (out.length >= 150) break;
  }
  return out;
}

export { parseCalendarPdf, loadPdfJs, classifyEventType, findDateInLine, inferYear };
