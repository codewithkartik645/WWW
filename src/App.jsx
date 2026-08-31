import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutGrid, CalendarDays, BookOpen, CalendarClock, ListChecks, Users2,
  TrendingUp, FolderOpen, Settings as SettingsIcon, Bell, Plus, Trash2,
  Check, Flame, Trophy, ChevronLeft, ChevronRight, Link as LinkIcon,
  Shield, Wand2, Upload, Search, GraduationCap, Megaphone, ClipboardList,
  Building2, Download, Eye, X, FileText, Image as ImageIcon, Paperclip,
  Award, RefreshCw, LogOut, EyeOff, Pencil, Menu, Activity,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from "recharts";
import { useAuth } from "./lib/useAuth";
import { useClassroomData } from "./lib/useClassroomData";
import { uploadAttachment } from "./lib/uploadAttachment";
import { updateProfile } from "./lib/profileAdmin";
import { supabase } from "./lib/supabaseClient";
import AuthScreen from "./AuthScreen";

/* ---------------------------------------------------------------- */
const C = {
  purple: "#7C3AED", purpleSoft: "#F3EEFE", dark: "#0F172A", darkSoft: "#1E293B",
  green: "#10B981", amber: "#F59E0B", red: "#EF4444", gray: "#E5E7EB",
  text: "#1E293B", sub: "#64748B", border: "#E5E7EB", bg: "#F8F8FB",
};
const uid = () => Math.random().toString(36).slice(2, 10);
// Role now comes from the real `profiles` table (Supabase Auth) instead of a hardcoded
// "admin"/"admin_xxx" key prefix. "admin" role = Director (oversees every department);
// "coadmin" role = a Department HOD. Both count as an admin-tier account.
const isAdminKey = (key, profiles) => {
  const role = profiles?.[key]?.role;
  return role === "admin" || role === "coadmin";
};
const DEFAULT_DEPT_ID = "cse";
const deptName = (data, id) => (data.departments || []).find((dp) => dp.id === id)?.name || "—";
// A co-admin's own department (HOD); null/undefined session (i.e. the Director) means "oversees every department".
const deptOf = (data, key) => data.profiles?.[key]?.departmentId || null;
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtFull = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const daysUntil = (d) => Math.ceil((new Date(d) - new Date(new Date().toDateString())) / 86400000);
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const minToTime = (mins) => { const h = Math.floor(mins / 60) % 24; const m = mins % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; };
const MAX_FILE_BYTES = 1_100_000; // ~1.1MB raw (storage blob is capped at 5MB total)

/* ---------------------------------------------------------------- */
/* Seed data — RKGIT Odd-Sem 2026-27 calendar + AKTU V-sem syllabus  */
/* ---------------------------------------------------------------- */
const ELECTIVE_I_OPTIONS = ["Statistical Computing (BCS051)", "Data Analytics (BCS052)", "Computer Graphics (BCS053)", "Object Oriented System Design with C++ (BCS054)"];
const ELECTIVE_II_OPTIONS = ["Machine Learning Techniques (BCS055)", "Application of Soft Computing (BCS056)", "Image Processing (BCS057)", "Data Warehousing & Data Mining (BCS058)"];
const NON_CREDIT_OPTIONS = ["Constitution of India (BNC501)", "Essence of Indian Traditional Knowledge (BNC502)"];
const u = (id, name) => ({ id, name, done: false });

const INITIAL_COURSES_BASE = [
  { id: "bcs501", code: "BCS501", name: "Database Management System", credits: 4, category: "Core", color: C.purple,
    units: [u("u1", "Intro, DB Architecture & ER Model"), u("u2", "Relational Model & SQL"), u("u3", "Database Design & Normalization"), u("u4", "Transaction Processing & Distributed DB"), u("u5", "Concurrency Control")] },
  { id: "bcs502", code: "BCS502", name: "Web Technology", credits: 4, category: "Core", color: "#2563EB",
    units: [u("u1", "Intro, HTML & XML"), u("u2", "CSS & Responsive Layout"), u("u3", "JavaScript, AJAX & Networking"), u("u4", "EJB, Node.js & MongoDB"), u("u5", "Servlets & JSP")] },
  { id: "bcs503", code: "BCS503", name: "Design and Analysis of Algorithm", credits: 4, category: "Core", color: C.amber,
    units: [u("u1", "Complexity Analysis & Sorting"), u("u2", "Advanced Data Structures"), u("u3", "Divide & Conquer, Greedy"), u("u4", "DP, Backtracking, Branch & Bound"), u("u5", "NP-Completeness & FFT")] },
  { id: "elec1", code: "DE-I", name: "Data Analytics (BCS052)", credits: 3, category: "Elective I", color: "#DB2777", options: ELECTIVE_I_OPTIONS,
    units: [u("u1", "Intro to Data Analytics & Lifecycle"), u("u2", "Regression, Bayesian, Time Series"), u("u3", "Mining Data Streams"), u("u4", "Frequent Itemsets & Clustering"), u("u5", "Hadoop/NoSQL & Visualization")] },
  { id: "elec2", code: "DE-II", name: "Machine Learning Techniques (BCS055)", credits: 3, category: "Elective II", color: C.green,
    units: [u("u1", "Intro to Learning & ML Approaches"), u("u2", "Regression, Bayesian Learning & SVM"), u("u3", "Decision Trees & Instance-Based Learning"), u("u4", "Neural Networks & Deep Learning"), u("u5", "Reinforcement Learning & GAs")] },
  { id: "bcs551", code: "BCS551", name: "DBMS Lab", credits: 1, category: "Lab", color: C.purple,
    units: [u("e1", "ER diagram + basic SQL"), u("e2", "Joins, group functions, subqueries"), u("e3", "Normalization exercises"), u("e4", "Cursors, procedures, functions"), u("e5", "Packages & triggers"), u("e6", "Mini project")] },
  { id: "bcs552", code: "BCS552", name: "Web Technology Lab", credits: 1, category: "Lab", color: "#2563EB",
    units: [u("e1", "Institute website in HTML"), u("e2", "Responsive site with CSS"), u("e3", "JS form validation"), u("e4", "Node.js CLI utility"), u("e5", "MongoDB aggregation script"), u("e6", "Servlet/JSP login flow")] },
  { id: "bcs553", code: "BCS553", name: "DAA Lab", credits: 1, category: "Lab", color: C.amber,
    units: [u("e1", "Search & sorting algorithms"), u("e2", "Knapsack (greedy & DP)"), u("e3", "MST — Kruskal's & Prim's"), u("e4", "Dijkstra's shortest path"), u("e5", "N-Queens (backtracking)"), u("e6", "TSP & Hamiltonian cycles")] },
  { id: "bcs554", code: "BCS554", name: "Mini Project / Internship", credits: 2, category: "Project", color: "#475569",
    units: [u("m1", "Project proposal & scope"), u("m2", "Build & document"), u("m3", "Final assessment")] },
  { id: "bnc", code: "BNC501", name: "Constitution of India", credits: 0, category: "Non-Credit", color: "#92400E", options: NON_CREDIT_OPTIONS,
    units: [u("m1", "Constitution basics, rights & duties"), u("m2", "Union & State Executive"), u("m3", "Legal System"), u("m4", "Elections & Emergency Provisions"), u("m5", "Business Organizations & E-Governance")] },
];
const INITIAL_COURSES = INITIAL_COURSES_BASE.map((c) => ({ ...c, departmentId: DEFAULT_DEPT_ID }));

const INITIAL_CALENDAR = [
  { id: uid(), date: "2026-07-20", title: "Semester commences (W-01)", type: "milestone" },
  { id: uid(), date: "2026-08-15", title: "Independence Day", type: "holiday" },
  { id: uid(), date: "2026-08-21", title: "Sessional Test 1 (ST-1) begins", type: "exam" },
  { id: uid(), date: "2026-08-25", title: "Eid-e-Milad", type: "holiday" },
  { id: uid(), date: "2026-08-28", title: "Raksha Bandhan", type: "holiday" },
  { id: uid(), date: "2026-08-30", title: "ST-1 window ends (approx.)", type: "exam" },
  { id: uid(), date: "2026-09-04", title: "Janmashtami", type: "holiday" },
  { id: uid(), date: "2026-09-30", title: "Sessional Test 2 (ST-2) begins", type: "exam" },
  { id: uid(), date: "2026-10-02", title: "Mahatma Gandhi Jayanti", type: "holiday" },
  { id: uid(), date: "2026-10-06", title: "ST-2 window ends (approx.)", type: "exam" },
  { id: uid(), date: "2026-10-20", title: "Dussehra", type: "holiday" },
  { id: uid(), date: "2026-10-31", title: "Practical Unit Test (PUT) begins", type: "exam" },
  { id: uid(), date: "2026-11-06", title: "PUT window ends (approx.)", type: "exam" },
  { id: uid(), date: "2026-11-08", title: "Diwali (Deepavali)", type: "holiday" },
  { id: uid(), date: "2026-11-09", title: "Govardhan Puja", type: "holiday" },
  { id: uid(), date: "2026-11-11", title: "Bhaiya Dooj", type: "holiday" },
  { id: uid(), date: "2026-11-21", title: "AKTU Theory Exams begin", type: "exam" },
  { id: uid(), date: "2026-11-24", title: "Guru Nanak Jayanti", type: "holiday" },
  { id: uid(), date: "2026-12-20", title: "AKTU Practical Exams begin (approx.)", type: "exam" },
  { id: uid(), date: "2026-12-25", title: "Christmas", type: "holiday" },
  { id: uid(), date: "2026-12-26", title: "AKTU Practical Exams end (approx.)", type: "exam" },
  { id: uid(), date: "2026-12-27", title: "AKTU Theory Exams end (approx.)", type: "exam" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);
const SEM_START = new Date("2026-07-20");
const SEM_END = new Date("2026-12-27");

// This is now only the SEED for the shared `classroom` row the very first time the app runs
// against a brand-new Supabase project (see useClassroomData.js — it seeds automatically if the
// row is empty). Real accounts (profiles, credentials, session) live in Supabase Auth + the
// `profiles` table now, not here.
const DEFAULT_SHARED_DATA = {
  // Director (the original "admin" account) oversees every department; each co-admin
  // is a Department HOD and is tagged with exactly one departmentId (see profiles[key].departmentId).
  departments: [{ id: DEFAULT_DEPT_ID, name: "Computer Science & Engineering" }],
  semester: "V Semester · B.Tech CSE · AKTU (NEP 2020, Odd 2026-27)",
  autoMode: true,
  courses: INITIAL_COURSES,
  calendarEvents: INITIAL_CALENDAR,
  tasks: [],
  studyLogs: [],
  plannerBlocks: [],
  coCurricularCatalog: [],
  enrollments: [],
  resources: [],
  datesheets: [],
  announcements: [
    { id: uid(), title: "Welcome to your Study Tracker", message: "Admin can upload the ST/PUT datesheet and the app will generate a suggested revision timetable automatically.", date: new Date().toISOString().slice(0, 10) },
  ],
  activityLog: [],
  trash: [],
  lastSeenAnnouncements: {},
  plannerHourRanges: {},
};

function logActivity(d, text) {
  const entry = { id: uid(), text, ts: new Date().toISOString(), by: d.session };
  return { ...d, activityLog: [entry, ...d.activityLog].slice(0, 150) };
}

/** Soft-delete: stash a copy of the removed item in trash instead of losing it for good.
 *  `extra` carries enough context (e.g. parent course/enrollment id) to reinsert it correctly on restore. */
function moveToTrash(d, type, item, label, extra = {}) {
  const entry = { id: uid(), type, item, extra, label, deletedAt: new Date().toISOString(), deletedBy: d.session };
  return logActivity({ ...d, trash: [entry, ...(d.trash || [])].slice(0, 300) }, `Deleted: ${label}`);
}

function restoreFromTrash(d, entryId) {
  const entry = (d.trash || []).find((t) => t.id === entryId);
  if (!entry) return d;
  let next = { ...d, trash: d.trash.filter((t) => t.id !== entryId) };
  switch (entry.type) {
    case "calendarEvent": next.calendarEvents = [...next.calendarEvents, entry.item]; break;
    case "course": next.courses = [...next.courses, entry.item]; break;
    case "courseUnit": {
      if (next.courses.some((c) => c.id === entry.extra.courseId)) {
        next.courses = next.courses.map((c) => c.id === entry.extra.courseId ? { ...c, units: [...c.units, entry.item] } : c);
      }
      break;
    }
    case "courseSyllabus": {
      if (entry.item && next.courses.some((c) => c.id === entry.extra.courseId)) {
        next.courses = next.courses.map((c) => c.id === entry.extra.courseId ? { ...c, syllabus: entry.item } : c);
      }
      break;
    }
    case "task": next.tasks = [...next.tasks, entry.item]; break;
    case "plannerBlock": next.plannerBlocks = [...next.plannerBlocks, entry.item]; break;
    case "coCurricularCatalog": next.coCurricularCatalog = [...next.coCurricularCatalog, entry.item]; break;
    case "enrollment": next.enrollments = [...next.enrollments, entry.item]; break;
    case "enrollmentModule": {
      if (next.enrollments.some((e) => e.id === entry.extra.enrollId)) {
        next.enrollments = next.enrollments.map((e) => e.id === entry.extra.enrollId ? { ...e, units: [...e.units, entry.item] } : e);
      }
      break;
    }
    case "resource": next.resources = [...next.resources, entry.item]; break;
    case "datesheet": next.datesheets = [...next.datesheets, entry.item]; break;
    case "announcement": next.announcements = [entry.item, ...next.announcements]; break;
    case "studyLog": next.studyLogs = [...next.studyLogs, entry.item]; break;
    default: break;
  }
  return logActivity(next, `Restored: ${entry.label}`);
}

/** Build a recommended self-study week for the 7 days before an exam date,
 *  prioritizing whichever courses have the lowest syllabus completion. */
function generateRecommendedBlocks(datesheet, courses, existingBlocks) {
  if (!datesheet?.date) return [];
  const examDate = new Date(datesheet.date);
  const pool = (datesheet.courseId ? courses.filter((c) => c.id === datesheet.courseId) : courses.filter((c) => c.category === "Core" || c.category.startsWith("Elective")));
  const ranked = [...pool].sort((a, b) => {
    const pa = a.units.length ? a.units.filter((x) => x.done).length / a.units.length : 0;
    const pb = b.units.length ? b.units.filter((x) => x.done).length / b.units.length : 0;
    return pa - pb;
  });
  if (ranked.length === 0) return [];
  // Candidate 1-hour start slots to try, in order of preference, so overlapping
  // revision weeks (e.g. two exams close together) don't all pile onto 19:00.
  const SLOTS = ["19:00", "20:00", "17:00", "21:00", "16:00", "18:00", "15:00", "22:00"];
  const byDay = {};
  DAYS.forEach((d) => { byDay[d] = existingBlocks.filter((b) => b.day === d); });

  const blocks = [];
  for (let i = 7; i >= 1; i--) {
    const day = new Date(examDate);
    day.setDate(examDate.getDate() - i);
    if (day < new Date(new Date().toDateString())) continue; // don't schedule in the past
    const dayName = DAYS[(day.getDay() + 6) % 7];
    const course = ranked[(7 - i) % ranked.length];
    const dayBlocks = byDay[dayName] || [];

    let start = null, end = null;
    for (const s of SLOTS) {
      const sMin = toMin(s), eMin = sMin + 60;
      const clash = dayBlocks.some((b) => {
        const bs = toMin(b.start), be = toMin(b.end);
        return sMin < be && eMin > bs; // any overlap, regardless of block kind or source exam
      });
      if (!clash) { start = s; end = minToTime(eMin); break; }
    }
    if (!start) continue; // every slot that day is taken — skip rather than double-book

    const newBlock = {
      id: uid(), day: dayName, start, end,
      label: i === 1 ? `${course.code} — full revision` : `${course.code} revision`,
      courseId: course.id, color: course.color, kind: "recommended",
      sourceId: datesheet.id, examDate: datesheet.date,
    };
    blocks.push(newBlock);
    byDay[dayName] = [...dayBlocks, newBlock]; // account for it in later iterations too
  }
  return blocks;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function fileToResizedPhoto(file, size = 200) {
  return new Promise((resolve, reject) => {
    fileToDataUrl(file).then((dataUrl) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = dataUrl;
    }).catch(reject);
  });
}

function fileKindIcon(type = "") {
  if (type.includes("pdf")) return FileText;
  if (type.includes("presentation") || type.includes("powerpoint")) return ClipboardList;
  if (type.includes("image")) return ImageIcon;
  return Paperclip;
}

// `window.open()` to a blob:/data: URL gets silently swallowed in a lot of embedded/sandboxed
// contexts (no popup, no error) — that's why "View" on a PDF or image used to just do nothing.
// Instead we preview the file *inside* the app in a modal (an <img> or <iframe> pointed at the
// data URL always renders, since it's not a popup/navigation), and only fall back to opening a
// new tab as a last resort (e.g. if for some reason no preview host is mounted).
let _showAttachmentPreview = null;
function registerAttachmentPreview(fn) { _showAttachmentPreview = fn; }
function openAttachment(dataUrl, fileName, fileType) {
  if (!dataUrl) return;
  if (_showAttachmentPreview) { _showAttachmentPreview({ dataUrl, fileName, fileType }); return; }
  try {
    const [header, base64] = dataUrl.split(",");
    const mime = (header.match(/data:(.*?);base64/) || [])[1] || "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    window.open(blobUrl, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (e) {
    window.open(dataUrl, "_blank", "noopener");
  }
}

// Mounted once at the app root; shows whatever openAttachment() was last called with.
function AttachmentPreviewModal() {
  const [item, setItem] = useState(null); // { dataUrl, fileName, fileType }
  useEffect(() => { registerAttachmentPreview(setItem); return () => registerAttachmentPreview(null); }, []);
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => { if (e.key === "Escape") setItem(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item]);
  if (!item) return null;
  const mimeFromUrl = (item.dataUrl.match(/^data:(.*?);base64/) || [])[1] || "";
  const type = item.fileType || mimeFromUrl;
  const isImage = type.includes("image");
  const isPdf = type.includes("pdf");
  const close = () => setItem(null);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.7)" }} onClick={close}>
      {/* Fixed to the viewport corner (not the card), so it's always visible and clickable even
          if the card's own header gets squeezed by an unusual iframe/viewport height. */}
      <button
        onClick={close}
        title="Close"
        aria-label="Close preview"
        className="fixed top-4 right-4 z-[61] w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-[#1E293B] hover:bg-[#F1F0F5] border border-[#E5E7EB]"
      >
        <X size={20} />
      </button>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] min-h-[50vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {React.createElement(fileKindIcon(type), { size: 15, style: { color: C.purple }, className: "flex-shrink-0" })}
            <span className="text-sm font-medium truncate">{item.fileName || "Attachment"}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <a href={item.dataUrl} download={item.fileName || "attachment"} title="Download" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8F8FB]"><Download size={15} /></a>
            <button onClick={close} title="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F8F8FB]"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-[#F8F8FB] flex items-center justify-center overflow-auto">
          {isImage ? (
            <img src={item.dataUrl} alt={item.fileName || "attachment"} className="max-w-full max-h-full object-contain" />
          ) : isPdf ? (
            <iframe src={item.dataUrl} title={item.fileName || "attachment"} className="w-full h-full border-0" />
          ) : (
            <div className="text-center p-8">
              <div className="text-sm text-[#64748B] mb-3">This file type can't be previewed here.</div>
              <a href={item.dataUrl} download={item.fileName || "attachment"} className="text-sm text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: C.purple }}><Download size={13} /> Download instead</a>
            </div>
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-[#E5E7EB] flex-shrink-0 flex justify-end">
          <button onClick={close} className="text-sm font-medium px-4 py-1.5 rounded-lg text-white" style={{ background: C.purple }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// A "View" button that previews the attachment (new tab) without ever triggering a save-to-disk,
// paired with an explicit "Download" link that always downloads. Handles both data: URLs (uploaded
// files) and plain http(s) links (e.g. a pasted Google Drive URL) sensibly.
function AttachmentActions({ dataUrl, url, fileName, iconOnly = false }) {
  const isRemote = !dataUrl && !!url;
  return (
    <span className="inline-flex items-center gap-2 flex-shrink-0">
      <button
        type="button"
        onClick={() => (isRemote ? window.open(url, "_blank", "noopener") : openAttachment(dataUrl, fileName))}
        title="View"
        className={iconOnly ? "text-[#94A3B8] hover:text-[#1E293B]" : "inline-flex items-center gap-1 text-xs font-medium hover:underline"}
        style={iconOnly ? {} : { color: C.purple }}
      >
        <Eye size={iconOnly ? 13 : 12} />{!iconOnly && " View"}
      </button>
      {dataUrl && (
        <a href={dataUrl} download={fileName} title="Download" className="text-[#94A3B8] hover:text-[#1E293B]">
          <Download size={iconOnly ? 13 : 12} />
        </a>
      )}
    </span>
  );
}

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

/* ---------------------------------------------------------------- */

// Works with Claude.ai's artifact storage (window.storage) when present, and
// safely falls back to localStorage when it isn't (e.g. running this file in
// your own dev environment). Guards against window.storage.* throwing
// synchronously, which previously crashed the app right after login.
//
// IMPORTANT: uses shared storage. This app is a single shared classroom, not one
// account per person — an admin publishing an announcement (or anything else) needs
// every student, on their own device/login, to see it. Anthropic's artifact storage
// defaults to *private* (per-person) unless you explicitly ask for shared, which was
// the real reason a student's bell never lit up for something an admin just posted:
// admin and student were quietly writing to two separate, invisible-to-each-other
// data blobs. With shared storage everyone using this artifact reads/writes the same
// data. That also means anyone with the link can see the underlying data (the on-screen
// admin/student login is a UI convenience, not real server-side auth) — don't use this
// for anything genuinely sensitive.

/* ---------------------------------------------------------------- */

const NAV_STUDENT = [
  { section: "MAIN", items: [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "calendar", label: "Academic Calendar", icon: CalendarDays },
    { id: "planner", label: "Study Planner", icon: CalendarClock },
    { id: "selfstudy", label: "Self Study", icon: Award },
    { id: "classes-view", label: "College Classes", icon: Building2 },
    { id: "courses", label: "Subjects · Unit Wise", icon: BookOpen },
    { id: "tasks", label: "Tasks & Deadlines", icon: ListChecks },
    { id: "cocurricular", label: "Co-curricular", icon: Users2 },
    { id: "exams", label: "Exams & Timetable", icon: ClipboardList },
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "progress", label: "Progress", icon: TrendingUp },
  ]},
  { section: "SYSTEM", items: [
    { id: "resources", label: "Resources", icon: FolderOpen },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ]},
];
const NAV_ADMIN = [
  { section: "MAIN", items: [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "calendar", label: "Academic Calendar", icon: CalendarDays },
    { id: "datesheet", label: "Datesheet (ST / PUT)", icon: Upload },
    { id: "timetables", label: "Timetable (Auto)", icon: Wand2 },
    { id: "subjects", label: "Subjects · Unit Wise", icon: BookOpen },
    { id: "classes", label: "College Classes", icon: Building2 },
    { id: "tasks", label: "Tasks & Deadlines", icon: ListChecks },
    { id: "cocurricular", label: "Co-curricular", icon: Users2 },
    { id: "announcements", label: "Announcements", icon: Megaphone },
  ]},
  { section: "OVERSIGHT", items: [
    { id: "team-activity", label: "Activity & Work", icon: Activity },
  ]},
  { section: "PEOPLE", items: [
    { id: "students", label: "Manage Students", icon: GraduationCap },
    { id: "coadmins", label: "Co-Admins", icon: Shield },
  ]},
  { section: "SYSTEM", items: [
    { id: "resources", label: "Resources", icon: FolderOpen },
    { id: "trash", label: "Restore Deleted Items", icon: Trash2 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ]},
];
const flatNav = (sections) => sections.flatMap((s) => s.items);

export default function App() {
  const { session, profile, loaded: authLoaded, signOut } = useAuth();
  const { data: classroomData, setData, loaded: dataLoaded } = useClassroomData(profile, session?.user?.id ?? null);
  const [tab, setTab] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [viewStudentKey, setViewStudentKey] = useState(null); // which student the admin drilled into, for the detail page
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  // Whenever the active session changes (login/logout), land back on the dashboard. Without
  // this, a stale tab id from the previous session could stay selected — e.g. an admin-only
  // editor tab — showing either a blank page or admin-only content to the wrong session.
  useEffect(() => { setTab("dashboard"); }, [session?.user?.id]);

  const data = classroomData ? {
    ...classroomData,
    // Guard against a race: right after signup, the broader `profiles` dict (populated from a
    // one-time fetch + Realtime INSERT events) might not yet contain THIS user's own row —
    // Realtime hasn't delivered the event yet. Always trust useAuth's own profile fetch for
    // "myself" so the sidebar/settings never crash waiting for that event to arrive.
    profiles: {
      ...classroomData.profiles,
      [session?.user?.id]: {
        name: profile?.name, role: profile?.role, departmentId: profile?.department_id,
        photo: profile?.photo_url, email: profile?.email, active: profile?.active,
      },
    },
  } : null;

  // Auto mode: generate any datesheet's timetable that has entered its 7-day window and isn't generated yet.
  useEffect(() => {
    if (!data || !data.autoMode) return;
    const due = data.datesheets.filter((ds) => {
      const dl = daysUntil(ds.date);
      const already = data.plannerBlocks.some((b) => b.sourceId === ds.id);
      return dl >= 0 && dl <= 7 && !already;
    });
    if (due.length === 0) return;
    setData((d) => {
      let next = d;
      due.forEach((ds) => {
        const blocks = generateRecommendedBlocks(ds, next.courses, next.plannerBlocks);
        next = logActivity({ ...next, plannerBlocks: [...next.plannerBlocks, ...blocks] }, `Timetable auto-generated for ${ds.title} (1 week before exam)`);
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.session]);

  // Mark announcements as "seen" whenever the Announcements tab is actually open — regardless of
  // whether the person got there via the bell icon, the sidebar, or a dashboard link. Previously
  // only the bell's own click handler cleared the badge, so reaching the page any other way left
  // the unread count stuck (and made the bell look broken).
  useEffect(() => {
    if (!data || !data.session || tab !== "announcements") return;
    const count = data.announcements.length;
    const seen = data.lastSeenAnnouncements?.[data.session] || 0;
    if (seen !== count) {
      setData((d) => ({ ...d, lastSeenAnnouncements: { ...d.lastSeenAnnouncements, [d.session]: d.announcements.length } }));
    }
  }, [tab, data?.session, data?.announcements?.length]);

  if (!authLoaded) {
    return <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen flex items-center justify-center bg-[#F8F8FB] text-[#7C3AED]">Loading your tracker…</div>;
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  if (!dataLoaded || !data) {
    return <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen flex items-center justify-center bg-[#F8F8FB] text-[#7C3AED]">Loading your classroom…</div>;
  }

  // First-ever load against a brand-new Supabase project: the `classroom` row starts as `{}`.
  // Seed it once with sensible defaults so the app isn't a blank shell.
  if (!data.departments) {
    setData(DEFAULT_SHARED_DATA);
    return <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen flex items-center justify-center bg-[#F8F8FB] text-[#7C3AED]">Setting up your classroom…</div>;
  }

  const isAdmin = isAdminKey(data.session, data.profiles);
  const isSuperAdmin = data.profiles[data.session]?.role === "admin"; // only the original admin account manages co-admins
  // Restore Deleted Items can bring back removed co-admin/admin accounts and every user's
  // deleted data, so — like Co-Admins — it's reserved for the original admin, not any co-admin.
  const NAV_SECTIONS = isAdmin
    ? NAV_ADMIN.map((s) => ({ ...s, items: s.items.filter((it) => (it.id !== "coadmins" && it.id !== "trash") || isSuperAdmin) }))
    : NAV_STUDENT;
  const goTo = (id) => { setTab(id); setQuery(""); setMobileNavOpen(false); };
  const logout = () => setConfirmLogoutOpen(true);
  const doLogout = () => { setConfirmLogoutOpen(false); signOut(); };

  return (
    <div className="min-h-screen bg-[#F8F8FB] text-[#1E293B]" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        .font-h { font-family: 'Poppins', sans-serif; }
        .card { background: white; border: 1px solid ${C.border}; border-radius: 14px; }
      `}</style>
      <AttachmentPreviewModal />
      <ConfirmModal
        open={confirmLogoutOpen}
        title="Log out?"
        message="You'll need to sign in again to get back to your dashboard."
        confirmLabel="Log out"
        danger={false}
        icon={LogOut}
        onConfirm={doLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />

      <div className="flex">
        <aside className={`hidden lg:flex lg:flex-col w-64 min-h-screen flex-shrink-0 ${isAdmin ? "text-white" : "bg-white border-r border-[#E5E7EB]"}`} style={isAdmin ? { background: C.dark } : {}}>
          <SidebarContent data={data} isAdmin={isAdmin} tab={tab} goTo={goTo} logout={logout} navSections={NAV_SECTIONS} />
        </aside>

        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
            <aside
              className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col shadow-2xl ${isAdmin ? "text-white" : "bg-white"}`}
              style={isAdmin ? { background: C.dark } : {}}
            >
              <button onClick={() => setMobileNavOpen(false)} className={`self-end m-3 mb-0 w-8 h-8 rounded-lg flex items-center justify-center ${isAdmin ? "text-[#CBD5E1] hover:bg-[#1E293B]" : "text-[#64748B] hover:bg-[#F8F8FB]"}`}>
                <X size={18} />
              </button>
              <SidebarContent data={data} isAdmin={isAdmin} tab={tab} goTo={goTo} logout={logout} navSections={NAV_SECTIONS} />
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 lg:pb-8 max-w-7xl">
          <TopBar data={data} setData={setData} tab={tab} isAdmin={isAdmin} query={query} setQuery={setQuery} goTo={goTo} navSections={NAV_SECTIONS} logout={logout} onOpenNav={() => setMobileNavOpen(true)} />
          {tab === "dashboard" && (isAdmin ? <AdminDashboard data={data} setData={setData} goTo={goTo} /> : <StudentDashboard data={data} setData={setData} goTo={goTo} />)}
          {tab === "calendar" && <CalendarView data={data} setData={setData} editable={isAdmin} />}
          {tab === "courses" && <CoursesView data={data} setData={setData} editable={false} />}
          {tab === "subjects" && <CoursesView data={data} setData={setData} editable={true} />}
          {tab === "planner" && <PlannerView data={data} setData={setData} role="student" defaultFilter="all" />}
          {tab === "selfstudy" && <PlannerView data={data} setData={setData} role="student" defaultFilter="self" lockFilter />}
          {tab === "classes-view" && <PlannerView data={data} setData={setData} role="student" defaultFilter="class" lockFilter />}
          {tab === "classes" && <PlannerView data={data} setData={setData} role="admin" />}
          {tab === "tasks" && <TasksView data={data} setData={setData} editable={isAdmin} />}
          {tab === "cocurricular" && (isAdmin ? <AdminCoCurricularView data={data} setData={setData} /> : <StudentCoCurricularView data={data} setData={setData} />)}
          {tab === "students" && isAdmin && <AdminStudentsView data={data} setData={setData} onViewStudent={(key) => { setViewStudentKey(key); goTo("student-detail"); }} />}
          {tab === "team-activity" && isAdmin && <TeamActivityView data={data} setData={setData} onViewStudent={(key) => { setViewStudentKey(key); goTo("student-detail"); }} goTo={goTo} />}
          {tab === "coadmins" && isAdmin && <CoAdminsView data={data} setData={setData} goTo={goTo} />}
          {tab === "student-detail" && isAdmin && <AdminStudentDetailView data={data} setData={setData} studentKey={viewStudentKey} goTo={goTo} />}
          {tab === "trash" && isSuperAdmin && <TrashView data={data} setData={setData} />}
          {tab === "datesheet" && <DatesheetView data={data} setData={setData} />}
          {tab === "timetables" && <TimetablesView data={data} setData={setData} />}
          {tab === "exams" && <ExamsView data={data} setData={setData} />}
          {tab === "announcements" && <AnnouncementsView data={data} setData={setData} isAdmin={isAdmin} goTo={goTo} />}
          {tab === "progress" && <ProgressView data={data} setData={setData} isAdmin={isAdmin} />}
          {tab === "resources" && <ResourcesView data={data} setData={setData} />}
          {tab === "settings" && <SettingsView data={data} setData={setData} goTo={goTo} />}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ data, isAdmin, tab, goTo, logout, navSections }) {
  return (
    <>
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: C.purple }}><GraduationCap size={18} /></div>
        <div>
          <div className="font-h font-semibold text-[15px] leading-tight">StudyTrack</div>
          <div className="text-[11px] text-[#94A3B8]">{isAdmin ? "Admin Panel" : "Plan · Track · Succeed"}</div>
        </div>
      </div>
      <nav className="px-3 flex-1 space-y-1 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.section} className="mb-3">
            <div className={`text-[10px] font-semibold tracking-wide px-3 mb-1 ${isAdmin ? "text-[#64748B]" : "text-[#94A3B8]"}`}>{section.section}</div>
            {section.items.map((t) => {
              const Icon = t.icon; const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => goTo(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? "font-semibold" : isAdmin ? "text-[#CBD5E1] hover:bg-[#1E293B]" : "text-[#64748B] hover:bg-[#F8F8FB]"}`}
                  style={active ? (isAdmin ? { background: C.purple, color: "white" } : { background: C.purpleSoft, color: C.purple }) : {}}>
                  <Icon size={17} /> {t.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={`m-3 rounded-xl p-3 ${isAdmin ? "bg-[#1E293B]" : "bg-[#F8F8FB]"}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden" style={{ background: C.purple }}>
            {data.profiles[data.session].photo
              ? <img src={data.profiles[data.session].photo} alt="" className="w-full h-full object-cover" />
              : (data.profiles[data.session].name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{data.profiles[data.session].name}</div>
            <div className="text-[11px] text-[#94A3B8]">
              {data.profiles[data.session]?.role === "admin" ? "Super Admin" : isAdmin ? "Admin" : (data.departments.length > 1 ? `Student · ${deptName(data, data.profiles[data.session]?.departmentId || data.departments[0]?.id)}` : "Student")}
            </div>
          </div>
        </div>
        <button onClick={logout} className={`w-full text-xs py-1.5 rounded-lg ${isAdmin ? "bg-[#334155] text-[#E2E8F0]" : "bg-white border border-[#E5E7EB] text-[#64748B]"}`}>Log out</button>
      </div>
    </>
  );
}

/* ---------------------------- Shared bits ---------------------------- */

function Card({ children, className = "", style = {} }) { return <div className={`card p-5 ${className}`} style={style}>{children}</div>; }

/** Styled confirmation dialog, used instead of the browser's native confirm() popup. */
function ConfirmModal({ open, title, message, confirmLabel = "Remove", cancelLabel = "Cancel", danger = true, icon: Icon = Trash2, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: danger ? "#FEE2E2" : C.purpleSoft }}>
            <Icon size={15} color={danger ? C.red : C.purple} />
          </div>
          <div className="text-sm font-semibold" style={{ color: "#1E293B" }}>{title}</div>
        </div>
        <p className="text-xs leading-relaxed mb-4" style={{ color: "#64748B" }}>{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB]" style={{ color: "#1E293B" }}>{cancelLabel}</button>
          <button onClick={onConfirm} className="text-sm px-3 py-1.5 rounded-lg text-white" style={{ background: danger ? C.red : C.purple }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** Reusable "are you sure?" flow for any delete button — renders a ConfirmModal and
 *  runs the given action only once confirmed. Deleted items are recoverable from Trash,
 *  so the modal copy reflects that instead of implying the action is permanent. */
function useDeleteConfirm() {
  const [pending, setPending] = useState(null); // { label, onConfirm }
  const requestDelete = (label, onConfirm) => setPending({ label, onConfirm });
  const modal = (
    <ConfirmModal
      open={!!pending}
      title="Delete this item?"
      message={pending ? `${pending.label} will be removed. You can restore it later from Trash if this was a mistake.` : ""}
      confirmLabel="Delete"
      onConfirm={() => { pending.onConfirm(); setPending(null); }}
      onCancel={() => setPending(null)}
    />
  );
  return [requestDelete, modal];
}

function PasswordInput({ className = "", style = {}, iconColor, wrapperClassName = "relative", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className={wrapperClassName}>
      <input
        {...props}
        type={show ? "text" : "password"}
        className={`${className} pr-9`}
        style={style}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
        style={{ color: iconColor || "#94A3B8" }}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
function Badge({ children, color }) { return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ background: color }}>{children}</span>; }
function TypeBadge({ type }) { const map = { exam: C.dark, holiday: C.green, milestone: C.purple }; return <Badge color={map[type] || "#94A3B8"}>{type}</Badge>; }

function TopBar({ data, setData, tab, isAdmin, query, setQuery, goTo, navSections, logout, onOpenNav }) {
  const label = tab === "student-detail" ? "Student Profile" : (flatNav(navSections).find((n) => n.id === tab)?.label || "");
  const [showPanel, setShowPanel] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out = [];
    data.courses.forEach((c) => c.name.toLowerCase().includes(q) && out.push({ label: c.name, sub: c.code, go: isAdmin ? "subjects" : "courses" }));
    data.tasks.forEach((t) => t.title.toLowerCase().includes(q) && out.push({ label: t.title, sub: "Task", go: "tasks" }));
    data.calendarEvents.forEach((e) => e.title.toLowerCase().includes(q) && out.push({ label: e.title, sub: fmt(e.date), go: "calendar" }));
    return out.slice(0, 6);
  }, [query, data, isAdmin]);

  const lastSeenCount = data.lastSeenAnnouncements?.[data.session] || 0;
  const unread = Math.max(0, data.announcements.length - lastSeenCount);
  const markSeen = () => setData((d) => ({ ...d, lastSeenAnnouncements: { ...d.lastSeenAnnouncements, [d.session]: d.announcements.length } }));
  const toggleAnnouncements = () => {
    setShowPanel((s) => {
      const next = !s;
      if (next) markSeen(); // opening the popup is what counts as "seen" — the badge clears right away
      return next;
    });
  };
  const recent = data.announcements.slice(0, 5);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onOpenNav} className="lg:hidden flex-shrink-0 w-9 h-9 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center text-[#64748B]">
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="font-h text-xl font-semibold truncate">{tab === "dashboard" ? `Welcome back, ${data.profiles[data.session].name}!` : label} {tab === "dashboard" && "👋"}</h1>
            {tab === "dashboard" && <p className="text-sm text-[#64748B] mt-0.5">{isAdmin ? "Here's an overview of academic and student activity." : "Here's what's happening with your studies today."}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:block relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subjects, tasks, events…" className="border border-[#E5E7EB] rounded-lg pl-8 pr-3 py-2 text-sm w-64 bg-white" />
            {results.length > 0 && (
              <div className="absolute mt-1 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-30 overflow-hidden">
                {results.map((r, i) => (
                  <button key={i} onClick={() => { goTo(r.go); setQuery(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8F8FB] flex justify-between">
                    <span>{r.label}</span><span className="text-[#94A3B8] text-xs">{r.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <button onClick={toggleAnnouncements} title="Announcements" className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#64748B] bg-white border border-[#E5E7EB] hover:bg-[#F8F8FB]">
              <Bell size={16} />
              {unread > 0 && <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center leading-none">{unread > 9 ? "9+" : unread}</span>}
            </button>
            {showPanel && (
              <>
                {/* Invisible full-screen catcher so clicking anywhere outside the popup closes it. */}
                <div className="fixed inset-0 z-30" onClick={() => setShowPanel(false)} />
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-40 overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F1F0F5]">
                    <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#1E293B" }}><Megaphone size={14} style={{ color: C.purple }} /> Announcements</div>
                    <button onClick={() => setShowPanel(false)} title="Close" className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:bg-[#F8F8FB] hover:text-[#1E293B]"><X size={14} /></button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#F1F0F5]">
                    {recent.length === 0 && <div className="px-3.5 py-4 text-sm text-[#94A3B8]">No announcements yet.</div>}
                    {recent.map((a) => (
                      <div key={a.id} className="px-3.5 py-2.5">
                        <div className="text-sm font-medium" style={{ color: "#1E293B" }}>{a.title}</div>
                        {a.message && <div className="text-xs text-[#64748B] mt-0.5">{a.message}</div>}
                        {a.dataUrl && (
                          <button type="button" onClick={() => openAttachment(a.dataUrl, a.fileName, a.fileType)} className="inline-flex items-center gap-1 text-xs font-medium mt-1" style={{ color: C.purple }}>
                            {React.createElement(fileKindIcon(a.fileType || ""), { size: 12 })} {a.fileName}
                          </button>
                        )}
                        <div className="text-[10px] text-[#94A3B8] mt-1">{fmt(a.date)}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setShowPanel(false); goTo("announcements"); }} className="w-full text-center text-xs font-medium py-2.5 border-t border-[#F1F0F5] hover:bg-[#F8F8FB]" style={{ color: C.purple }}>
                    View all announcements
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8F8FB] flex-shrink-0"
          >
            <LogOut size={14} /> <span className="hidden xs:inline">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================= STUDENT ============================= */

function StudentDashboard({ data, setData, goTo }) {
  const dueTasks = data.tasks.filter((t) => t.status !== "done" && t.due).sort((a, b) => new Date(a.due) - new Date(b.due));
  const nextExam = data.datesheets.map((e) => ({ ...e, dLeft: daysUntil(e.date) })).filter((e) => e.dLeft >= 0).sort((a, b) => a.dLeft - b.dLeft)[0];

  const streak = useStreak(data.studyLogs);
  const totalTopics = data.courses.reduce((s, c) => s + c.units.length, 0);
  const doneTopics = data.courses.reduce((s, c) => s + c.units.filter((u) => u.done).length, 0);
  const overallPct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;

  const todayName = DAYS[(new Date().getDay() + 6) % 7];
  const todaysBlocks = data.plannerBlocks.filter((b) => b.day === todayName).sort((a, b) => toMin(a.start) - toMin(b.start));
  const courseName = (id) => data.courses.find((c) => c.id === id)?.code;

  const weekHours = weekLogHours(data.studyLogs);
  const doneTasks = data.tasks.filter((t) => t.status === "done").length;

  const stats = [
    { label: "Study Streak", value: `${streak} Days`, icon: Flame, color: "#EF4444" },
    { label: "Study Hours (Week)", value: `${weekHours}h`, icon: TrendingUp, color: C.purple },
    { label: "Tasks Completed", value: `${doneTasks}/${data.tasks.length}`, icon: Check, color: C.green },
    { label: "Exam Countdown", value: nextExam ? `${nextExam.dLeft}d` : "—", icon: ClipboardList, color: C.amber },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${s.color}1A`, color: s.color }}><s.icon size={17} /></div>
            <div className="font-h text-xl font-semibold">{s.value}</div>
            <div className="text-xs text-[#64748B] mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {data.announcements.length > 0 && (
        <Card className="mb-6" style={{}}>
          <div className="flex items-center gap-2 mb-2"><Megaphone size={16} style={{ color: C.purple }} /><span className="font-h font-semibold text-sm">Announcements</span></div>
          <div className="space-y-2">
            {data.announcements.slice(0, 2).map((a) => (
              <div key={a.id} className="text-sm border-l-2 pl-3" style={{ borderColor: C.purple }}>
                <div className="font-medium">{a.title}</div>
                <div className="text-[#64748B] text-xs mt-0.5">{a.message}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="font-h font-semibold mb-3">Today's Schedule</div>
          {todaysBlocks.length === 0 && <div className="text-sm text-[#94A3B8]">Nothing planned. <button onClick={() => goTo("planner")} className="underline" style={{ color: C.purple }}>Add a block</button></div>}
          <div className="space-y-2">
            {todaysBlocks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                <span className="font-mono text-xs text-[#64748B] w-12">{b.start}</span>
                <span>{b.label}{b.courseId ? ` · ${courseName(b.courseId)}` : ""}</span>
                <Badge color={b.kind === "class" ? C.dark : b.kind === "recommended" ? C.amber : C.green}>{b.kind === "class" ? "class" : b.kind === "recommended" ? "recommended" : "self study"}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Upcoming Deadlines</div>
          {dueTasks.length === 0 && <div className="text-sm text-[#94A3B8]">All caught up.</div>}
          <div className="space-y-2">
            {dueTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title}</span><span className="text-xs text-[#94A3B8] font-mono">{fmt(t.due)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <div className="font-h font-semibold mb-3">Smart Timetable</div>
          <p className="text-xs text-[#64748B] mb-3">Auto-generated the week before each ST / PUT, weighted toward subjects with the least syllabus covered.</p>
          <button onClick={() => goTo("exams")} className="text-sm px-3 py-2 rounded-lg text-white" style={{ background: C.purple }}>View Exams & Timetable</button>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Progress Overview</div>
          <div className="flex items-center gap-6">
            <Donut pct={overallPct} size={90} />
            <div><div className="font-h text-2xl font-semibold">{overallPct}%</div><div className="text-xs text-[#64748B]">Overall syllabus progress</div></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function useStreak(studyLogs) {
  return useMemo(() => {
    const days = new Set(studyLogs.map((l) => l.date));
    let s = 0, d = new Date();
    while (days.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }, [studyLogs]);
}
function weekLogHours(studyLogs) {
  const start = new Date(); start.setDate(start.getDate() - 6);
  const mins = studyLogs.filter((l) => new Date(l.date) >= start).reduce((s, l) => s + l.minutes, 0);
  return +(mins / 60).toFixed(1);
}

function Donut({ pct, size = 90, color = C.purple }) {
  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={[{ v: pct }, { v: 100 - pct }]} dataKey="v" innerRadius={size * 0.36} outerRadius={size * 0.48} startAngle={90} endAngle={-270}>
            <Cell fill={color} /><Cell fill={C.gray} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------ Calendar (shared) ------------------------------ */

function CalendarView({ data, setData, editable }) {
  const [cursor, setCursor] = useState(new Date(2026, 7, 1));
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: "", date: "", type: "milestone" });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [draftEvents, setDraftEvents] = useState(null); // null = no review panel open
  const [draftFileName, setDraftFileName] = useState("");
  const pdfInputRef = useRef(null);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const dateKey = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const todayKey = new Date().toISOString().slice(0, 10);
  const eventsOn = (key) => [
    ...data.calendarEvents.filter((e) => e.date === key),
    ...data.tasks.filter((t) => t.due === key).map((t) => ({ date: key, title: t.title, type: "task" })),
  ];
  const monthEvents = data.calendarEvents.filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`));
  const shownDate = selected || (monthEvents[0]?.date ?? dateKey(1));
  const shownEvents = eventsOn(shownDate);
  const examCount = monthEvents.filter((e) => e.type === "exam").length;
  const holidayCount = monthEvents.filter((e) => e.type === "holiday").length;
  const milestoneCount = monthEvents.filter((e) => e.type === "milestone").length;
  const typeDot = (type) => type === "exam" ? C.dark : type === "holiday" ? C.green : type === "task" ? C.amber : C.purple;

  const addEvent = () => {
    if (!form.title.trim() || !form.date) return;
    setData((d) => logActivity({ ...d, calendarEvents: [...d.calendarEvents, { id: uid(), ...form }] }, `Event added: ${form.title}`));
    setForm({ title: "", date: "", type: "milestone" });
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const removeEvent = (id) => {
    const item = data.calendarEvents.find((e) => e.id === id);
    setData((d) => moveToTrash({ ...d, calendarEvents: d.calendarEvents.filter((e) => e.id !== id) }, "calendarEvent", item, `Calendar event: ${item?.title || "event"}`));
  };

  const onPdfSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const drafts = await parseCalendarPdf(file);
      if (drafts.length === 0) {
        setImportError("Couldn't find any dated events in this PDF — it may be a scanned image rather than text. Try a text-based PDF, or add events manually.");
      } else {
        setDraftEvents(drafts.map((ev) => ({ ...ev, id: uid(), include: true })));
        setDraftFileName(file.name);
      }
    } catch (err) {
      setImportError(err.message || "Couldn't read that PDF.");
    } finally {
      setImporting(false);
    }
  };
  const updateDraft = (id, patch) => setDraftEvents((list) => list.map((ev) => ev.id === id ? { ...ev, ...patch } : ev));
  const removeDraft = (id) => setDraftEvents((list) => list.filter((ev) => ev.id !== id));
  const toggleAllDrafts = (include) => setDraftEvents((list) => list.map((ev) => ({ ...ev, include })));
  const confirmImport = () => {
    const chosen = draftEvents.filter((ev) => ev.include && ev.title.trim() && ev.date);
    if (chosen.length === 0) { setDraftEvents(null); return; }
    const existing = new Set(data.calendarEvents.map((ev) => `${ev.date}|${ev.title.trim().toLowerCase()}`));
    const toAdd = chosen
      .filter((ev) => !existing.has(`${ev.date}|${ev.title.trim().toLowerCase()}`))
      .map((ev) => ({ id: uid(), date: ev.date, title: ev.title.trim(), type: ev.type }));
    setData((d) => logActivity({ ...d, calendarEvents: [...d.calendarEvents, ...toAdd] }, `Imported ${toAdd.length} event(s) from ${draftFileName}`));
    setDraftEvents(null);
    setDraftFileName("");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
      {deleteModal}
      <Card className="max-w-md mx-auto lg:mx-0 w-full">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-[#F3EEFE] transition-colors"><ChevronLeft size={16} /></button>
          <div className="flex items-center gap-2">
            <div className="font-h font-semibold text-sm">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
            <button onClick={() => { setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelected(todayKey); }}
              className="text-[10px] px-2 py-0.5 rounded-full border border-[#E5E7EB] text-[#64748B] hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors">
              Today
            </button>
          </div>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-[#F3EEFE] transition-colors"><ChevronRight size={16} /></button>
        </div>

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-[10.5px] flex items-center gap-1" style={{ color: C.dark }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.dark }} />{examCount} exam{examCount !== 1 ? "s" : ""}</span>
          <span className="text-[10.5px] flex items-center gap-1" style={{ color: C.green }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />{holidayCount} holiday{holidayCount !== 1 ? "s" : ""}</span>
          <span className="text-[10.5px] flex items-center gap-1" style={{ color: C.purple }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.purple }} />{milestoneCount} milestone{milestoneCount !== 1 ? "s" : ""}</span>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-medium text-[#94A3B8] mb-1.5">{DAYS.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const key = dateKey(day); const evs = eventsOn(key);
            const isSel = key === shownDate; const isToday = key === todayKey;
            const isWeekend = i % 7 >= 5;
            const dotTypes = [...new Set(evs.map((e) => e.type))].slice(0, 3);
            return (
              <button key={i} onClick={() => setSelected(key)}
                className={`w-9 h-9 sm:w-9 sm:h-9 mx-auto rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 relative transition-all ${isSel ? "text-white shadow-sm scale-[1.05]" : "hover:bg-[#F3EEFE]"}`}
                style={isSel ? { background: C.purple } : isToday ? { border: `1.5px solid ${C.purple}`, color: C.purple, fontWeight: 600 } : isWeekend ? { color: "#B0B9C6" } : {}}>
                {day}
                {dotTypes.length > 0 && (
                  <span className="flex items-center gap-0.5 absolute bottom-1">
                    {dotTypes.map((t, j) => <span key={j} className="w-1 h-1 rounded-full" style={{ background: isSel ? "#fff" : typeDot(t) }} />)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 justify-center mt-3 pt-3 border-t border-[#F1F5F9] flex-wrap">
          {[["milestone", C.purple, "Milestone"], ["exam", C.dark, "Exam"], ["holiday", C.green, "Holiday"], ["task", C.amber, "Task"]].map(([t, col, label]) => (
            <span key={t} className="text-[9.5px] flex items-center gap-1 text-[#94A3B8]"><span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />{label}</span>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="font-h font-semibold mb-3 text-sm">Events on {fmt(shownDate)}</div>
          <div className="space-y-3">
            {shownEvents.length === 0 && <div className="text-sm text-[#94A3B8]">No events this day.</div>}
            {shownEvents.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: typeDot(e.type) }} />
                  <div><div className="text-sm">{e.title}</div>{e.type !== "task" && <TypeBadge type={e.type} />}</div>
                </div>
                {editable && e.id && <button onClick={() => confirmDelete(`Calendar event "${e.title}"`, () => removeEvent(e.id))} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={13} /></button>}
              </div>
            ))}
          </div>
        </Card>

        {editable && (
          <Card>
            <div className="font-h font-semibold text-sm mb-2">Add event</div>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm w-full mb-2" />
            <div className="flex gap-2 mb-2">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm flex-1" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
                <option value="milestone">Milestone</option><option value="exam">Exam</option><option value="holiday">Holiday</option>
              </select>
            </div>
            <button onClick={addEvent} className="text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}>Add</button>
          </Card>
        )}

        {editable && (
          <Card style={{ borderLeft: `3px solid ${C.purple}` }}>
            <div className="font-h font-semibold text-sm mb-1 flex items-center gap-1.5"><FileText size={14} /> Import academic calendar (PDF)</div>
            <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Upload the official PDF — dates and events are auto-detected. You'll review, edit, or remove anything before it's added, and can keep editing normally after.</p>
            <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPdfSelected} />
            <button onClick={() => pdfInputRef.current?.click()} disabled={importing}
              className="text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 disabled:opacity-60" style={{ borderColor: C.purple, color: C.purple }}>
              <Upload size={14} /> {importing ? "Reading PDF…" : "Upload PDF"}
            </button>
            {importError && <div className="text-xs mt-2" style={{ color: "#EF4444" }}>{importError}</div>}
          </Card>
        )}
      </div>

      {editable && draftEvents && (
        <div className="lg:col-span-2">
          <Card style={{ borderLeft: `3px solid ${C.purple}` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="font-h font-semibold text-sm flex items-center gap-1.5"><FileText size={14} /> Review events found in "{draftFileName}"</div>
              <button onClick={() => setDraftEvents(null)} className="text-[#94A3B8] hover:text-[#EF4444]"><X size={16} /></button>
            </div>
            <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>{draftEvents.length} event{draftEvents.length !== 1 ? "s" : ""} detected. Uncheck anything wrong, edit titles/dates/types as needed, then import.</p>
            <div className="flex gap-3 mb-3 text-xs">
              <button onClick={() => toggleAllDrafts(true)} className="hover:underline" style={{ color: C.purple }}>Select all</button>
              <button onClick={() => toggleAllDrafts(false)} className="hover:underline" style={{ color: "#64748B" }}>Deselect all</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 mb-3">
              {draftEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 border border-[#F1F5F9] rounded-lg px-2 py-1.5">
                  <input type="checkbox" checked={ev.include} onChange={(e) => updateDraft(ev.id, { include: e.target.checked })} className="flex-shrink-0" />
                  <input value={ev.title} onChange={(e) => updateDraft(ev.id, { title: e.target.value })} className="border border-[#E5E7EB] rounded-md px-2 py-1 text-xs flex-1 min-w-0" />
                  <input type="date" value={ev.date} onChange={(e) => updateDraft(ev.id, { date: e.target.value })} className="border border-[#E5E7EB] rounded-md px-2 py-1 text-xs flex-shrink-0" />
                  <select value={ev.type} onChange={(e) => updateDraft(ev.id, { type: e.target.value })} className="border border-[#E5E7EB] rounded-md px-2 py-1 text-xs flex-shrink-0">
                    <option value="milestone">Milestone</option><option value="exam">Exam</option><option value="holiday">Holiday</option>
                  </select>
                  <button onClick={() => removeDraft(ev.id)} className="text-[#CBD5E1] hover:text-[#EF4444] flex-shrink-0"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmImport} className="text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}>
                Import {draftEvents.filter((e) => e.include).length} event{draftEvents.filter((e) => e.include).length !== 1 ? "s" : ""}
              </button>
              <button onClick={() => setDraftEvents(null)} className="text-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB]">Cancel</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Subjects / Courses (shared) ------------------------------ */

function CoursesView({ data, setData, editable }) {
  const isDirector = data.profiles[data.session]?.role === "admin";
  const isHOD = isAdminKey(data.session, data.profiles) && !isDirector;
  const myDeptId = isHOD ? (data.profiles[data.session]?.departmentId || data.departments[0]?.id) : null;
  const canManageCourse = (c) => isDirector || (isHOD && (c.departmentId || data.departments[0]?.id) === myDeptId);

  const [deptTab, setDeptTab] = useState(isHOD ? myDeptId : "all");
  const [newUnit, setNewUnit] = useState({});
  const [semesterInput, setSemesterInput] = useState(data.semester);
  const [newSubject, setNewSubject] = useState({ code: "", name: "", credits: 3, category: "Core", departmentId: isHOD ? myDeptId : (data.departments[0]?.id || DEFAULT_DEPT_ID) });

  const toggleTopic = (courseId, unitId) => setData((d) => ({ ...d, courses: d.courses.map((c) => c.id !== courseId ? c : { ...c, units: c.units.map((u) => u.id === unitId ? { ...u, done: !u.done } : u) }) }));
  const setElective = (courseId, name) => setData((d) => ({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, name } : c) }));
  const addUnit = (courseId) => {
    const name = (newUnit[courseId] || "").trim();
    if (!name) return;
    setData((d) => logActivity({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, units: [...c.units, u(uid(), name)] } : c) }, `Unit added to ${data.courses.find((c) => c.id === courseId)?.code}: ${name}`));
    setNewUnit((s) => ({ ...s, [courseId]: "" }));
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const removeUnit = (courseId, unitId) => {
    const course = data.courses.find((c) => c.id === courseId);
    const item = course?.units.find((u) => u.id === unitId);
    setData((d) => moveToTrash({ ...d, courses: d.courses.map((c) => c.id !== courseId ? c : { ...c, units: c.units.filter((u) => u.id !== unitId) }) }, "courseUnit", item, `Unit "${item?.name || "unit"}" (${course?.code || ""})`, { courseId }));
  };
  const toggleCourseHidden = (courseId) => setData((d) => logActivity({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, hidden: !c.hidden } : c) }, `Subject ${data.courses.find((c) => c.id === courseId)?.hidden ? "shown" : "hidden"}: ${data.courses.find((c) => c.id === courseId)?.code}`));
  const toggleUnitHidden = (courseId, unitId) => setData((d) => ({ ...d, courses: d.courses.map((c) => c.id !== courseId ? c : { ...c, units: c.units.map((u) => u.id === unitId ? { ...u, hidden: !u.hidden } : u) }) }));
  const saveSemester = () => setData((d) => logActivity({ ...d, semester: semesterInput }, `Semester updated to: ${semesterInput}`));
  const palette = [C.purple, "#2563EB", C.amber, "#DB2777", C.green, "#475569", "#92400E"];
  const addSubject = () => {
    if (!newSubject.code.trim() || !newSubject.name.trim()) return;
    const targetDept = isHOD ? myDeptId : (newSubject.departmentId || data.departments[0]?.id);
    const color = palette[data.courses.length % palette.length];
    const course = { id: uid(), code: newSubject.code.trim(), name: newSubject.name.trim(), credits: Number(newSubject.credits) || 0, category: newSubject.category, departmentId: targetDept, color, units: [] };
    setData((d) => logActivity({ ...d, courses: [...d.courses, course] }, `Subject added: ${course.code} — ${course.name} (${deptName(data, targetDept)})`));
    setNewSubject({ code: "", name: "", credits: 3, category: "Core", departmentId: newSubject.departmentId });
  };
  const removeSubject = (courseId) => {
    const course = data.courses.find((c) => c.id === courseId);
    confirmDelete(`Subject "${course?.code} — ${course?.name}" and all its unit-wise progress`, () => {
      setData((d) => moveToTrash({ ...d, courses: d.courses.filter((c) => c.id !== courseId) }, "course", course, `Subject: ${course?.code} — ${course?.name}`));
    });
  };

  const uploadSyllabus = async (courseId, file) => {
    if (!file) return;
    if (file.size > 25_000_000) { alert("That file is larger than 25MB — pick a smaller PDF."); return; }
    const { url: dataUrl } = await uploadAttachment(file); // "dataUrl" name kept for compatibility; it's a real Storage URL now
    const course = data.courses.find((c) => c.id === courseId);
    setData((d) => logActivity({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, syllabus: { fileName: file.name, fileType: file.type, dataUrl } } : c) }, `Syllabus uploaded: ${course?.code}`));
  };
  const removeSyllabus = (courseId) => {
    const course = data.courses.find((c) => c.id === courseId);
    confirmDelete(`Syllabus for "${course?.code}"`, () => {
      setData((d) => moveToTrash({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, syllabus: null } : c) }, "courseSyllabus", course?.syllabus, `Syllabus: ${course?.code}`, { courseId }));
    });
  };

  const grouped = useMemo(() => {
    const cats = {};
    let visibleCourses = editable ? data.courses : data.courses.filter((c) => !c.hidden);
    if (!editable) {
      const myStudentDept = data.profiles[data.session]?.departmentId || data.departments[0]?.id;
      visibleCourses = visibleCourses.filter((c) => (c.departmentId || data.departments[0]?.id) === myStudentDept);
    } else if (isHOD) {
      visibleCourses = visibleCourses.filter((c) => (c.departmentId || data.departments[0]?.id) === myDeptId); // HOD never sees another department's subjects
    } else if (deptTab !== "all") {
      visibleCourses = visibleCourses.filter((c) => (c.departmentId || data.departments[0]?.id) === deptTab);
    }
    visibleCourses.forEach((c) => {
      const course = editable ? c : { ...c, units: c.units.filter((u) => !u.hidden) };
      (cats[c.category] = cats[c.category] || []).push(course);
    });
    return cats;
  }, [data.courses, editable, deptTab, isHOD, myDeptId, data.session, data.profiles, data.departments]);

  const materialsFor = (courseId) => data.resources.filter((r) => r.courseId === courseId);

  return (
    <div>
      {deleteModal}
      {editable ? (
        <Card className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1">
            <div className="text-xs font-semibold text-[#94A3B8] mb-1">CURRENT SEMESTER</div>
            <input value={semesterInput} onChange={(e) => setSemesterInput(e.target.value)} placeholder="e.g. VI Semester · B.Tech CSE · AKTU (Even 2026-27)" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm w-full" />
          </div>
          <button onClick={saveSemester} className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}>Update</button>
        </Card>
      ) : (
        <p className="text-sm text-[#64748B] -mt-4 mb-6">{data.semester}</p>
      )}
      {editable && <p className="text-sm text-[#64748B] -mt-2 mb-4">Unit-wise syllabus management — add a subject when the semester changes, or edit units on existing ones.</p>}

      {editable && isDirector && data.departments.length > 1 && (
        <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1 mb-4 w-fit flex-wrap">
          <button onClick={() => setDeptTab("all")} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === "all" ? "text-white" : "text-[#64748B]"}`} style={deptTab === "all" ? { background: C.purple } : {}}>All Departments</button>
          {data.departments.map((dp) => (
            <button key={dp.id} onClick={() => setDeptTab(dp.id)} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === dp.id ? "text-white" : "text-[#64748B]"}`} style={deptTab === dp.id ? { background: C.purple } : {}}>
              {dp.name}
            </button>
          ))}
        </div>
      )}
      {editable && isHOD && data.departments.length > 1 && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] w-fit mb-4" style={{ color: "#1E293B" }}>
          <b>{deptName(data, myDeptId)}</b> <span style={{ color: "#94A3B8" }}>— you only see subjects in your own department</span>
        </div>
      )}

      {editable && (isDirector || deptTab === myDeptId) && (
        <Card className="mb-6">
          <div className="text-xs font-semibold text-[#94A3B8] mb-2">ADD A NEW SUBJECT</div>
          <div className="grid sm:grid-cols-5 gap-2">
            <input value={newSubject.code} onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })} placeholder="Code, e.g. BCS601" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm" />
            <input value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} placeholder="Subject name" className="sm:col-span-2 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm" />
            <input type="number" min="0" value={newSubject.credits} onChange={(e) => setNewSubject({ ...newSubject, credits: e.target.value })} placeholder="Credits" className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm" />
            <select value={newSubject.category} onChange={(e) => setNewSubject({ ...newSubject, category: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
              <option>Core</option><option>Elective I</option><option>Elective II</option><option>Lab</option><option>Project</option><option>Non-Credit</option>
            </select>
            {isDirector && data.departments.length > 1 && (
              <select value={newSubject.departmentId} onChange={(e) => setNewSubject({ ...newSubject, departmentId: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm sm:col-span-2">
                {data.departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
              </select>
            )}
          </div>
          <button onClick={addSubject} className="mt-3 flex items-center gap-1 text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Add Subject</button>
        </Card>
      )}

      {Object.entries(grouped).map(([cat, courses]) => (
        <div key={cat} className="mb-6">
          <div className="text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">{cat}</div>
          <div className="grid sm:grid-cols-2 gap-4">
            {courses.map((c) => {
              const done = c.units.filter((u) => u.done).length;
              const pct = c.units.length ? Math.round((done / c.units.length) * 100) : 0;
              const mats = materialsFor(c.id);
              return (
                <Card key={c.id} className={c.hidden && editable ? "opacity-60" : ""}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-[#94A3B8]">{c.code}{c.credits ? ` · ${c.credits} cr` : ""}</span>
                    <div className="flex items-center gap-2">
                      {editable && data.departments.length > 1 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#F4F4F8", color: "#64748B" }}>{deptName(data, c.departmentId || data.departments[0]?.id)}</span>}
                      {editable && !canManageCourse(c) && <span className="text-[9px]" style={{ color: "#94A3B8" }}>view only</span>}
                      {c.hidden && editable && <Badge color="#94A3B8">hidden</Badge>}
                      <span className="text-xs font-semibold" style={{ color: c.color }}>{pct}%</span>
                      {canManageCourse(c) && editable && (
                        <button onClick={() => toggleCourseHidden(c.id)} title={c.hidden ? "Show to students" : "Hide from students"} className="text-[#CBD5E1] hover:text-[#1E293B]">
                          {c.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      {canManageCourse(c) && editable && <button onClick={() => removeSubject(c.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={13} /></button>}
                    </div>
                  </div>
                  {c.options ? (
                    <select value={c.name} onChange={(e) => setElective(c.id, e.target.value)} className="font-h font-semibold text-[15px] mb-2 bg-transparent border-b border-[#E5E7EB] w-full pb-1">
                      {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : <div className="font-h font-semibold text-[15px] mb-2">{c.name}</div>}
                  <div className="h-1.5 bg-[#E5E7EB] rounded mb-3"><div className="h-1.5 rounded" style={{ width: `${pct}%`, background: c.color }} /></div>

                  <div className="text-[11px] font-semibold text-[#94A3B8] mb-1.5">UNIT-WISE PROGRESS</div>
                  <div className="space-y-1.5 mb-2">
                    {c.units.map((u) => (
                      <label key={u.id} className={`flex items-center gap-2 text-sm group ${u.hidden && editable ? "opacity-50" : ""} ${editable ? "cursor-default" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          checked={u.done}
                          disabled={editable}
                          onChange={() => !editable && toggleTopic(c.id, u.id)}
                          title={editable ? "Only the student can mark a topic complete" : ""}
                          style={{ accentColor: c.color }}
                        />
                        <span className={`flex-1 ${u.done ? "line-through text-[#B0B8C6]" : ""}`}>{u.name}{u.hidden && editable ? " (hidden)" : ""}</span>
                        {editable && canManageCourse(c) && (
                          <button onClick={() => toggleUnitHidden(c.id, u.id)} title={u.hidden ? "Show to students" : "Hide from students"} className="opacity-0 group-hover:opacity-100 text-[#CBD5E1] hover:text-[#1E293B]">
                            {u.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                        {editable && canManageCourse(c) && <button onClick={() => confirmDelete(`Unit "${u.name}"`, () => removeUnit(c.id, u.id))} className="opacity-0 group-hover:opacity-100 text-[#CBD5E1] hover:text-[#EF4444]"><X size={13} /></button>}
                      </label>
                    ))}
                  </div>
                  {editable && canManageCourse(c) && (
                    <div className="flex gap-2 mb-3">
                      <input value={newUnit[c.id] || ""} onChange={(e) => setNewUnit((s) => ({ ...s, [c.id]: e.target.value }))} placeholder="Add unit/topic…" className="flex-1 border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs" />
                      <button onClick={() => addUnit(c.id)} className="text-xs px-2 py-1.5 rounded-lg text-white" style={{ background: c.color }}><Plus size={13} /></button>
                    </div>
                  )}

                  {mats.length > 0 && (
                    <div className="pt-2 border-t border-[#F1F0F5]">
                      <div className="text-[11px] font-semibold text-[#94A3B8] mb-1.5">MATERIAL</div>
                      {mats.map((r) => <ResourceLine key={r.id} r={r} />)}
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#F1F0F5] mt-2">
                    <div className="text-[11px] font-semibold text-[#94A3B8] mb-1.5">SYLLABUS (PDF)</div>
                    {c.syllabus ? (
                      <div className="flex items-center justify-between gap-2">
                        {/* View opens the PDF inline in a new tab; Download is a separate explicit action — the
                            old single link had `download` set, which forced a save dialog and blocked viewing. */}
                        <button type="button" onClick={() => openAttachment(c.syllabus.dataUrl, c.syllabus.fileName, c.syllabus.fileType)} className="flex items-center gap-1.5 text-xs truncate" style={{ color: C.purple }}>
                          <FileText size={13} /> {c.syllabus.fileName}
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a href={c.syllabus.dataUrl} download={c.syllabus.fileName} title="Download" className="text-[#94A3B8] hover:text-[#1E293B]"><Download size={13} /></a>
                          {editable && canManageCourse(c) && <button onClick={() => removeSyllabus(c.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={13} /></button>}
                        </div>
                      </div>
                    ) : editable && canManageCourse(c) ? (
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: C.purple }}>
                        <Upload size={13} /> Upload syllabus PDF
                        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { uploadSyllabus(c.id, e.target.files[0]); e.target.value = ""; }} />
                      </label>
                    ) : (
                      <div className="text-xs" style={{ color: "#94A3B8" }}>Not uploaded yet.</div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      {editable && <p className="text-xs text-[#94A3B8]">To upload material for a subject, use the Resources page and pick the subject there.</p>}
    </div>
  );
}

function ResourceLine({ r }) {
  const Icon = fileKindIcon(r.fileType || "");
  // No `download` attribute here — clicking opens/previews the file in a new tab instead of
  // forcing a save dialog. A small separate download icon covers anyone who does want the file.
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      {r.dataUrl ? (
        <button type="button" onClick={() => openAttachment(r.dataUrl, r.fileName || r.title, r.fileType)} className="flex items-center gap-2 text-xs truncate" style={{ color: C.purple }}>
          <Icon size={13} className="flex-shrink-0" /> <span className="truncate">{r.title}</span>
        </button>
      ) : (
        <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs truncate" style={{ color: C.purple }}>
          <Icon size={13} className="flex-shrink-0" /> <span className="truncate">{r.title}</span>
        </a>
      )}
      {r.dataUrl && <a href={r.dataUrl} download={r.fileName} title="Download" className="text-[#94A3B8] hover:text-[#1E293B] flex-shrink-0"><Download size={12} /></a>}
    </div>
  );
}

/* ------------------------------ Study Planner / College Classes (shared) ------------------------------ */

function PlannerView({ data, setData, role, defaultFilter = "all", lockFilter = false }) {
  const isAdmin = role === "admin";
  const isDirector = isAdmin && data.profiles[data.session]?.role === "admin";
  const isHOD = isAdmin && isAdminKey(data.session, data.profiles) && !isDirector;
  const myDeptId = isHOD ? (data.profiles[data.session]?.departmentId || data.departments[0]?.id) : null;
  const studentDeptId = !isAdmin ? (data.profiles[data.session]?.departmentId || data.departments[0]?.id) : null;
  const [deptTab, setDeptTab] = useState(isHOD ? myDeptId : "all"); // Director-only picker across departments' classes
  const [form, setForm] = useState({ day: "Mon", start: "09:00", end: "10:00", label: "", courseId: "" });
  const [filter, setFilter] = useState(defaultFilter);
  // How much of the day the weekly grid shows — every person can stretch this to fit their own
  // routine (e.g. a student who studies past 9 PM), saved on their own profile so it sticks
  // next time they open the planner. Defaults to a wider 6 AM–11 PM window.
  const [hourRange, setHourRange] = useState(() => data.plannerHourRanges?.[data.session] || { start: 6, end: 23 });
  const updateHourRange = (next) => {
    if (next.end <= next.start) return;
    setHourRange(next);
    setData((d) => ({ ...d, plannerHourRanges: { ...d.plannerHourRanges, [d.session]: next } }));
  };
  const visibleHours = Array.from({ length: hourRange.end - hourRange.start + 1 }, (_, i) => hourRange.start + i);
  const hourLabel = (h) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);

  const addBlock = () => {
    if (!form.label.trim()) return;
    const course = data.courses.find((c) => c.id === form.courseId);
    const kind = isAdmin ? "class" : "self";
    const ownerKey = isAdmin ? null : data.session; // self-study blocks belong to whichever student created them
    const departmentId = isAdmin ? (isHOD ? myDeptId : (deptTab !== "all" ? deptTab : data.departments[0]?.id)) : studentDeptId;
    setData((d) => logActivity({ ...d, plannerBlocks: [...d.plannerBlocks, { id: uid(), ...form, kind, ownerKey, departmentId, color: course?.color || (isAdmin ? C.dark : C.green) }] }, isAdmin ? `Class scheduled: ${form.label}` : `Self-study block added: ${form.label}`));
    setForm({ ...form, label: "" });
  };
  // Students can only remove/edit their own self-study blocks; class/recommended blocks are admin-owned or algorithmic.
  // A co-admin (HOD) can only manage class blocks in their own department — the Director can manage every class.
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const canManage = (block) => (isAdmin && block.kind === "class" && (isDirector || (block.departmentId || data.departments[0]?.id) === myDeptId)) || (!isAdmin && block.kind === "self" && (!block.ownerKey || block.ownerKey === data.session));

  // Clicking a manageable block opens a small edit/delete popover instead of deleting immediately.
  const [activeBlock, setActiveBlock] = useState(null); // the block currently shown in the edit popover
  const [editForm, setEditForm] = useState({ day: "Mon", start: "09:00", end: "10:00", label: "" });
  const openBlock = (block) => { if (!canManage(block)) return; setActiveBlock(block); setEditForm({ day: block.day, start: block.start, end: block.end, label: block.label }); };
  const closeBlock = () => setActiveBlock(null);
  const saveBlock = () => {
    if (!editForm.label.trim() || !activeBlock) return;
    setData((d) => logActivity({ ...d, plannerBlocks: d.plannerBlocks.map((b) => b.id === activeBlock.id ? { ...b, ...editForm, label: editForm.label.trim() } : b) }, `${isAdmin ? "Class" : "Self-study block"} edited: ${editForm.label.trim()}`));
    closeBlock();
  };
  const deleteBlock = () => {
    if (!activeBlock) return;
    const block = activeBlock;
    closeBlock();
    confirmDelete(`"${block.label}" (${block.day} ${block.start}–${block.end})`, () => {
      setData((d) => moveToTrash({ ...d, plannerBlocks: d.plannerBlocks.filter((b) => b.id !== block.id) }, "plannerBlock", block, `Planner block: ${block.label}`));
    });
  };

  const visibleBlocks = data.plannerBlocks.filter((b) => {
    if (isAdmin) {
      if (b.kind !== "class") return false;
      const blockDept = b.departmentId || data.departments[0]?.id;
      if (isHOD) return blockDept === myDeptId; // HOD never sees another department's classes, full stop
      if (deptTab !== "all") return blockDept === deptTab; // Director's tab picker
      return true;
    }
    if (b.kind === "class" && (b.departmentId || data.departments[0]?.id) !== studentDeptId) return false; // students only see their own department's classes
    if (b.kind === "self" && b.ownerKey && b.ownerKey !== data.session) return false; // never show another student's self-study blocks
    if (filter === "all") return true; // bugfix: "all" now genuinely means all, including auto-recommended blocks
    if (filter === "self") return b.kind === "self";
    if (filter === "class") return b.kind === "class";
    if (filter === "recommended") return b.kind === "recommended";
    return true;
  });

  const kindColor = { class: C.dark, self: C.green, recommended: C.amber };
  const todayDayAbbr = DAYS[(new Date().getDay() + 6) % 7]; // getDay() is Sun=0..Sat=6; DAYS starts Mon
  const now = new Date();
  const nowMinutesInDay = now.getHours() * 60 + now.getMinutes();
  const CELL_H = 40; // compact row height (was 64)

  return (
    <div>
      {deleteModal}
      {activeBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)" }} onClick={closeBlock}>
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft }}>
                <Pencil size={14} color={C.purple} />
              </div>
              <div className="text-sm font-semibold" style={{ color: "#1E293B" }}>{isAdmin ? "Edit class" : "Edit self-study block"}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select value={editForm.day} onChange={(e) => setEditForm({ ...editForm, day: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs col-span-2">
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="time" value={editForm.start} onChange={(e) => setEditForm({ ...editForm, start: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs" />
              <input type="time" value={editForm.end} onChange={(e) => setEditForm({ ...editForm, end: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs" />
            </div>
            <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} placeholder="Label" className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs w-full mb-4" />
            <div className="flex items-center justify-between gap-2">
              <button onClick={deleteBlock} className="text-xs px-3 py-1.5 rounded-lg text-[#EF4444] border border-[#FEE2E2] hover:bg-[#FEF2F2] flex items-center gap-1"><Trash2 size={12} /> Delete</button>
              <div className="flex gap-2">
                <button onClick={closeBlock} className="text-xs px-3 py-1.5 rounded-lg border border-[#E5E7EB]" style={{ color: "#1E293B" }}>Cancel</button>
                <button onClick={saveBlock} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: C.purple }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!isAdmin && !lockFilter && (
        <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1 mb-4 w-fit">
          {["all", "self", "class", "recommended"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-md capitalize ${filter === f ? "text-white" : "text-[#64748B]"}`} style={filter === f ? { background: C.purple } : {}}>
              {f === "class" ? "College Class" : f === "self" ? "Self Study" : f}
            </button>
          ))}
        </div>
      )}

      {isAdmin && isDirector && data.departments.length > 1 && (
        <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1 mb-4 w-fit flex-wrap">
          <button onClick={() => setDeptTab("all")} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === "all" ? "text-white" : "text-[#64748B]"}`} style={deptTab === "all" ? { background: C.purple } : {}}>All Departments</button>
          {data.departments.map((dp) => (
            <button key={dp.id} onClick={() => setDeptTab(dp.id)} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === dp.id ? "text-white" : "text-[#64748B]"}`} style={deptTab === dp.id ? { background: C.purple } : {}}>
              {dp.name}
            </button>
          ))}
        </div>
      )}
      {isAdmin && isHOD && data.departments.length > 1 && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] w-fit mb-4" style={{ color: "#1E293B" }}>
          <b>{deptName(data, myDeptId)}</b> <span style={{ color: "#94A3B8" }}>— you only manage classes in your own department</span>
        </div>
      )}

      {(isAdmin || filter === "self") && (
        <Card className="mb-4">
          <div className="text-xs font-semibold text-[#94A3B8] mb-2">{isAdmin ? "SCHEDULE A RECURRING CLASS" : "ADD A SELF-STUDY BLOCK"}</div>
          <div className="flex flex-wrap gap-2 items-end">
            <div><div className="text-xs text-[#64748B] mb-1">Day</div>
              <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
            </div>
            <div><div className="text-xs text-[#64748B] mb-1">Start</div><input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm" /></div>
            <div><div className="text-xs text-[#64748B] mb-1">End</div><input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm" /></div>
            <div><div className="text-xs text-[#64748B] mb-1">Subject</div>
              <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
                <option value="">— optional —</option>{(isAdmin ? data.courses.filter((c) => (c.departmentId || data.departments[0]?.id) === (isHOD ? myDeptId : (deptTab !== "all" ? deptTab : data.departments[0]?.id))) : data.courses.filter((c) => (c.departmentId || data.departments[0]?.id) === studentDeptId)).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]"><div className="text-xs text-[#64748B] mb-1">Label</div>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={isAdmin ? "e.g. DBMS Lecture" : "e.g. DBMS revision"} className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <button onClick={addBlock} className="flex items-center gap-1 text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Add</button>
          </div>
        </Card>
      )}
      {!isAdmin && lockFilter && filter === "class" && (
        <Card className="mb-4"><p className="text-xs text-[#64748B]">This is the recurring class schedule your admin has set — it's read-only here.</p></Card>
      )}

      <Card className="overflow-x-auto !p-0" style={{ borderRadius: 18, boxShadow: "0 4px 20px rgba(76,29,149,0.07), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden", border: "1px solid #F1EEFB" }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2.5 flex-wrap gap-2" style={{ background: "linear-gradient(180deg, #FAF8FF 0%, #FFFFFF 100%)", borderBottom: "1px solid #F1F0F5" }}>
          <div className="flex items-center gap-1.5">
            <CalendarClock size={13} color={C.purple} />
            <div className="font-h font-bold text-xs" style={{ color: "#1E293B", letterSpacing: "0.07em" }}>THIS WEEK</div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-medium flex-wrap justify-end">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#F4F4F8]" title="Choose which hours the grid shows">
              <select value={hourRange.start} onChange={(e) => updateHourRange({ ...hourRange, start: Number(e.target.value) })} className="bg-transparent font-semibold" style={{ border: "none", color: "#475569" }}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
              <span style={{ color: "#94A3B8" }}>–</span>
              <select value={hourRange.end} onChange={(e) => updateHourRange({ ...hourRange, end: Number(e.target.value) })} className="bg-transparent font-semibold" style={{ border: "none", color: "#475569" }}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "#F4F4F8", color: "#475569" }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.dark }} /> Class</span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "#ECFDF5", color: "#047857" }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.green }} /> Self Study</span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "#FFFBEB", color: "#B45309" }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ border: `1.5px dashed ${C.amber}` }} /> Recommended</span>
          </div>
        </div>
        <div className="grid p-3 pt-3.5" style={{ gridTemplateColumns: "42px repeat(7, minmax(76px, 1fr))" }}>
          <div />
          {DAYS.map((d) => {
            const isToday = todayDayAbbr === d;
            const isWeekend = d === "Sat" || d === "Sun";
            return (
              <div key={d} className="text-center pb-2.5">
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full inline-block transition-transform"
                  style={isToday
                    ? { background: `linear-gradient(135deg, ${C.purple}, #9333EA)`, color: "#fff", boxShadow: "0 3px 8px rgba(124,58,237,0.4)", transform: "scale(1.06)" }
                    : { color: isWeekend ? "#B0A0D6" : "#475569", background: isWeekend ? "#FAF7FF" : "transparent" }}
                >{d}</span>
              </div>
            );
          })}
          {visibleHours.map((h, hi) => (
            <React.Fragment key={h}>
              <div className="text-right pr-2 font-bold" style={{ height: CELL_H, fontSize: 9, color: "#475569", letterSpacing: "0.02em" }}>{h > 12 ? h - 12 : h}<span style={{ fontSize: 6.5, marginLeft: 1 }}>{h >= 12 ? "PM" : "AM"}</span></div>
              {DAYS.map((d) => {
                const blocks = visibleBlocks.filter((b) => b.day === d && Math.floor(toMin(b.start) / 60) === h);
                const isToday = todayDayAbbr === d;
                const isWeekend = d === "Sat" || d === "Sun";
                return (
                  <div key={d} className="relative transition-colors"
                    style={{
                      height: CELL_H,
                      borderTop: "1px solid #F1EFF7",
                      borderLeft: "1px solid #F1EFF7",
                      background: isToday ? "linear-gradient(180deg, #FBF9FF 0%, #F8F5FF 100%)" : isWeekend ? "#FBFBFD" : hi % 2 === 0 ? "#FFFFFF" : "#FCFCFD",
                    }}>
                    {isToday && nowMinutesInDay !== null && h === Math.floor(nowMinutesInDay / 60) && (
                      <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: (nowMinutesInDay % 60) * (CELL_H / 60) }}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: C.red, boxShadow: `0 0 0 4px ${C.red}26`, border: "1.5px solid #fff" }} />
                        <span className="flex-1" style={{ height: 2, background: `linear-gradient(90deg, ${C.red}, ${C.red}99)`, borderRadius: 2 }} />
                        <span className="flex-shrink-0 text-[7px] font-bold text-white px-1.5 py-[1px] rounded-full" style={{ background: C.red, boxShadow: "0 1px 3px rgba(239,68,68,0.4)" }}>NOW</span>
                      </div>
                    )}
                    {blocks.map((b) => {
                      const dur = toMin(b.end) - toMin(b.start);
                      const manageable = canManage(b);
                      const Icon = b.kind === "class" ? Building2 : b.kind === "self" ? Award : Wand2;
                      const baseColor = b.kind === "recommended" ? kindColor.recommended : b.color;
                      return (
                        <div key={b.id} onClick={() => openBlock(b)}
                          className={`group absolute left-0.5 right-0.5 rounded-[7px] overflow-hidden transition-all duration-150 ${manageable ? "cursor-pointer hover:scale-[1.04] hover:z-30 hover:shadow-lg" : "cursor-default"}`}
                          style={{
                            top: (toMin(b.start) % 60) * (CELL_H / 60),
                            height: Math.max(dur * (CELL_H / 60), 15),
                            paddingLeft: 6, paddingRight: 4, paddingTop: 2, paddingBottom: 2,
                            fontSize: 9, color: "#fff",
                            background: `linear-gradient(140deg, ${baseColor}, ${baseColor}CC)`,
                            borderLeft: `2.5px solid ${baseColor === C.amber ? "#B45309" : "rgba(255,255,255,0.75)"}`,
                            border: b.kind === "recommended" ? "1px dashed rgba(255,255,255,0.75)" : "none",
                            boxShadow: "0 1.5px 4px rgba(15,23,42,0.18)",
                          }}
                          title={manageable ? "Click to edit or delete" : b.label}>
                          <div className="flex items-center gap-0.5 font-semibold leading-tight">
                            <Icon size={8} className="flex-shrink-0" style={{ opacity: 0.9 }} />
                            <span className="truncate">{b.label}</span>
                          </div>
                          {dur >= 45 && <div className="leading-tight" style={{ opacity: 0.85, fontSize: 8 }}>{b.start}–{b.end}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </Card>
      {visibleBlocks.length === 0 ? (
        <Card className="mt-3 text-center py-6" style={{ borderStyle: "dashed", borderColor: "#E4DEF7", background: "#FCFAFF" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: C.purpleSoft }}>
            <CalendarClock size={16} color={C.purple} />
          </div>
          <div className="text-sm font-semibold" style={{ color: "#1E293B" }}>Your week is wide open</div>
          <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{isAdmin ? "Schedule a recurring class above to fill in the grid." : "Add a self-study block above to start planning your week."}</div>
        </Card>
      ) : (
        <div className="text-xs mt-2" style={{ color: "#94A3B8" }}>
          {isAdmin ? "Click a class block to edit or delete it." : "Click your own self-study blocks to edit or delete them."}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Tasks (shared) ------------------------------ */

function TasksView({ data, setData, editable }) {
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", courseId: data.courses[0]?.id || "", due: "", priority: "medium" });

  const addTask = () => {
    if (!form.title.trim()) return;
    // Admin-assigned tasks are shared with everyone (no owner); a student's own task is tagged to them.
    const ownerKey = editable ? null : data.session;
    setData((d) => logActivity({ ...d, tasks: [...d.tasks, { id: uid(), ...form, status: "todo", ownerKey }] }, `Task added: ${form.title}`));
    setForm({ ...form, title: "", due: "" });
  };
  const cycleStatus = (id) => {
    const order = ["todo", "in-progress", "done"];
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === id ? { ...t, status: order[(order.indexOf(t.status) + 1) % order.length] } : t) }));
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const removeTask = (id) => {
    const item = data.tasks.find((t) => t.id === id);
    setData((d) => moveToTrash({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }, "task", item, `Task: ${item?.title || "task"}`));
  };

  const courseCode = (id) => data.courses.find((c) => c.id === id)?.code || "—";
  const priColor = { high: C.red, medium: C.amber, low: C.green };
  // Students only ever see admin-assigned (shared) tasks plus their own — never another student's personal tasks.
  const scoped = editable ? data.tasks : data.tasks.filter((t) => !t.ownerKey || t.ownerKey === data.session);
  const filtered = scoped.filter((t) => filter === "all" || (filter === "pending" ? t.status !== "done" : t.status === "done"))
    .sort((a, b) => (a.status === "done") - (b.status === "done") || new Date(a.due || "2100-01-01") - new Date(b.due || "2100-01-01"));

  return (
    <div>
      {deleteModal}
      <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1 w-fit mb-4">
        {["all", "pending", "completed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-md capitalize ${filter === f ? "text-white" : "text-[#64748B]"}`} style={filter === f ? { background: C.purple } : {}}>{f}</button>
        ))}
      </div>

      <Card className="mb-4">
        <div className="text-xs font-semibold text-[#94A3B8] mb-2">{editable ? "ASSIGN A TASK / DEADLINE" : "ADD A TASK"}</div>
        <div className="grid sm:grid-cols-5 gap-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" className="sm:col-span-2 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm" />
          <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
            {data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
          <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm" />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </div>
        <button onClick={addTask} className="mt-3 flex items-center gap-1 text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Add Task</button>
      </Card>

      <div className="space-y-2">
        {filtered.map((t) => (
          <Card key={t.id} className="flex items-center justify-between !py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => cycleStatus(t.id)} className="w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0"
                style={t.status === "done" ? { background: C.green, borderColor: C.green } : t.status === "in-progress" ? { background: C.amber, borderColor: C.amber } : { borderColor: C.border }}>
                {t.status === "done" && <Check size={14} className="text-white" />}
              </button>
              <div>
                <div className={`text-sm ${t.status === "done" ? "line-through text-[#B0B8C6]" : ""}`}>{t.title}</div>
                <div className="text-xs text-[#94A3B8]">{courseCode(t.courseId)} {t.due && `· Due ${fmt(t.due)}`}{editable && t.ownerKey && ` · ${data.profiles[t.ownerKey]?.name || "Student"}'s task`}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge color={priColor[t.priority]}>{t.priority}</Badge>
              {editable && t.ownerKey && <Badge color={C.green}>Personal</Badge>}
              <button onClick={() => confirmDelete(`Task "${t.title}"`, () => removeTask(t.id))} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={15} /></button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="text-sm text-[#94A3B8]">Nothing here.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Datesheet (admin) ------------------------------ */

function DatesheetView({ data, setData }) {
  const fileRef = useRef();
  const [form, setForm] = useState({ title: "", examType: "ST", date: "", courseId: "" });
  const [pendingFile, setPendingFile] = useState(null);

  const onFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 25_000_000) { alert("File is too large (limit 25MB)."); setPendingFile({ name: f.name, type: f.type, dataUrl: null }); return; }
    const { url: dataUrl } = await uploadAttachment(f); // "dataUrl" name kept for compatibility; it's a real Storage URL now
    setPendingFile({ name: f.name, type: f.type, dataUrl });
  };

  const upload = () => {
    if (!form.title.trim() || !form.date) return;
    const ds = { id: uid(), ...form, fileName: pendingFile?.name, fileType: pendingFile?.type, dataUrl: pendingFile?.dataUrl, uploadedAt: new Date().toISOString() };
    setData((d) => {
      let next = { ...d, datesheets: [...d.datesheets, ds] };
      if (d.autoMode) {
        const blocks = generateRecommendedBlocks(ds, next.courses, next.plannerBlocks);
        next = { ...next, plannerBlocks: [...next.plannerBlocks, ...blocks] };
        next = logActivity(next, `Datesheet uploaded: ${ds.title} — timetable auto-generated`);
      } else {
        next = logActivity(next, `Datesheet uploaded: ${ds.title}`);
      }
      return next;
    });
    setForm({ title: "", examType: "ST", date: "", courseId: "" });
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const remove = (id) => {
    const item = data.datesheets.find((x) => x.id === id);
    confirmDelete(`Datesheet "${item?.title || "datesheet"}" (its auto-generated timetable entries will also be removed)`, () => {
      setData((d) => moveToTrash({ ...d, datesheets: d.datesheets.filter((x) => x.id !== id), plannerBlocks: d.plannerBlocks.filter((b) => b.sourceId !== id) }, "datesheet", item, `Datesheet: ${item?.title || "datesheet"}`));
    });
  };

  const toggleAuto = () => setData((d) => ({ ...d, autoMode: !d.autoMode }));

  return (
    <div>
      {deleteModal}
      <Card className="mb-4 flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Wand2 size={20} /></div>
        <div className="flex-1">
          <div className="font-h font-semibold">Automatic Timetable Generation</div>
          <p className="text-xs text-[#64748B] mt-0.5">When Auto Mode is on, saving a datesheet immediately generates a recommended revision week; if the exam is still further out, the plan also auto-fills once it enters the 7-day window on your next visit.</p>
        </div>
        <button onClick={toggleAuto} className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: data.autoMode ? "#DCFCE7" : "#FEE2E2", color: data.autoMode ? "#166534" : "#991B1B" }}>
          Auto Mode: {data.autoMode ? "ON" : "OFF"}
        </button>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="font-h font-semibold mb-3">Upload Datesheet (ST / PUT / External)</div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title, e.g. DBMS Sessional Test 1" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm w-full mb-2" />
          <div className="grid grid-cols-3 gap-2 mb-2">
            <select value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm"><option>ST</option><option>PUT</option><option>External</option></select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm" />
            <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
              <option value="">All subjects</option>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </div>
          <label className="border border-dashed border-[#D8D2C2] rounded-lg flex flex-col items-center justify-center gap-1 py-6 cursor-pointer text-center mb-3 hover:bg-[#F8F8FB]">
            <Upload size={20} style={{ color: C.purple }} />
            <span className="text-sm font-medium">{pendingFile ? pendingFile.name : "Upload Datesheet (PDF / Image)"}</span>
            <span className="text-xs text-[#94A3B8]">Supported: PDF, JPG, PNG (max ~1MB)</span>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onFile} />
          </label>
          <button onClick={upload} className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}>Save Datesheet</button>
        </Card>

        <Card>
          <div className="font-h font-semibold mb-3">Recent Uploads</div>
          <div className="space-y-2">
            {[...data.datesheets].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).map((ds) => {
              const generated = data.plannerBlocks.some((b) => b.sourceId === ds.id);
              return (
                <div key={ds.id} className="flex items-center justify-between text-sm border-b border-[#F1F0F5] pb-2">
                  <div>
                    <div className="font-medium">{ds.title}</div>
                    <div className="text-xs text-[#94A3B8]">{ds.examType} · exam {fmtFull(ds.date)} {generated && "· timetable generated"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ds.dataUrl && <a href={ds.dataUrl} download={ds.fileName} className="text-[#94A3B8] hover:text-[#1E293B]"><Download size={14} /></a>}
                    <button onClick={() => remove(ds.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
            {data.datesheets.length === 0 && <div className="text-sm text-[#94A3B8]">No datesheets uploaded yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Timetables (admin, generated list) ------------------------------ */

function TimetablesView({ data, setData }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ day: "Mon", start: "09:00", end: "10:00", label: "" });

  const regenerate = (ds) => {
    setData((d) => {
      const cleared = { ...d, plannerBlocks: d.plannerBlocks.filter((b) => b.sourceId !== ds.id) };
      const blocks = generateRecommendedBlocks(ds, cleared.courses, cleared.plannerBlocks);
      return logActivity({ ...cleared, plannerBlocks: [...cleared.plannerBlocks, ...blocks] }, `Timetable regenerated for ${ds.title}`);
    });
  };

  const startEdit = (b) => { setEditingId(b.id); setEditForm({ day: b.day, start: b.start, end: b.end, label: b.label }); };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = (id) => {
    if (!editForm.label.trim()) return;
    setData((d) => logActivity({ ...d, plannerBlocks: d.plannerBlocks.map((b) => b.id === id ? { ...b, ...editForm, label: editForm.label.trim() } : b) }, `Timetable entry edited: ${editForm.label.trim()}`));
    setEditingId(null);
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const deleteBlock = (id, label) => {
    const item = data.plannerBlocks.find((b) => b.id === id);
    confirmDelete(`Timetable entry "${label}"`, () => {
      setData((d) => moveToTrash({ ...d, plannerBlocks: d.plannerBlocks.filter((b) => b.id !== id) }, "plannerBlock", item, `Timetable entry: ${label}`));
      if (editingId === id) setEditingId(null);
    });
  };
  const addBlock = (ds) => {
    const course = data.courses.find((c) => c.id === ds.courseId) || data.courses[0];
    const newBlock = {
      id: uid(), day: "Mon", start: "09:00", end: "10:00", label: course ? `${course.code} revision` : "Revision session",
      courseId: course?.id || "", color: course?.color || C.purple, kind: "recommended", sourceId: ds.id, examDate: ds.date,
    };
    setData((d) => logActivity({ ...d, plannerBlocks: [...d.plannerBlocks, newBlock] }, `Timetable entry added: ${newBlock.label}`));
    startEdit(newBlock);
  };

  return (
    <div className="space-y-4">
      {deleteModal}
      {data.datesheets.length === 0 && <Card><div className="text-sm text-[#94A3B8]">Upload a datesheet first — timetables generate automatically from it.</div></Card>}
      {data.datesheets.map((ds) => {
        const blocks = data.plannerBlocks.filter((b) => b.sourceId === ds.id).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
        const dLeft = daysUntil(ds.date);
        const urgency = dLeft < 0 ? { bg: "#F1F5F9", fg: "#64748B", label: "Past" } : dLeft <= 3 ? { bg: "#FEE2E2", fg: C.red, label: `${dLeft}d left` } : dLeft <= 7 ? { bg: "#FEF3C7", fg: "#B45309", label: `${dLeft}d left` } : { bg: "#ECFDF5", fg: C.green, label: `${dLeft}d left` };
        return (
          <Card key={ds.id} className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ background: "linear-gradient(135deg, #F8F8FB, #FFFFFF)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Wand2 size={17} /></div>
                <div>
                  <div className="font-h font-semibold flex items-center gap-2">{ds.title} <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: urgency.bg, color: urgency.fg }}>{urgency.label}</span></div>
                  <div className="text-xs text-[#94A3B8]">{ds.examType} · {fmtFull(ds.date)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => addBlock(ds)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[#64748B] hover:bg-[#F8F8FB]"><Plus size={13} /> Add entry</button>
                <button onClick={() => regenerate(ds)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: C.purple }}><RefreshCw size={13} /> Regenerate</button>
              </div>
            </div>
            <div className="px-5 pb-5">
            {blocks.length === 0 ? <div className="text-sm text-[#94A3B8]">Not generated yet — it will appear automatically within 7 days of the exam, click Regenerate, or Add entry to build one manually.</div> : (
              <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {blocks.map((b) => (
                  editingId === b.id ? (
                    <div key={b.id} className="rounded-xl p-2.5 text-xs bg-white border-2 shadow-sm" style={{ borderColor: b.color }}>
                      <select value={editForm.day} onChange={(e) => setEditForm({ ...editForm, day: e.target.value })} className="border border-[#E5E7EB] rounded px-1 py-1 text-xs w-full mb-1">
                        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <div className="flex gap-1 mb-1">
                        <input type="time" value={editForm.start} onChange={(e) => setEditForm({ ...editForm, start: e.target.value })} className="border border-[#E5E7EB] rounded px-1 py-1 text-xs w-full" />
                        <input type="time" value={editForm.end} onChange={(e) => setEditForm({ ...editForm, end: e.target.value })} className="border border-[#E5E7EB] rounded px-1 py-1 text-xs w-full" />
                      </div>
                      <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} placeholder="Label" className="border border-[#E5E7EB] rounded px-1 py-1 text-xs w-full mb-1" />
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(b.id)} className="flex-1 text-white text-xs py-1 rounded" style={{ background: C.purple }}>Save</button>
                        <button onClick={cancelEdit} className="flex-1 text-xs py-1 rounded border border-[#E5E7EB]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={b.id} className="relative group rounded-xl p-2.5 text-xs text-white shadow-sm hover:shadow-md transition-shadow" style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}CC)` }}>
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(b)} className="w-5 h-5 rounded bg-black/25 flex items-center justify-center hover:bg-black/40"><Pencil size={11} /></button>
                        <button onClick={() => deleteBlock(b.id, b.label)} className="w-5 h-5 rounded bg-black/25 flex items-center justify-center hover:bg-black/40"><X size={11} /></button>
                      </div>
                      <div className="flex items-center gap-1 font-semibold"><CalendarClock size={11} className="opacity-90" /> {b.day}</div>
                      <div className="opacity-90 mt-0.5">{b.start}–{b.end}</div>
                      <div className="opacity-90 pr-4 mt-0.5 truncate">{b.label}</div>
                    </div>
                  )
                ))}
              </div>
            )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------ Exams & Timetable (student) ------------------------------ */

function ExamsView({ data, setData }) {
  const regenerate = (ds) => {
    setData((d) => {
      const cleared = { ...d, plannerBlocks: d.plannerBlocks.filter((b) => b.sourceId !== ds.id) };
      const blocks = generateRecommendedBlocks(ds, cleared.courses, cleared.plannerBlocks);
      return { ...cleared, plannerBlocks: [...cleared.plannerBlocks, ...blocks] };
    });
  };
  const sorted = [...data.datesheets].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-4">
      {sorted.length === 0 && <Card><div className="text-sm text-[#94A3B8]">No exam datesheets published yet.</div></Card>}
      {sorted.map((ds) => {
        const blocks = data.plannerBlocks.filter((b) => b.sourceId === ds.id).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
        const dLeft = daysUntil(ds.date);
        return (
          <Card key={ds.id}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-h font-semibold">{ds.title}</div>
                <div className="text-xs text-[#94A3B8]">{ds.examType} · {fmtFull(ds.date)}</div>
              </div>
              <Badge color={dLeft <= 7 ? C.red : dLeft <= 15 ? C.amber : C.green}>{dLeft >= 0 ? `${dLeft}d left` : "past"}</Badge>
            </div>
            {ds.dataUrl && <a href={ds.dataUrl} download={ds.fileName} className="text-xs flex items-center gap-1 mb-3" style={{ color: C.purple }}><Download size={12} /> Download datesheet</a>}
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-[#94A3B8]">RECOMMENDED REVISION WEEK</div>
              <button onClick={() => regenerate(ds)} className="flex items-center gap-1 text-xs" style={{ color: C.purple }}><RefreshCw size={12} /> Regenerate</button>
            </div>
            {blocks.length === 0 ? <div className="text-sm text-[#94A3B8]">Will generate automatically 7 days before the exam.</div> : (
              <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-2">
                {blocks.map((b) => (
                  <div key={b.id} className="rounded-lg p-2 text-xs text-white" style={{ background: b.color }}>
                    <div className="font-semibold">{b.day}</div><div>{b.start}–{b.end}</div><div className="opacity-90">{b.label}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------ Co-curricular ------------------------------ */

function AdminCoCurricularView({ data, setData }) {
  const [form, setForm] = useState({ name: "", provider: "Data Discourse", date: "", notes: "" });
  const [newModule, setNewModule] = useState({});
  const add = () => {
    if (!form.name.trim()) return;
    setData((d) => logActivity({ ...d, coCurricularCatalog: [...d.coCurricularCatalog, { id: uid(), ...form }] }, `Co-curricular opportunity posted: ${form.name}`));
    setForm({ ...form, name: "", date: "", notes: "" });
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const remove = (id) => {
    const item = data.coCurricularCatalog.find((c) => c.id === id);
    confirmDelete(`Opportunity "${item?.name || "opportunity"}"`, () => {
      setData((d) => moveToTrash({ ...d, coCurricularCatalog: d.coCurricularCatalog.filter((c) => c.id !== id) }, "coCurricularCatalog", item, `Co-curricular opportunity: ${item?.name || "opportunity"}`));
    });
  };

  const addModule = (enrollId) => {
    const name = (newModule[enrollId] || "").trim();
    if (!name) return;
    setData((d) => logActivity({ ...d, enrollments: d.enrollments.map((e) => e.id === enrollId ? { ...e, units: [...e.units, u(uid(), name)] } : e) }, `Module added to ${data.enrollments.find((e) => e.id === enrollId)?.name}: ${name}`));
    setNewModule((s) => ({ ...s, [enrollId]: "" }));
  };
  const removeModule = (enrollId, unitId) => {
    const enroll = data.enrollments.find((e) => e.id === enrollId);
    const item = enroll?.units.find((u) => u.id === unitId);
    confirmDelete(`Module "${item?.name || "module"}"`, () => {
      setData((d) => moveToTrash({ ...d, enrollments: d.enrollments.map((e) => e.id !== enrollId ? e : { ...e, units: e.units.filter((u) => u.id !== unitId) }) }, "enrollmentModule", item, `Module: ${item?.name || "module"} (${enroll?.name || ""})`, { enrollId }));
    });
  };

  return (
    <div>
      {deleteModal}
      <p className="text-sm text-[#64748B] -mt-4 mb-6">Post clubs, courses (Data Discourse, NPTEL, etc.), or events students can enroll in.</p>
      <Card className="mb-4">
        <div className="text-xs font-semibold text-[#94A3B8] mb-2">POST AN OPPORTUNITY</div>
        <div className="grid sm:grid-cols-4 gap-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="sm:col-span-2 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm" />
          <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
            <option>Data Discourse</option><option>NPTEL</option><option>Club</option><option>Other</option>
          </select>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm" />
        </div>
        <button onClick={add} className="mt-3 flex items-center gap-1 text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Post</button>
      </Card>
      <div className="space-y-2 mb-6">
        {data.coCurricularCatalog.map((c) => (
          <Card key={c.id} className="flex items-center justify-between !py-3">
            <div><div className="text-sm font-medium">{c.name}</div><div className="text-xs text-[#94A3B8]">{c.provider}{c.date && ` · ${fmt(c.date)}`}</div></div>
            <button onClick={() => remove(c.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={15} /></button>
          </Card>
        ))}
        {data.coCurricularCatalog.length === 0 && <div className="text-sm text-[#94A3B8]">Nothing posted yet.</div>}
      </div>

      <div className="text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wide">Student Enrollments — manage modules</div>
      <p className="text-xs text-[#64748B] mb-3">Students enroll themselves, but only you can add or remove the module breakdown each one tracks progress against.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {data.enrollments.map((e) => (
          <Card key={e.id}>
            <div className="flex items-center justify-between mb-1">
              <Badge color={C.purple}>{e.provider}</Badge>
              {e.ownerKey && <span className="text-xs" style={{ color: "#94A3B8" }}>{data.profiles[e.ownerKey]?.name || "Student"}</span>}
            </div>
            <div className="font-h font-semibold text-[15px] my-1.5">{e.name}</div>
            <div className="space-y-1.5 mb-2">
              {e.units.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm group">
                  <span className={u.done ? "line-through text-[#B0B8C6]" : ""}>{u.name}</span>
                  <button onClick={() => removeModule(e.id, u.id)} className="opacity-0 group-hover:opacity-100 text-[#CBD5E1] hover:text-[#EF4444]"><X size={13} /></button>
                </div>
              ))}
              {e.units.length === 0 && <div className="text-xs text-[#94A3B8]">No modules yet.</div>}
            </div>
            <div className="flex gap-2">
              <input value={newModule[e.id] || ""} onChange={(ev) => setNewModule((s) => ({ ...s, [e.id]: ev.target.value }))} placeholder="Add module…" className="flex-1 border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs" />
              <button onClick={() => addModule(e.id)} className="text-xs px-2 py-1.5 rounded-lg text-white" style={{ background: C.purple }}><Plus size={13} /></button>
            </div>
          </Card>
        ))}
        {data.enrollments.length === 0 && <div className="text-sm text-[#94A3B8]">No students have enrolled in anything yet.</div>}
      </div>
    </div>
  );
}

function StudentCoCurricularView({ data, setData }) {
  const [custom, setCustom] = useState({ name: "", provider: "Other" });
  // Only this student's own enrollments — enrollments used to be global and visible to every student.
  const myEnrollments = data.enrollments.filter((e) => !e.ownerKey || e.ownerKey === data.session);

  const enroll = (catalogItem) => {
    if (myEnrollments.some((e) => e.catalogId === catalogItem?.id || (custom.name && e.name === custom.name))) return;
    const item = catalogItem
      ? { id: uid(), catalogId: catalogItem.id, name: catalogItem.name, provider: catalogItem.provider, units: [], ownerKey: data.session }
      : { id: uid(), name: custom.name, provider: custom.provider, units: [], ownerKey: data.session };
    if (!item.name.trim()) return;
    setData((d) => ({ ...d, enrollments: [...d.enrollments, item] }));
    setCustom({ name: "", provider: "Other" });
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const unenroll = (id) => {
    const item = data.enrollments.find((e) => e.id === id);
    confirmDelete(`Your enrollment in "${item?.name || "this"}"`, () => {
      setData((d) => moveToTrash({ ...d, enrollments: d.enrollments.filter((e) => e.id !== id) }, "enrollment", item, `Enrollment: ${item?.name || "enrollment"}`));
    });
  };
  // Modules (the unit-wise breakdown of an enrollment) are added/removed by admin only — students just track their own progress against them.
  const toggleModule = (enrollId, unitId) => setData((d) => ({ ...d, enrollments: d.enrollments.map((e) => e.id !== enrollId ? e : { ...e, units: e.units.map((u) => u.id === unitId ? { ...u, done: !u.done } : u) }) }));

  return (
    <div>
      {deleteModal}
      <p className="text-sm text-[#64748B] -mt-4 mb-6">Enroll in posted opportunities or add your own. Your admin adds the module breakdown; you track your progress against it.</p>

      {data.coCurricularCatalog.length > 0 && (
        <Card className="mb-4">
          <div className="font-h font-semibold mb-3">Available to join</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {data.coCurricularCatalog.map((c) => {
              const enrolled = myEnrollments.some((e) => e.catalogId === c.id);
              return (
                <div key={c.id} className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-3 py-2">
                  <div><div className="text-sm font-medium">{c.name}</div><div className="text-xs text-[#94A3B8]">{c.provider}{c.date && ` · ${fmt(c.date)}`}</div></div>
                  <button disabled={enrolled} onClick={() => enroll(c)} className="text-xs px-2 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: C.purple }}>{enrolled ? "Enrolled" : "Enroll"}</button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="font-h font-semibold mb-2">Add your own</div>
        <div className="flex gap-2">
          <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. Coursera — Data Structures" className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm" />
          <select value={custom.provider} onChange={(e) => setCustom({ ...custom, provider: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
            <option>Data Discourse</option><option>NPTEL</option><option>Club</option><option>Other</option>
          </select>
          <button onClick={() => enroll(null)} className="flex items-center gap-1 text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}><Plus size={14} /></button>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {myEnrollments.map((e) => {
          const done = e.units.filter((u) => u.done).length;
          const pct = e.units.length ? Math.round((done / e.units.length) * 100) : 0;
          return (
            <Card key={e.id}>
              <div className="flex items-center justify-between mb-1">
                <Badge color={C.purple}>{e.provider}</Badge>
                <button onClick={() => unenroll(e.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={14} /></button>
              </div>
              <div className="font-h font-semibold text-[15px] my-1.5">{e.name}</div>
              <div className="h-1.5 bg-[#E5E7EB] rounded mb-3"><div className="h-1.5 rounded" style={{ width: `${pct}%`, background: C.purple }} /></div>
              <div className="text-[11px] font-semibold text-[#94A3B8] mb-1.5">MODULES</div>
              <div className="space-y-1.5">
                {e.units.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={u.done} onChange={() => toggleModule(e.id, u.id)} style={{ accentColor: C.purple }} />
                    <span className={`flex-1 ${u.done ? "line-through text-[#B0B8C6]" : ""}`}>{u.name}</span>
                  </label>
                ))}
                {e.units.length === 0 && <div className="text-xs text-[#94A3B8]">Your admin hasn't added modules for this yet.</div>}
              </div>
            </Card>
          );
        })}
        {myEnrollments.length === 0 && <div className="text-sm text-[#94A3B8]">You haven't enrolled in anything yet.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Announcements (admin write / everyone read) ------------------------------ */

function AnnouncementsView({ data, setData, isAdmin, goTo }) {
  const fileRef = useRef();
  const [form, setForm] = useState({ title: "", message: "" });
  const [pending, setPending] = useState(null); // { name, type, dataUrl }

  const onFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 25_000_000) { alert("That file is larger than 25MB — try a smaller PDF or image."); return; }
    const { url: dataUrl } = await uploadAttachment(f); // "dataUrl" name kept for compatibility; it's a real Storage URL now
    setPending({ name: f.name, type: f.type, dataUrl });
  };
  const clearPending = () => { setPending(null); if (fileRef.current) fileRef.current.value = ""; };

  const add = () => {
    if (!form.title.trim()) return;
    setData((d) => logActivity({ ...d, announcements: [{ id: uid(), ...form, fileName: pending?.name, fileType: pending?.type, dataUrl: pending?.dataUrl, date: new Date().toISOString().slice(0, 10) }, ...d.announcements] }, `Announcement published: ${form.title}`));
    setForm({ title: "", message: "" });
    clearPending();
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const remove = (id) => {
    const item = data.announcements.find((a) => a.id === id);
    confirmDelete(`Announcement "${item?.title || "announcement"}"`, () => {
      setData((d) => moveToTrash({ ...d, announcements: d.announcements.filter((a) => a.id !== id) }, "announcement", item, `Announcement: ${item?.title || "announcement"}`));
    });
  };

  return (
    <div>
      {deleteModal}
      {goTo && (
        <button onClick={() => goTo("dashboard")} className="text-sm font-medium flex items-center gap-1 mb-3" style={{ color: C.purple }}>
          <ChevronLeft size={15} /> Back to Dashboard
        </button>
      )}
      {isAdmin ? (
        <Card className="mb-4">
          <div className="font-h font-semibold mb-2">New announcement</div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm w-full mb-2" />
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" rows={2} className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm w-full mb-2" />
          {pending ? (
            <div className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm mb-2">
              <span className="flex items-center gap-1.5 truncate" style={{ color: C.purple }}>{React.createElement(fileKindIcon(pending.type), { size: 14 })} {pending.name}</span>
              <button onClick={clearPending} className="text-[#CBD5E1] hover:text-[#EF4444] flex-shrink-0"><X size={14} /></button>
            </div>
          ) : (
            <label className="border border-dashed border-[#D8D2C2] rounded-lg flex items-center justify-center gap-2 py-3 cursor-pointer text-center hover:bg-[#F8F8FB] mb-2">
              <Paperclip size={15} style={{ color: C.purple }} />
              <span className="text-xs font-medium">Attach a PDF or image (optional)</span>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={onFile} />
            </label>
          )}
          <button onClick={add} className="text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}>Publish</button>
        </Card>
      ) : (
        <Card className="mb-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Megaphone size={16} /></div>
          <div>
            <div className="font-h font-semibold text-sm">Announcements</div>
            <p className="text-xs text-[#64748B] mt-0.5">Posted by your admins and co-admins. You can view and download any attachments below.</p>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {data.announcements.map((a) => {
          const AttIcon = a.dataUrl ? fileKindIcon(a.fileType || "") : null;
          return (
            <Card key={a.id} className="flex items-start justify-between">
              <div>
                <div className="font-medium text-sm">{a.title}</div>
                <div className="text-xs text-[#64748B] mt-1">{a.message}</div>
                {a.dataUrl && (
                  <div className="inline-flex items-center gap-2 mt-1.5">
                    <button type="button" onClick={() => openAttachment(a.dataUrl, a.fileName, a.fileType)} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: C.purple }}>
                      <AttIcon size={13} /> {a.fileName}
                    </button>
                    <a href={a.dataUrl} download={a.fileName} title="Download" className="text-[#94A3B8] hover:text-[#1E293B]"><Download size={12} /></a>
                  </div>
                )}
                <div className="text-[10px] text-[#94A3B8] mt-1">{fmt(a.date)}</div>
              </div>
              {isAdmin && <button onClick={() => remove(a.id)} className="text-[#CBD5E1] hover:text-[#EF4444] flex-shrink-0"><Trash2 size={15} /></button>}
            </Card>
          );
        })}
        {data.announcements.length === 0 && <div className="text-sm text-[#94A3B8]">No announcements yet.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Resources (shared, real file upload) ------------------------------ */

function ResourcesView({ data, setData }) {
  const fileRef = useRef();
  const [mode, setMode] = useState("file");
  const [form, setForm] = useState({ title: "", url: "", courseId: "" });
  const [pending, setPending] = useState(null);

  const onFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 25_000_000) { alert("That file is larger than 25MB — please paste a link instead (e.g. Google Drive)."); return; }
    const { url: dataUrl } = await uploadAttachment(f); // "dataUrl" name kept for compatibility; it's a real Storage URL now
    setPending({ name: f.name, type: f.type, dataUrl });
  };

  const add = () => {
    if (mode === "file") {
      if (!pending) return;
      setData((d) => logActivity({ ...d, resources: [...d.resources, { id: uid(), title: form.title || pending.name, fileName: pending.name, fileType: pending.type, dataUrl: pending.dataUrl, courseId: form.courseId || null }] }, `Resource uploaded: ${form.title || pending.name}`));
      setPending(null); if (fileRef.current) fileRef.current.value = "";
    } else {
      if (!form.title.trim() || !form.url.trim()) return;
      setData((d) => logActivity({ ...d, resources: [...d.resources, { id: uid(), title: form.title, url: form.url, courseId: form.courseId || null }] }, `Resource linked: ${form.title}`));
    }
    setForm({ title: "", url: "", courseId: "" });
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const remove = (id) => {
    const item = data.resources.find((r) => r.id === id);
    confirmDelete(`Resource "${item?.title || "resource"}"`, () => {
      setData((d) => moveToTrash({ ...d, resources: d.resources.filter((r) => r.id !== id) }, "resource", item, `Resource: ${item?.title || "resource"}`));
    });
  };
  const courseCode = (id) => data.courses.find((c) => c.id === id)?.code;

  return (
    <div>
      {deleteModal}
      <Card className="mb-4">
        <div className="flex gap-1 bg-[#F8F8FB] rounded-lg p-1 w-fit mb-3">
          {["file", "link"].map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`text-xs px-3 py-1.5 rounded-md capitalize ${mode === m ? "bg-white shadow-sm font-medium" : "text-[#64748B]"}`}>{m === "file" ? "Upload file" : "Paste link"}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mb-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (optional for file)" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm" />
          <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm">
            <option value="">General (no subject)</option>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </div>
        {mode === "file" ? (
          <label className="border border-dashed border-[#D8D2C2] rounded-lg flex flex-col items-center justify-center gap-1 py-6 cursor-pointer text-center hover:bg-[#F8F8FB]">
            <Upload size={20} style={{ color: C.purple }} />
            <span className="text-sm font-medium">{pending ? pending.name : "Click to choose a file"}</span>
            <span className="text-xs text-[#94A3B8]">PDF, PPT, DOC, XLS, images — up to ~1MB</span>
            <input ref={fileRef} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt" className="hidden" onChange={onFile} />
          </label>
        ) : (
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm w-full" />
        )}
        <button onClick={add} className="mt-3 flex items-center gap-1 text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Add resource</button>
      </Card>

      <div className="space-y-2">
        {data.resources.map((r) => {
          const Icon = fileKindIcon(r.fileType || "");
          return (
            <Card key={r.id} className="flex items-center justify-between !py-3">
              {/* Clicking the title now views/previews the file (was silently blocked before, since
                  browsers refuse to navigate a top-level tab straight to a data: URL); the separate
                  Download icon covers anyone who wants to save it. */}
              {r.dataUrl ? (
                <button type="button" onClick={() => openAttachment(r.dataUrl, r.fileName || r.title, r.fileType)} className="flex items-center gap-2 text-sm" style={{ color: C.purple }}>
                  <Icon size={15} /> {r.title}{r.courseId && <span className="text-xs text-[#94A3B8]">· {courseCode(r.courseId)}</span>}
                </button>
              ) : (
                <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm" style={{ color: C.purple }}>
                  <Icon size={15} /> {r.title}{r.courseId && <span className="text-xs text-[#94A3B8]">· {courseCode(r.courseId)}</span>}
                </a>
              )}
              <div className="flex items-center gap-2">
                {r.dataUrl && <a href={r.dataUrl} download={r.fileName} title="Download" className="text-[#94A3B8] hover:text-[#1E293B]"><Download size={14} /></a>}
                <button onClick={() => remove(r.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={15} /></button>
              </div>
            </Card>
          );
        })}
        {data.resources.length === 0 && <div className="text-sm text-[#94A3B8]">No resources saved yet.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Progress (shared) ------------------------------ */

function ProgressView({ data, setData, isAdmin = false }) {
  // Students only see their own logged sessions; a log without an owner is legacy/shared data from before per-student tracking.
  const myLogs = isAdmin ? data.studyLogs : data.studyLogs.filter((l) => !l.ownerKey || l.ownerKey === data.session);
  const totalTopics = data.courses.reduce((s, c) => s + c.units.length, 0);
  const doneTopics = data.courses.reduce((s, c) => s + c.units.filter((u) => u.done).length, 0);
  const overallPct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;
  const chartData = data.courses.map((c) => ({ code: c.code, hours: +(myLogs.filter((l) => l.courseId === c.id).reduce((s, l) => s + l.minutes, 0) / 60).toFixed(1) }));
  const streak = useStreak(myLogs);
  const [logForm, setLogForm] = useState({ courseId: data.courses[0]?.id || "", minutes: 30 });
  const logSession = () => setData((d) => ({ ...d, studyLogs: [...d.studyLogs, { id: uid(), courseId: logForm.courseId, minutes: Number(logForm.minutes), date: new Date().toISOString().slice(0, 10), ownerKey: d.session }] }));

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4">
      <div className="space-y-4">
        <Card>
          <div className="font-h font-semibold mb-3">Hours studied per subject</div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F0F5" /><XAxis dataKey="code" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                <Bar dataKey="hours" fill={C.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Subject-wise progress</div>
          <div className="space-y-3">
            {data.courses.map((c) => {
              const done = c.units.filter((u) => u.done).length; const pct = c.units.length ? Math.round((done / c.units.length) * 100) : 0;
              return <div key={c.id}><div className="flex justify-between text-xs mb-1"><span className="font-mono text-[#64748B]">{c.code}</span><span className="text-[#64748B]">{pct}%</span></div><div className="h-2 bg-[#E5E7EB] rounded"><div className="h-2 rounded" style={{ width: `${pct}%`, background: c.color }} /></div></div>;
            })}
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <div className="text-xs font-semibold text-[#94A3B8] mb-2">OVERALL PROGRESS</div>
          <div className="flex flex-col items-center"><Donut pct={overallPct} size={120} /><div className="font-h text-xl font-semibold -mt-16">{overallPct}%</div></div>
          <div className="text-center text-xs text-[#64748B] mt-8">Great job! Keep going 🚀</div>
        </Card>
        <Card><div className="flex items-center gap-2 mb-1"><Flame size={16} className="text-[#EF4444]" /><span className="font-h font-semibold">{streak} Days</span></div><div className="text-xs text-[#94A3B8]">Current streak</div></Card>
        {isAdmin ? (
          <Card>
            <div className="text-xs font-semibold text-[#94A3B8] mb-1">VIEW ONLY</div>
            <div className="text-xs text-[#64748B]">This shows the student's progress. Completion is marked by the student themselves — admins can view it here, and can add, remove, or hide subjects/units from Subjects.</div>
          </Card>
        ) : (
          <Card>
            <div className="text-xs font-semibold text-[#94A3B8] mb-2">LOG A SESSION</div>
            <select value={logForm.courseId} onChange={(e) => setLogForm({ ...logForm, courseId: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm w-full mb-2">{data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
            <div className="flex gap-2"><input type="number" min="5" step="5" value={logForm.minutes} onChange={(e) => setLogForm({ ...logForm, minutes: e.target.value })} className="border border-[#E5E7EB] rounded-lg px-2 py-2 text-sm w-20" /><button onClick={logSession} className="flex items-center gap-1 text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Log</button></div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ============================= ADMIN ============================= */

function AdminDashboard({ data, setData, goTo }) {
  const upcomingDatesheets = [...data.datesheets].map((e) => ({ ...e, dLeft: daysUntil(e.date) })).filter((e) => e.dLeft >= 0).sort((a, b) => a.dLeft - b.dLeft);
  const pendingTasks = data.tasks.filter((t) => t.status !== "done").length;
  const monthEvents = data.calendarEvents.filter((e) => new Date(e.date).getMonth() === new Date().getMonth()).length;

  const stats = [
    { label: "Subjects", value: data.courses.length, icon: BookOpen, color: C.purple },
    { label: "Upcoming Exams", value: upcomingDatesheets.length, icon: ClipboardList, color: C.amber },
    { label: "Pending Tasks", value: pendingTasks, icon: ListChecks, color: C.red },
    { label: "Events This Month", value: monthEvents, icon: CalendarDays, color: C.green },
  ];

  const toggleAuto = () => setData((d) => ({ ...d, autoMode: !d.autoMode }));

  const taskChart = useMemo(() => {
    const start = new Date(); const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(start); d.setDate(start.getDate() - i); days.push(d); }
    return days.map((d) => ({ day: d.toLocaleDateString("en-IN", { weekday: "short" }), done: data.tasks.filter((t) => t.status === "done" && t.due === d.toISOString().slice(0, 10)).length }));
  }, [data.tasks]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}><div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${s.color}1A`, color: s.color }}><s.icon size={17} /></div><div className="font-h text-xl font-semibold">{s.value}</div><div className="text-xs text-[#64748B] mt-0.5">{s.label}</div></Card>
        ))}
      </div>

      <Card className="mb-6 flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Wand2 size={20} /></div>
        <div className="flex-1">
          <div className="font-h font-semibold">Automatic Timetable Generation</div>
          <p className="text-xs text-[#64748B] mt-0.5">Timetable is generated automatically the week before each ST / PUT if not generated manually.</p>
        </div>
        <button onClick={toggleAuto} className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: data.autoMode ? "#DCFCE7" : "#FEE2E2", color: data.autoMode ? "#166534" : "#991B1B" }}>Auto Mode: {data.autoMode ? "ON" : "OFF"}</button>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="font-h font-semibold mb-3">Upcoming Dates Overview</div>
          <div className="space-y-2">
            {upcomingDatesheets.slice(0, 5).map((ds) => (
              <div key={ds.id} className="flex items-center justify-between text-sm">
                <div><div>{ds.title}</div><div className="text-xs text-[#94A3B8]">{fmt(ds.date)}</div></div>
                <Badge color={ds.dLeft <= 7 ? C.red : C.amber}>In {ds.dLeft} Days</Badge>
              </div>
            ))}
            {upcomingDatesheets.length === 0 && <div className="text-sm text-[#94A3B8]">None yet.</div>}
          </div>
          <button onClick={() => goTo("calendar")} className="text-xs mt-3" style={{ color: C.purple }}>View Full Calendar →</button>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Datesheet & Timetable</div>
          <p className="text-xs text-[#64748B] mb-3">Upload a datesheet and the recommended revision week generates automatically.</p>
          <button onClick={() => goTo("datesheet")} className="text-sm text-white px-3 py-2 rounded-lg w-full mb-2" style={{ background: C.purple }}>Upload Datesheet</button>
          <button onClick={() => goTo("timetables")} className="text-sm px-3 py-2 rounded-lg w-full border border-[#E5E7EB]">View Generated Timetables</button>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Recent Activity</div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.activityLog.slice(0, 6).map((a) => (
              <div key={a.id} className="text-xs"><div className="text-[#1E293B]">{a.text}</div><div className="text-[#94A3B8]">{new Date(a.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div></div>
            ))}
            {data.activityLog.length === 0 && <div className="text-sm text-[#94A3B8]">No activity yet.</div>}
          </div>
        </Card>
      </div>

      <Card>
        <div className="font-h font-semibold mb-3">Task Completion (last 7 days)</div>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer><BarChart data={taskChart}><XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Bar dataKey="done" fill={C.purple} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Settings ------------------------------ */

/** Dedicated "Manage Students" page — add/remove student accounts, tag each
 *  student with a curriculum/elective interest, and filter the roster by it.
 *  This is the nav-bar home for account add/delete; Settings keeps only the
 *  ID/password reset controls. */
function AdminStudentsView({ data, setData, onViewStudent }) {
  const isDirector = data.profiles[data.session]?.role === "admin";
  const isHOD = isAdminKey(data.session, data.profiles) && !isDirector;
  const myDeptId = isHOD ? (data.profiles[data.session]?.departmentId || data.departments[0]?.id) : null;
  const canManageStudent = (key) => isDirector || (isHOD && (data.profiles[key]?.departmentId || data.departments[0]?.id) === myDeptId);
  const studentKeys = useMemo(() => Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles)), [data.profiles]);

  const [deptTab, setDeptTab] = useState(isHOD ? myDeptId : "all");
  const [newStudent, setNewStudent] = useState({ name: "", id: "", password: "", departmentId: isHOD ? myDeptId : (data.departments[0]?.id || DEFAULT_DEPT_ID) });
  const [newStudentError, setNewStudentError] = useState("");

  const [search, setSearch] = useState("");

  const [removeTarget, setRemoveTarget] = useState(null); // student key pending confirmation

  // Quick activity summary per student — enrollments, tasks, logged study time, self-study blocks — for the roster row.
  const summaryFor = (key) => {
    const enrollCount = data.enrollments.filter((e) => e.ownerKey === key).length;
    const myTasks = data.tasks.filter((t) => t.ownerKey === key);
    const taskDone = myTasks.filter((t) => t.status === "done").length;
    const studyMinutes = data.studyLogs.filter((l) => l.ownerKey === key).reduce((s, l) => s + l.minutes, 0);
    const selfBlocks = data.plannerBlocks.filter((b) => b.kind === "self" && b.ownerKey === key).length;
    return { enrollCount, taskDone, taskTotal: myTasks.length, studyHours: +(studyMinutes / 60).toFixed(1), selfBlocks };
  };

  const filteredKeys = studentKeys.filter((key) => {
    const profile = data.profiles[key] || {};
    const studentDept = profile.departmentId || data.departments[0]?.id;
    if (isHOD && studentDept !== myDeptId) return false; // HOD never sees another department's students, full stop
    if (isDirector && deptTab !== "all" && studentDept !== deptTab) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const idMatch = (data.profiles[key]?.email || "").toLowerCase().includes(q);
      const nameMatch = (profile.name || "").toLowerCase().includes(q);
      if (!idMatch && !nameMatch) return false;
    }
    return true;
  });

  const addStudent = () => {
    // Students now sign themselves up (real accounts) — admin can no longer mint a
    // login here. This button assigns/reassigns an ALREADY-signed-up user's department.
  };

  const performRemove = (key) => {
    if (studentKeys.length <= 1) { setNewStudentError("At least one student account must remain."); setRemoveTarget(null); return; }
    // Deleting a real auth account needs Supabase's admin API (service-role key), which
    // must never live in frontend code — so "remove" here means deactivate: the account
    // can no longer sign in, but nothing is destroyed. A super-admin can permanently
    // delete the underlying auth user later from Supabase Dashboard → Authentication.
    updateProfile(key, { active: false }).then(({ error }) => {
      if (!error) setData((d) => logActivity(d, `Student account deactivated: ${d.profiles[key]?.name || key}`));
    });
    setRemoveTarget(null);
  };

  const removeTargetProfile = removeTarget ? data.profiles[removeTarget] : null;

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={!!removeTarget}
        title="Deactivate this student account?"
        message={`${removeTargetProfile?.name || "This student"} won't be able to log in anymore. Their planner, tasks and progress data stay intact and can be restored by reactivating the account from Supabase later.`}
        confirmLabel="Deactivate account"
        onConfirm={() => performRemove(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
      />

      {isDirector && data.departments.length > 1 && (
        <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1 w-fit flex-wrap">
          <button onClick={() => setDeptTab("all")} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === "all" ? "text-white" : "text-[#64748B]"}`} style={deptTab === "all" ? { background: C.purple } : {}}>All Departments</button>
          {data.departments.map((dp) => (
            <button key={dp.id} onClick={() => setDeptTab(dp.id)} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === dp.id ? "text-white" : "text-[#64748B]"}`} style={deptTab === dp.id ? { background: C.purple } : {}}>
              {dp.name}
            </button>
          ))}
        </div>
      )}
      {isHOD && data.departments.length > 1 && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] w-fit" style={{ color: "#1E293B" }}>
          <b>{deptName(data, myDeptId)}</b> <span style={{ color: "#94A3B8" }}>— you only see students in your own department</span>
        </div>
      )}

      {(isDirector || deptTab === myDeptId) && (
        <Card>
          <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#1E293B" }}><GraduationCap size={13} /> STUDENTS SIGN UP THEMSELVES</div>
          <p className="text-xs" style={{ color: "#94A3B8" }}>Share the app link — new students create their own login. Once they've signed up, assign their department from the roster below (each row has a department picker).</p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#1E293B" }}><Users2 size={13} /> STUDENT ROSTER ({filteredKeys.length}/{studentKeys.length})</div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#94A3B8" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID" className="border border-[#E5E7EB] rounded-lg pl-7 pr-2 py-1.5 text-xs w-40" />
          </div>
        </div>

        <div className="space-y-3">
          {filteredKeys.map((key) => {
            const profile = data.profiles[key] || { name: "Student", photo: null };
            const s = summaryFor(key);
            const manageable = canManageStudent(key);
            return (
              <div key={key} className="border border-[#E5E7EB] rounded-lg p-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden" style={{ background: "#10B981" }}>
                    {profile.photo
                      ? <img src={profile.photo} alt="" className="w-full h-full object-cover" />
                      : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "#1E293B" }}>{profile.name || "Student"}</div>
                    <div className="text-xs truncate" style={{ color: "#94A3B8" }}>{profile.email}</div>
                  </div>
                  {manageable && data.departments.length > 1 && (
                    <select
                      value={profile.departmentId || data.departments[0]?.id}
                      onChange={(e) => updateProfile(key, { departmentId: e.target.value })}
                      className="text-xs border border-[#E5E7EB] rounded-lg px-2 py-1 flex-shrink-0"
                    >
                      {data.departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                    </select>
                  )}
                  {manageable ? (
                    <>
                      <button onClick={() => setRemoveTarget(key)} className="text-[#CBD5E1] hover:text-[#EF4444] flex-shrink-0" title="Deactivate this student account"><Trash2 size={15} /></button>
                    </>
                  ) : (
                    <span className="text-[10px] flex-shrink-0" style={{ color: "#94A3B8" }}>view only</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F1F5F9]">
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: C.purpleSoft, color: C.purple }}>{s.enrollCount} enrollment{s.enrollCount === 1 ? "" : "s"}</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#ECFDF5", color: C.green }}>{s.taskDone}/{s.taskTotal} tasks done</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#FEF3C7", color: "#B45309" }}>{s.studyHours}h studied</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#EFF6FF", color: "#2563EB" }}>{s.selfBlocks} planner block{s.selfBlocks === 1 ? "" : "s"}</span>
                  <button onClick={() => onViewStudent && onViewStudent(key)} className="ml-auto text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Eye size={13} /> View full activity</button>
                </div>
              </div>
            );
          })}
          {filteredKeys.length === 0 && <div className="text-sm text-[#94A3B8]">No students match this filter.</div>}
        </div>
      </Card>
    </div>
  );
}

/** Full per-student record: enrollments, study progress, tasks and planner —
 *  opened by tapping "View full activity" on a student in AdminStudentsView.
 *  Admin can delete individual records here (deleting the account itself still
 *  requires the confirm modal over on the roster page). */
function AdminStudentDetailView({ data, setData, studentKey, goTo }) {
  const profile = studentKey ? data.profiles[studentKey] : null;
  const [confirmDelete, deleteModal] = useDeleteConfirm();

  if (!profile) {
    return (
      <div className="space-y-4">
        <Card><p className="text-sm text-[#64748B]">No student selected. Go back to Manage Students and choose one to view.</p></Card>
        <button onClick={() => goTo("students")} className="text-sm font-medium flex items-center gap-1" style={{ color: C.purple }}><ChevronLeft size={15} /> Back to Manage Students</button>
      </div>
    );
  }

  const enrollments = data.enrollments.filter((e) => e.ownerKey === studentKey);
  const tasks = data.tasks.filter((t) => t.ownerKey === studentKey);
  const sharedTasks = data.tasks.filter((t) => !t.ownerKey);
  const studyLogs = [...data.studyLogs.filter((l) => l.ownerKey === studentKey)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const selfBlocks = data.plannerBlocks.filter((b) => b.kind === "self" && b.ownerKey === studentKey);
  const totalMinutes = studyLogs.reduce((s, l) => s + l.minutes, 0);

  const courseCode = (id) => data.courses.find((c) => c.id === id)?.code || "—";
  const priColor = { high: C.red, medium: C.amber, low: C.green };

  const removeEnrollment = (id) => {
    const item = data.enrollments.find((e) => e.id === id);
    confirmDelete(`Enrollment "${item?.name || "enrollment"}"`, () => {
      setData((d) => moveToTrash({ ...d, enrollments: d.enrollments.filter((e) => e.id !== id) }, "enrollment", item, `Enrollment: ${item?.name || "enrollment"}`));
    });
  };
  const removeStudyLog = (id) => {
    const item = data.studyLogs.find((l) => l.id === id);
    confirmDelete(`This study log entry (${item?.minutes || 0} min)`, () => {
      setData((d) => moveToTrash({ ...d, studyLogs: d.studyLogs.filter((l) => l.id !== id) }, "studyLog", item, `Study log: ${item?.minutes || 0} min on ${courseCode(item?.courseId)}`));
    });
  };
  const removeTask = (id) => {
    const item = data.tasks.find((t) => t.id === id);
    confirmDelete(`Task "${item?.title || "task"}"`, () => {
      setData((d) => moveToTrash({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }, "task", item, `Task: ${item?.title || "task"}`));
    });
  };
  const cycleTaskStatus = (id) => {
    const order = ["todo", "in-progress", "done"];
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === id ? { ...t, status: order[(order.indexOf(t.status) + 1) % order.length] } : t) }));
  };
  const removeBlock = (id) => {
    const item = data.plannerBlocks.find((b) => b.id === id);
    confirmDelete(`Planner block "${item?.label || "block"}"`, () => {
      setData((d) => moveToTrash({ ...d, plannerBlocks: d.plannerBlocks.filter((b) => b.id !== id) }, "plannerBlock", item, `Planner block: ${item?.label || "block"}`));
    });
  };

  return (
    <div className="space-y-5">
      {deleteModal}
      <button onClick={() => goTo("students")} className="text-sm font-medium flex items-center gap-1" style={{ color: C.purple }}><ChevronLeft size={15} /> Back to Manage Students</button>

      <Card>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 overflow-hidden" style={{ background: "#10B981" }}>
            {profile.photo ? <img src={profile.photo} alt="" className="w-full h-full object-cover" /> : (profile.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-h font-semibold text-lg" style={{ color: "#1E293B" }}>{profile.name || "Student"}</div>
            <div className="text-xs" style={{ color: "#94A3B8" }}>{profile.email} · {deptName(data, profile.departmentId || data.departments[0]?.id)}</div>
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-4 gap-3">
        <Card className="!p-3 text-center"><div className="font-h text-xl font-semibold" style={{ color: C.purple }}>{enrollments.length}</div><div className="text-[11px]" style={{ color: "#94A3B8" }}>Co-curricular enrollments</div></Card>
        <Card className="!p-3 text-center"><div className="font-h text-xl font-semibold" style={{ color: C.green }}>{tasks.filter((t) => t.status === "done").length}/{tasks.length}</div><div className="text-[11px]" style={{ color: "#94A3B8" }}>Personal tasks done</div></Card>
        <Card className="!p-3 text-center"><div className="font-h text-xl font-semibold" style={{ color: "#B45309" }}>{(totalMinutes / 60).toFixed(1)}h</div><div className="text-[11px]" style={{ color: "#94A3B8" }}>Study time logged</div></Card>
        <Card className="!p-3 text-center"><div className="font-h text-xl font-semibold" style={{ color: "#2563EB" }}>{selfBlocks.length}</div><div className="text-[11px]" style={{ color: "#94A3B8" }}>Self-study blocks</div></Card>
      </div>

      <Card>
        <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#1E293B" }}><Users2 size={13} /> CO-CURRICULAR ENROLLMENTS</div>
        <div className="space-y-2">
          {enrollments.map((e) => {
            const done = e.units.filter((u) => u.done).length;
            const pct = e.units.length ? Math.round((done / e.units.length) * 100) : 0;
            return (
              <div key={e.id} className="border border-[#E5E7EB] rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-xs" style={{ color: "#94A3B8" }}>{e.provider} · {done}/{e.units.length} modules ({pct}%)</div>
                </div>
                <button onClick={() => removeEnrollment(e.id)} className="text-[#CBD5E1] hover:text-[#EF4444] flex-shrink-0"><Trash2 size={14} /></button>
              </div>
            );
          })}
          {enrollments.length === 0 && <div className="text-sm text-[#94A3B8]">Not enrolled in anything yet.</div>}
        </div>
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#1E293B" }}><TrendingUp size={13} /> STUDY LOG ({(totalMinutes / 60).toFixed(1)}h total)</div>
        <div className="space-y-1.5">
          {studyLogs.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm py-1">
              <span>{courseCode(l.courseId)} · {l.minutes} min · {fmt(l.date)}</span>
              <button onClick={() => removeStudyLog(l.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={13} /></button>
            </div>
          ))}
          {studyLogs.length === 0 && <div className="text-sm text-[#94A3B8]">No study sessions logged yet.</div>}
        </div>
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#1E293B" }}><ListChecks size={13} /> TASKS</div>
        <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Personal tasks this student added themselves. They also see {sharedTasks.length} task{sharedTasks.length === 1 ? "" : "s"} assigned to everyone — manage those from Tasks &amp; Deadlines.</p>
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 border border-[#E5E7EB] rounded-lg p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <button onClick={() => cycleTaskStatus(t.id)} className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0"
                  style={t.status === "done" ? { background: C.green, borderColor: C.green } : t.status === "in-progress" ? { background: C.amber, borderColor: C.amber } : { borderColor: C.border }}>
                  {t.status === "done" && <Check size={12} className="text-white" />}
                </button>
                <div className="min-w-0">
                  <div className={`text-sm truncate ${t.status === "done" ? "line-through text-[#B0B8C6]" : ""}`}>{t.title}</div>
                  <div className="text-xs" style={{ color: "#94A3B8" }}>{courseCode(t.courseId)} {t.due && `· Due ${fmt(t.due)}`}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge color={priColor[t.priority]}>{t.priority}</Badge>
                <button onClick={() => removeTask(t.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <div className="text-sm text-[#94A3B8]">No personal tasks added yet.</div>}
        </div>
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#1E293B" }}><CalendarClock size={13} /> SELF-STUDY PLANNER BLOCKS</div>
        <div className="space-y-1.5">
          {selfBlocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-sm py-1">
              <span>{b.day} · {b.start}–{b.end} · {b.label}</span>
              <button onClick={() => removeBlock(b.id)} className="text-[#CBD5E1] hover:text-[#EF4444]"><Trash2 size={13} /></button>
            </div>
          ))}
          {selfBlocks.length === 0 && <div className="text-sm text-[#94A3B8]">No self-study blocks scheduled yet.</div>}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Trash / Restore ------------------------------ */

const TRASH_TYPE_META = {
  calendarEvent: { label: "Calendar event", icon: CalendarDays },
  course: { label: "Subject", icon: BookOpen },
  courseUnit: { label: "Unit", icon: BookOpen },
  courseSyllabus: { label: "Syllabus", icon: FileText },
  task: { label: "Task", icon: ListChecks },
  plannerBlock: { label: "Timetable / planner block", icon: CalendarClock },
  coCurricularCatalog: { label: "Co-curricular opportunity", icon: Users2 },
  enrollment: { label: "Enrollment", icon: Users2 },
  enrollmentModule: { label: "Module", icon: Users2 },
  resource: { label: "Resource", icon: FolderOpen },
  datesheet: { label: "Datesheet", icon: Upload },
  announcement: { label: "Announcement", icon: Megaphone },
  studyLog: { label: "Study log entry", icon: TrendingUp },
  studentAccount: { label: "Account", icon: GraduationCap },
};

function TrashView({ data, setData }) {
  const isSuperAdmin = data.profiles[data.session]?.role === "admin"; // only the original admin can restore/purge deleted accounts & data
  const trash = data.trash || [];
  const [filter, setFilter] = useState("all");
  const [confirmDelete, deleteModal] = useDeleteConfirm();

  const types = useMemo(() => Array.from(new Set(trash.map((t) => t.type))), [trash]);
  const filtered = filter === "all" ? trash : trash.filter((t) => t.type === filter);

  if (!isSuperAdmin) {
    return (
      <Card>
        <div className="text-sm" style={{ color: "#94A3B8" }}>Only the original admin account can restore deleted items.</div>
      </Card>
    );
  }

  const restore = (id) => setData((d) => restoreFromTrash(d, id));
  const permanentlyDelete = (id, label) => {
    confirmDelete(`Permanently delete "${label}"? This cannot be undone`, () => {
      setData((d) => logActivity({ ...d, trash: d.trash.filter((t) => t.id !== id) }, `Permanently deleted: ${label}`));
    });
  };
  const emptyTrash = () => {
    confirmDelete(`Permanently delete all ${trash.length} item${trash.length === 1 ? "" : "s"} in Trash? This cannot be undone`, () => {
      setData((d) => logActivity({ ...d, trash: [] }, "Trash emptied"));
    });
  };

  return (
    <div className="space-y-4">
      {deleteModal}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: "#1E293B" }}>{trash.length} item{trash.length === 1 ? "" : "s"} in Trash</div>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Anything deleted by you or a student — tasks, enrollments, timetable entries, accounts and more — lands here first so you can bring it back.</p>
        </div>
        {trash.length > 0 && <button onClick={emptyTrash} className="text-xs px-3 py-1.5 rounded-lg text-white flex-shrink-0" style={{ background: C.red }}>Empty Trash</button>}
      </Card>

      {trash.length > 0 && (
        <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-lg p-1 w-fit flex-wrap">
          <button onClick={() => setFilter("all")} className={`text-xs px-3 py-1.5 rounded-md ${filter === "all" ? "text-white" : "text-[#64748B]"}`} style={filter === "all" ? { background: C.purple } : {}}>All</button>
          {types.map((t) => (
            <button key={t} onClick={() => setFilter(t)} className={`text-xs px-3 py-1.5 rounded-md ${filter === t ? "text-white" : "text-[#64748B]"}`} style={filter === t ? { background: C.purple } : {}}>{TRASH_TYPE_META[t]?.label || t}</button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((entry) => {
          const meta = TRASH_TYPE_META[entry.type] || { label: entry.type, icon: FileText };
          const Icon = meta.icon;
          const deletedByName = entry.deletedBy ? (data.profiles[entry.deletedBy]?.name || (isAdminKey(entry.deletedBy, data.profiles) ? "Admin" : "Student")) : "—";
          return (
            <Card key={entry.id} className="flex items-center justify-between gap-3 !py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Icon size={15} /></div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "#1E293B" }}>{entry.label}</div>
                  <div className="text-xs" style={{ color: "#94A3B8" }}>{meta.label} · Deleted by {deletedByName} · {fmt(entry.deletedAt)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => restore(entry.id)} className="text-xs px-3 py-1.5 rounded-lg text-white flex items-center gap-1" style={{ background: C.green }}><RefreshCw size={12} /> Restore</button>
                <button onClick={() => permanentlyDelete(entry.id, entry.label)} className="text-[#CBD5E1] hover:text-[#EF4444]" title="Permanently delete"><Trash2 size={15} /></button>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card><p className="text-sm text-center py-6" style={{ color: "#94A3B8" }}>{trash.length === 0 ? "Trash is empty." : "Nothing matches this filter."}</p></Card>}
      </div>
    </div>
  );
}

/** "Head office" view for admin: one page that rolls up the raw activity feed
 *  (every action by every user) alongside a workload snapshot for every
 *  student and co-admin, so admin doesn't have to open each account to see
 *  what's going on across the whole tracker. */
function TeamActivityView({ data, setData, onViewStudent, goTo }) {
  const isSuperAdmin = data.profiles[data.session]?.role === "admin"; // only the original admin account manages co-admins
  const studentKeys = useMemo(() => Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles)), [data.profiles]);
  const coAdminKeys = useMemo(() => Object.keys(data.profiles).filter((k) => isAdminKey(k, data.profiles) && data.profiles[k]?.role !== "admin"), [data.profiles]);

  const roleFor = (key) => (data.profiles[key]?.role === "admin" ? "Admin" : isAdminKey(key, data.profiles) ? "Co-admin" : "Student");
  const roleColor = { Admin: C.dark, "Co-admin": C.purple, Student: C.green };
  const nameFor = (key) => data.profiles[key]?.name || (data.profiles[key]?.role === "admin" ? "Admin" : roleFor(key));

  const [roleFilter, setRoleFilter] = useState("all"); // all | Admin | Co-admin | Student
  const [userFilter, setUserFilter] = useState("all"); // "all" or a specific key
  const [search, setSearch] = useState("");

  const filteredLog = useMemo(() => {
    return (data.activityLog || []).filter((a) => {
      if (roleFilter !== "all" && roleFor(a.by) !== roleFilter) return false;
      if (userFilter !== "all" && a.by !== userFilter) return false;
      if (search.trim() && !a.text.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [data.activityLog, roleFilter, userFilter, search]);

  const summaryFor = (key) => {
    const enrollCount = data.enrollments.filter((e) => e.ownerKey === key).length;
    const myTasks = data.tasks.filter((t) => t.ownerKey === key);
    const taskDone = myTasks.filter((t) => t.status === "done").length;
    const studyMinutes = data.studyLogs.filter((l) => l.ownerKey === key).reduce((s, l) => s + l.minutes, 0);
    const selfBlocks = data.plannerBlocks.filter((b) => b.kind === "self" && b.ownerKey === key).length;
    return { enrollCount, taskDone, taskTotal: myTasks.length, studyHours: +(studyMinutes / 60).toFixed(1), selfBlocks };
  };

  const activityCountFor = (key) => (data.activityLog || []).filter((a) => a.by === key).length;
  const lastActiveFor = (key) => (data.activityLog || []).find((a) => a.by === key);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#1E293B" }}><Activity size={13} /> ACTIVITY LOG ({filteredLog.length}/{(data.activityLog || []).length})</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#94A3B8" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity" className="border border-[#E5E7EB] rounded-lg pl-7 pr-2 py-1.5 text-xs w-40" />
            </div>
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setUserFilter("all"); }} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs">
              <option value="all">All roles</option>
              <option value="Admin">Admin</option>
              <option value="Co-admin">Co-admins</option>
              <option value="Student">Students</option>
            </select>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs">
              <option value="all">Everyone</option>
              {Object.keys(data.profiles)
                .filter((k) => roleFilter === "all" || roleFor(k) === roleFilter)
                .map((k) => <option key={k} value={k}>{nameFor(k)}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Every action taken across the tracker, most recent first — admin, co-admins and students.</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLog.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 text-xs border-b border-[#F1F5F9] pb-2 last:border-0">
              <div className="min-w-0">
                <div style={{ color: "#1E293B" }}>{a.text}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge color={roleColor[roleFor(a.by)] || "#94A3B8"}>{nameFor(a.by)}</Badge>
                </div>
              </div>
              <span className="flex-shrink-0" style={{ color: "#94A3B8" }}>{new Date(a.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
          {filteredLog.length === 0 && <div className="text-sm" style={{ color: "#94A3B8" }}>No activity matches this filter.</div>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#1E293B" }}><GraduationCap size={13} /> STUDENT WORKLOAD ({studentKeys.length})</div>
          {goTo && <button onClick={() => goTo("students")} className="text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Users2 size={12} /> Manage Students</button>}
        </div>
        <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>Every student's work in one place — tasks, self-study and enrollments — without opening each account.</p>
        <div className="space-y-2">
          {studentKeys.map((key) => {
            const profile = data.profiles[key] || { name: "Student", photo: null };
            const s = summaryFor(key);
            return (
              <div key={key} className="border border-[#E5E7EB] rounded-lg p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden" style={{ background: "#10B981" }}>
                    {profile.photo ? <img src={profile.photo} alt="" className="w-full h-full object-cover" /> : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 text-sm font-medium truncate" style={{ color: "#1E293B" }}>{profile.name || "Student"}</div>
                  <button onClick={() => onViewStudent && onViewStudent(key)} className="text-xs font-medium flex items-center gap-1 flex-shrink-0" style={{ color: C.purple }}><Eye size={12} /> View full activity</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: C.purpleSoft, color: C.purple }}>{s.enrollCount} enrollment{s.enrollCount === 1 ? "" : "s"}</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#ECFDF5", color: C.green }}>{s.taskDone}/{s.taskTotal} tasks done</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#FEF3C7", color: "#B45309" }}>{s.studyHours}h studied</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#EFF6FF", color: "#2563EB" }}>{s.selfBlocks} planner block{s.selfBlocks === 1 ? "" : "s"}</span>
                </div>
              </div>
            );
          })}
          {studentKeys.length === 0 && <div className="text-sm" style={{ color: "#94A3B8" }}>No student accounts yet.</div>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#1E293B" }}><Shield size={13} /> CO-ADMIN ACTIVITY ({coAdminKeys.length})</div>
          {goTo && isSuperAdmin && <button onClick={() => goTo("coadmins")} className="text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Shield size={12} /> Manage Co-Admins</button>}
        </div>
        <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>How active each co-admin has been{isSuperAdmin ? " — open Co-Admins to see their full action-by-action log or remove access." : "."}</p>
        <div className="space-y-2">
          {coAdminKeys.map((key) => {
            const profile = data.profiles[key] || { name: "Co-admin", photo: null };
            const count = activityCountFor(key);
            const last = lastActiveFor(key);
            return (
              <div key={key} className="border border-[#E5E7EB] rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden" style={{ background: C.purple }}>
                  {profile.photo ? <img src={profile.photo} alt="" className="w-full h-full object-cover" /> : (profile.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" style={{ color: "#1E293B" }}>{profile.name || "Co-admin"}</div>
                  <div className="text-xs" style={{ color: "#94A3B8" }}>{last ? `Last active ${new Date(last.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "No activity yet"}</div>
                </div>
                <Badge color={C.purple}>{count} action{count === 1 ? "" : "s"}</Badge>
              </div>
            );
          })}
          {coAdminKeys.length === 0 && <div className="text-sm" style={{ color: "#94A3B8" }}>No co-admins yet.</div>}
        </div>
      </Card>
    </div>
  );
}

function CoAdminsView({ data, setData, goTo }) {
  const isSuperAdmin = data.profiles[data.session]?.role === "admin"; // only the original admin account manages co-admins
  const coAdminKeys = useMemo(() => Object.keys(data.profiles).filter((k) => isAdminKey(k, data.profiles) && data.profiles[k]?.role !== "admin"), [data.profiles]);
  // Everyone signed up who ISN'T already an admin/coadmin — candidates to promote.
  const studentKeys = useMemo(() => Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles)), [data.profiles]);
  const [expandedActivity, setExpandedActivity] = useState(null); // co-admin key whose activity is expanded
  const activityFor = (key) => (data.activityLog || []).filter((a) => a.by === key).slice(0, 20);
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const [promoteKey, setPromoteKey] = useState("");
  const [promoteDept, setPromoteDept] = useState(data.departments[0]?.id || DEFAULT_DEPT_ID);
  const [promoteError, setPromoteError] = useState("");

  // Departments: the director creates/renames these; each co-admin (HOD) is tagged to exactly one.
  const [newDeptName, setNewDeptName] = useState("");
  const [deptError, setDeptError] = useState("");
  const addDepartment = () => {
    setDeptError("");
    const name = newDeptName.trim();
    if (!name) return;
    if (data.departments.some((dp) => dp.name.toLowerCase() === name.toLowerCase())) { setDeptError("A department with that name already exists."); return; }
    const dept = { id: `dept_${uid()}`, name };
    setData((d) => logActivity({ ...d, departments: [...d.departments, dept] }, `Department added: ${name}`));
    setNewDeptName("");
  };
  const renameDepartment = (id, name) => setData((d) => ({ ...d, departments: d.departments.map((dp) => dp.id === id ? { ...dp, name } : dp) }));
  const removeDepartment = (id) => {
    const dept = data.departments.find((dp) => dp.id === id);
    const inUse = data.courses.some((c) => (c.departmentId || data.departments[0]?.id) === id)
      || Object.keys(data.profiles).some((k) => data.profiles[k]?.departmentId === id);
    if (inUse) { setDeptError(`"${dept?.name}" still has subjects, students or an HOD assigned — reassign them first.`); return; }
    if (data.departments.length <= 1) { setDeptError("At least one department must remain."); return; }
    setDeptError("");
    confirmDelete(`Department "${dept?.name}"`, () => {
      setData((d) => logActivity({ ...d, departments: d.departments.filter((dp) => dp.id !== id) }, `Department removed: ${dept?.name}`));
    });
  };
  const setCoAdminDept = (key, departmentId) => {
    updateProfile(key, { departmentId }).then(({ error }) => {
      if (!error) setData((d) => logActivity(d, `${d.profiles[key]?.name || "Co-admin"} reassigned to ${deptName(d, departmentId)}`));
    });
  };

  const promoteToCoAdmin = () => {
    setPromoteError("");
    if (!promoteKey) { setPromoteError("Pick a signed-up user to promote."); return; }
    if (!promoteDept) { setPromoteError("Pick a department for this HOD."); return; }
    updateProfile(promoteKey, { role: "coadmin", departmentId: promoteDept }).then(({ error }) => {
      if (error) { setPromoteError(error.message); return; }
      setData((d) => logActivity(d, `${d.profiles[promoteKey]?.name || "A user"} promoted to Co-admin (HOD) — ${deptName(d, promoteDept)}`));
      setPromoteKey("");
    });
  };
  const removeCoAdmin = (key) => {
    confirmDelete(`Admin access for "${data.profiles[key]?.name || "this co-admin"}"`, () => {
      updateProfile(key, { role: "student" }).then(({ error }) => {
        if (!error) setData((d) => logActivity(d, `Co-admin access removed: ${d.profiles[key]?.name || key} (now a student)`));
      });
    });
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <div className="text-sm" style={{ color: "#94A3B8" }}>Only the original admin account can manage co-admins.</div>
      </Card>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      {deleteModal}

      <Card style={{ borderLeft: "3px solid #2563EB" }}>
        <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#1E293B" }}><Building2 size={13} /> DEPARTMENTS ({data.departments.length})</div>
        <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Each HOD below is tagged to one department. Subjects and students are tagged too, so an HOD only manages their own — everything else stays view-only for them.</p>
        <div className="space-y-2 mb-3">
          {data.departments.map((dp) => {
            const hod = coAdminKeys.find((k) => data.profiles[k]?.departmentId === dp.id);
            const courseCount = data.courses.filter((c) => (c.departmentId || data.departments[0]?.id) === dp.id).length;
            const studentCount = Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles) && data.profiles[k]?.departmentId === dp.id).length;
            return (
              <div key={dp.id} className="flex items-center gap-2 flex-wrap border border-[#E5E7EB] rounded-lg px-3 py-2">
                <input value={dp.name} onChange={(e) => renameDepartment(dp.id, e.target.value)} className="flex-1 min-w-[120px] text-sm bg-transparent" style={{ color: "#1E293B" }} />
                <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#F4F4F8", color: "#64748B" }}>{courseCount} subj · {studentCount} stu</span>
                <span className="text-[10px] flex-shrink-0" style={{ color: "#94A3B8" }}>{hod ? `HOD: ${data.profiles[hod]?.name}` : "No HOD yet"}</span>
                <button onClick={() => removeDepartment(dp.id)} className="text-[#CBD5E1] hover:text-[#EF4444] flex-shrink-0" title="Remove department"><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
        {deptError && <div className="text-xs mb-2" style={{ color: "#EF4444" }}>{deptError}</div>}
        <div className="flex gap-2">
          <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="e.g. Electronics & Communication" className="flex-1 border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm" />
          <button onClick={addDepartment} className="text-xs px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 flex-shrink-0" style={{ background: "#2563EB" }}><Plus size={13} /> Add dept</button>
        </div>
      </Card>

      <Card style={{ borderLeft: "3px solid #7C3AED" }}>
        <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#1E293B" }}><Shield size={13} /> CO-ADMINS / HODs ({coAdminKeys.length})</div>
        <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>Give department heads admin access scoped to their own department. As the Super Admin, you can see what each HOD has done and can reassign their department anytime.</p>

        <div className="space-y-3 mb-4">
          {coAdminKeys.map((key) => {
            const profile = data.profiles[key] || { name: "Co-admin", photo: null };
            const isOpen = expandedActivity === key;
            const acts = activityFor(key);
            return (
              <div key={key} className="border border-[#E5E7EB] rounded-lg p-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden" style={{ background: C.purple }}>
                    {profile.photo ? <img src={profile.photo} alt="" className="w-full h-full object-cover" /> : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "#1E293B" }}>{profile.name || "Co-admin"}</div>
                    <div className="text-xs truncate" style={{ color: "#94A3B8" }}>{profile.email}</div>
                  </div>
                  <button onClick={() => setExpandedActivity(isOpen ? null : key)} className="text-xs font-medium flex items-center gap-1 flex-shrink-0" style={{ color: C.purple }}>
                    <ClipboardList size={12} /> {isOpen ? "Hide activity" : `Activity (${acts.length})`}
                  </button>
                  <button onClick={() => removeCoAdmin(key)} className="text-[#CBD5E1] hover:text-[#EF4444] flex-shrink-0" title="Remove admin access (demotes to student)"><Trash2 size={14} /></button>
                </div>
                <div className="mb-1">
                  <div className="text-[11px] font-medium mb-1" style={{ color: "#64748B" }}>Department (HOD of)</div>
                  <select value={profile.departmentId || data.departments[0]?.id || ""} onChange={(e) => setCoAdminDept(key, e.target.value)} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm w-full">
                    {data.departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                  </select>
                </div>
                {isOpen && (
                  <div className="mt-3 max-h-48 overflow-y-auto border border-[#F1F0F5] rounded-lg p-2 space-y-1.5 bg-[#FAFAFC]">
                    {acts.map((a) => (
                      <div key={a.id} className="text-xs flex items-start justify-between gap-2">
                        <span style={{ color: "#1E293B" }}>{a.text}</span>
                        <span className="flex-shrink-0" style={{ color: "#94A3B8" }}>{new Date(a.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))}
                    {acts.length === 0 && <div className="text-xs" style={{ color: "#94A3B8" }}>No recorded activity yet.</div>}
                  </div>
                )}
              </div>
            );
          })}
          {coAdminKeys.length === 0 && <div className="text-sm text-[#94A3B8]">No co-admins yet — you're the only admin.</div>}
        </div>

        <div className="border-t border-[#F1F5F9] pt-4">
          <div className="text-xs font-medium mb-2" style={{ color: "#64748B" }}>Promote a signed-up user to co-admin (HOD)</div>
          <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>They need to have already signed up in the app — accounts aren't created from here anymore.</p>
          <select value={promoteKey} onChange={(e) => setPromoteKey(e.target.value)} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm w-full mb-2">
            <option value="">Choose a signed-up user…</option>
            {studentKeys.map((k) => <option key={k} value={k}>{data.profiles[k]?.name || "Unnamed"} ({data.profiles[k]?.email})</option>)}
          </select>
          <select value={promoteDept} onChange={(e) => setPromoteDept(e.target.value)} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm w-full mb-2">
            {data.departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
          </select>
          {promoteError && <div className="text-xs mb-2" style={{ color: "#EF4444" }}>{promoteError}</div>}
          <button onClick={promoteToCoAdmin} className="text-xs px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5" style={{ background: C.green }}><Plus size={13} /> Promote to co-admin</button>
        </div>
      </Card>
    </div>
  );
}

function SettingsView({ data, setData, goTo }) {
  const isAdmin = isAdminKey(data.session, data.profiles);
  const isSuperAdmin = data.profiles[data.session]?.role === "admin";
  const ownRole = data.session;
  const studentKeys = useMemo(() => Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles)), [data.profiles]);
  const [name, setName] = useState(data.profiles[data.session].name);
  useEffect(() => { setName(data.profiles[data.session].name); }, [data.session]);
  const [nameSaved, setNameSaved] = useState(false);

  const photoRef = useRef(null);
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  const uploadOwnPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Please choose an image file."); return; }
    setPhotoError(""); setPhotoBusy(true);
    try {
      const { url } = await uploadAttachment(file);
      const { error } = await updateProfile(ownRole, { photo: url });
      if (error) setPhotoError(error.message);
    } catch (err) {
      setPhotoError(err.message || "Couldn't upload that image, try another one.");
    } finally {
      setPhotoBusy(false);
    }
  };
  const removeOwnPhoto = () => updateProfile(ownRole, { photo: null });
  const removeStudentPhoto = (key) => {
    updateProfile(key, { photo: null }).then(({ error }) => {
      if (!error) setData((d) => logActivity(d, `Admin removed ${data.profiles[key]?.name || "student"}'s profile photo`));
    });
  };

  const saveName = () => {
    updateProfile(ownRole, { name }).then(({ error }) => {
      if (!error) { setNameSaved(true); setTimeout(() => setNameSaved(false), 1500); }
    });
  };

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError] = useState("");
  const [passSaved, setPassSaved] = useState(false);

  const changeOwnPassword = async () => {
    setPassError("");
    if (!newPass.trim() || newPass.length < 6) { setPassError("New password must be at least 6 characters."); return; }
    if (newPass !== confirmPass) { setPassError("New passwords don't match."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { setPassError(error.message); return; }
    setNewPass(""); setConfirmPass("");
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 1500);
  };

  return (
    <div className="max-w-md space-y-4">
      <Card>
        <div className="text-xs font-semibold text-[#94A3B8] mb-3">PROFILE</div>

        <div className="text-xs text-[#64748B] mb-2">Photo</div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 overflow-hidden" style={{ background: C.purple }}>
            {data.profiles[ownRole].photo
              ? <img src={data.profiles[ownRole].photo} alt="" className="w-full h-full object-cover" />
              : (data.profiles[ownRole].name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex gap-2">
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={uploadOwnPhoto} />
            <button onClick={() => photoRef.current && photoRef.current.click()} disabled={photoBusy} className="text-xs px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-50">{photoBusy ? "Uploading…" : "Upload photo"}</button>
            {data.profiles[ownRole].photo && <button onClick={removeOwnPhoto} className="text-xs px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[#EF4444]">Remove</button>}
          </div>
        </div>
        {photoError && <div className="text-xs mb-3" style={{ color: "#EF4444" }}>{photoError}</div>}

        <div className="text-xs text-[#64748B] mb-1">Display name ({isAdmin ? (isSuperAdmin ? "Admin" : "Co-admin") : "Student"})</div>
        <div className="flex gap-2 mb-4">
          <input value={name} onChange={(e) => setName(e.target.value)} className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm flex-1" />
          <button onClick={saveName} className="text-sm text-white px-3 py-2 rounded-lg flex-shrink-0" style={{ background: C.purple }}>{nameSaved ? "Saved ✓" : "Save"}</button>
        </div>

        {!isSuperAdmin && data.departments.length > 1 && (
          <>
            <div className="text-xs text-[#64748B] mb-1">Department</div>
            <div className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm w-full mb-1 bg-[#F8F8FB] flex items-center justify-between" style={{ color: "#1E293B" }}>
              <span>{deptName(data, data.profiles[ownRole]?.departmentId || data.departments[0]?.id)}</span>
              <span className="text-[10px]" style={{ color: "#94A3B8" }}>{isAdmin ? "set by the Super Admin" : "set by your admin"}</span>
            </div>
          </>
        )}
      </Card>

      <Card style={{ borderLeft: `3px solid ${isAdmin ? C.purple : "#10B981"}` }}>
        <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#1E293B" }}>
          {isAdmin ? <Shield size={13} /> : <GraduationCap size={13} />} MY ACCOUNT
        </div>
        <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Signed in as <b>{data.profiles[ownRole]?.email}</b>. Classroom data (courses, tasks, announcements, etc.) is shared with every admin, co-admin, and student in this app.</p>

        <div className="text-xs font-medium mb-2" style={{ color: "#64748B" }}>Change password</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <PasswordInput autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="New password" className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm w-full" />
          <PasswordInput autoComplete="new-password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Confirm new password" className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm w-full" />
        </div>
        {passError && <div className="text-xs mb-2" style={{ color: "#EF4444" }}>{passError}</div>}
        <button onClick={changeOwnPassword} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: C.purple }}>{passSaved ? "Saved ✓" : "Change password"}</button>
      </Card>

      {isSuperAdmin && goTo && (
        <Card style={{ borderLeft: "3px solid #7C3AED" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#1E293B" }}><Shield size={13} /> CO-ADMINS</div>
            <button onClick={() => goTo("coadmins")} className="text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Shield size={12} /> Manage Co-Admins</button>
          </div>
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>Promote a signed-up user to department HOD, and see what each co-admin has done. Manage this from <b>Co-Admins</b> in the sidebar.</p>
        </Card>
      )}

      {isAdmin && (
        <Card style={{ borderLeft: "3px solid #10B981" }}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#1E293B" }}><GraduationCap size={13} /> STUDENT ACCOUNTS ({studentKeys.length})</div>
            {goTo && <button onClick={() => goTo("students")} className="text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Users2 size={12} /> Manage Students</button>}
          </div>
          <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>Students manage their own login now (they signed up themselves). You can remove a profile photo here, or assign departments and deactivate accounts from <b>Manage Students</b> in the sidebar.</p>

          <div className="space-y-2">
            {studentKeys.map((key) => {
              const profile = data.profiles[key] || { name: "Student", photo: null };
              return (
                <div key={key} className="flex items-center gap-3 border border-[#E5E7EB] rounded-lg p-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden" style={{ background: "#10B981" }}>
                    {profile.photo
                      ? <img src={profile.photo} alt="" className="w-full h-full object-cover" />
                      : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "#1E293B" }}>{profile.name || "Student"}</div>
                    <div className="text-xs truncate" style={{ color: "#94A3B8" }}>{profile.email}</div>
                  </div>
                  {profile.photo && <button onClick={() => removeStudentPhoto(key)} className="text-xs flex-shrink-0" style={{ color: "#EF4444" }}>Remove photo</button>}
                </div>
              );
            })}
            {studentKeys.length === 0 && <div className="text-sm text-[#94A3B8]">No student accounts yet — share the app link so students can sign up.</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
