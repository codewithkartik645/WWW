import { C, uid, DEFAULT_DEPT_ID, makeUnit as u } from "../theme";

/* ---------------------------------------------------------------- */
/* Seed data — RKGIT Odd-Sem 2026-27 calendar + AKTU V-sem syllabus  */
/* ---------------------------------------------------------------- */
const ELECTIVE_I_OPTIONS = ["Statistical Computing (BCS051)", "Data Analytics (BCS052)", "Computer Graphics (BCS053)", "Object Oriented System Design with C++ (BCS054)"];
const ELECTIVE_II_OPTIONS = ["Machine Learning Techniques (BCS055)", "Application of Soft Computing (BCS056)", "Image Processing (BCS057)", "Data Warehousing & Data Mining (BCS058)"];
const NON_CREDIT_OPTIONS = ["Constitution of India (BNC501)", "Essence of Indian Traditional Knowledge (BNC502)"];

const INITIAL_COURSES_BASE = [
  { id: "bcs501", code: "BCS501", name: "Database Management System", credits: 4, category: "Core", color: C.purple,
    units: [u("u1", "Intro, DB Architecture & ER Model"), u("u2", "Relational Model & SQL"), u("u3", "Database Design & Normalization"), u("u4", "Transaction Processing & Distributed DB"), u("u5", "Concurrency Control")] },
  { id: "bcs502", code: "BCS502", name: "Web Technology", credits: 4, category: "Core", color: "#2C4A63",
    units: [u("u1", "Intro, HTML & XML"), u("u2", "CSS & Responsive Layout"), u("u3", "JavaScript, AJAX & Networking"), u("u4", "EJB, Node.js & MongoDB"), u("u5", "Servlets & JSP")] },
  { id: "bcs503", code: "BCS503", name: "Design and Analysis of Algorithm", credits: 4, category: "Core", color: C.amber,
    units: [u("u1", "Complexity Analysis & Sorting"), u("u2", "Advanced Data Structures"), u("u3", "Divide & Conquer, Greedy"), u("u4", "DP, Backtracking, Branch & Bound"), u("u5", "NP-Completeness & FFT")] },
  { id: "elec1", code: "DE-I", name: "Data Analytics (BCS052)", credits: 3, category: "Elective I", color: "#A34C6D", options: ELECTIVE_I_OPTIONS,
    units: [u("u1", "Intro to Data Analytics & Lifecycle"), u("u2", "Regression, Bayesian, Time Series"), u("u3", "Mining Data Streams"), u("u4", "Frequent Itemsets & Clustering"), u("u5", "Hadoop/NoSQL & Visualization")] },
  { id: "elec2", code: "DE-II", name: "Machine Learning Techniques (BCS055)", credits: 3, category: "Elective II", color: C.green,
    units: [u("u1", "Intro to Learning & ML Approaches"), u("u2", "Regression, Bayesian Learning & SVM"), u("u3", "Decision Trees & Instance-Based Learning"), u("u4", "Neural Networks & Deep Learning"), u("u5", "Reinforcement Learning & GAs")] },
  { id: "bcs551", code: "BCS551", name: "DBMS Lab", credits: 1, category: "Lab", color: C.purple,
    units: [u("e1", "ER diagram + basic SQL"), u("e2", "Joins, group functions, subqueries"), u("e3", "Normalization exercises"), u("e4", "Cursors, procedures, functions"), u("e5", "Packages & triggers"), u("e6", "Mini project")] },
  { id: "bcs552", code: "BCS552", name: "Web Technology Lab", credits: 1, category: "Lab", color: "#2C4A63",
    units: [u("e1", "Institute website in HTML"), u("e2", "Responsive site with CSS"), u("e3", "JS form validation"), u("e4", "Node.js CLI utility"), u("e5", "MongoDB aggregation script"), u("e6", "Servlet/JSP login flow")] },
  { id: "bcs553", code: "BCS553", name: "DAA Lab", credits: 1, category: "Lab", color: C.amber,
    units: [u("e1", "Search & sorting algorithms"), u("e2", "Knapsack (greedy & DP)"), u("e3", "MST — Kruskal's & Prim's"), u("e4", "Dijkstra's shortest path"), u("e5", "N-Queens (backtracking)"), u("e6", "TSP & Hamiltonian cycles")] },
  { id: "bcs554", code: "BCS554", name: "Mini Project / Internship", credits: 2, category: "Project", color: "#4A4335",
    units: [u("m1", "Project proposal & scope"), u("m2", "Build & document"), u("m3", "Final assessment")] },
  { id: "bnc", code: "BNC501", name: "Constitution of India", credits: 0, category: "Non-Credit", color: "#6B4423", options: NON_CREDIT_OPTIONS,
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
  attendance: [],
  announcements: [
    { id: uid(), title: "Welcome to your Study Tracker", message: "Admin can upload the ST/PUT datesheet and the app will generate a suggested revision timetable automatically.", date: new Date().toISOString().slice(0, 10) },
  ],
  activityLog: [],
  trash: [],
  lastSeenAnnouncements: {},
  plannerHourRanges: {},
};

export { ELECTIVE_I_OPTIONS, ELECTIVE_II_OPTIONS, NON_CREDIT_OPTIONS, INITIAL_COURSES_BASE, INITIAL_COURSES, INITIAL_CALENDAR, DEFAULT_SHARED_DATA };
