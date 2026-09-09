const C = {
  purple: "#7A2E3A", purpleSoft: "#F1E5E4", dark: "#211C16", darkSoft: "#2B2620",
  green: "#4F7A5B", amber: "#B8862E", red: "#A6423A", gray: "#E6DFD1",
  text: "#2B2620", sub: "#6E6455", border: "#E6DFD1", bg: "#FAF6EF",
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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);
const SEM_START = new Date("2026-07-20");
const SEM_END = new Date("2026-12-27");

const flatNav = (sections) => sections.flatMap((s) => s.items);
const makeUnit = (id, name) => ({ id, name, done: false }); // shared shape for a course's syllabus unit/topic

// A department without an explicit `active` flag (e.g. seeded before this feature existed)
// is treated as active, so existing installs aren't silently affected.
const isDeptActive = (dept) => dept?.active !== false;
const activeDepartments = (data) => (data.departments || []).filter(isDeptActive);

// Announcements a given profile is allowed to see: their own department's notices, plus
// every campus-wide one (departmentId left null/undefined). The Director sees everything,
// since they oversee every department. Shared by AnnouncementsView, the bell dropdown, and
// the unread-count badge so all three always agree on the same number.
const visibleAnnouncementsFor = (data, key) => {
  const profile = data.profiles?.[key];
  if (profile?.role === "admin") return data.announcements; // Director oversees every department
  const myDeptId = profile?.departmentId || data.departments?.[0]?.id;
  return (data.announcements || []).filter((a) => !a.departmentId || a.departmentId === myDeptId);
};

export { C, uid, isAdminKey, DEFAULT_DEPT_ID, deptName, deptOf, fmt, fmtFull, daysUntil, toMin, minToTime, MAX_FILE_BYTES, DAYS, HOURS, SEM_START, SEM_END, flatNav, makeUnit, isDeptActive, activeDepartments, visibleAnnouncementsFor };
