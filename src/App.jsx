import React, { useState, useEffect } from "react";
import {
  LayoutGrid, CalendarDays, CalendarClock, ListChecks, Users2, TrendingUp,
  FolderOpen, Settings as SettingsIcon, Shield, Wand2, Upload, GraduationCap,
  Megaphone, ClipboardList, Building2, X, Award, LogOut, Activity, BookOpen,
  Trash2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useAuth } from "./lib/useAuth";
import { useClassroomData } from "./lib/useClassroomData";
import AuthScreen from "./AuthScreen";
import { C, isAdminKey, daysUntil } from "./theme";
import { DEFAULT_SHARED_DATA } from "./data/seedData";
import { logActivity, generateRecommendedBlocks } from "./utils/activity";
import { ConfirmModal, AttachmentPreviewModal } from "./components/UI";
import SidebarContent from "./components/Sidebar";
import TopBar from "./components/TopBar";

import StudentDashboard from "./views/StudentDashboard";
import AdminDashboard from "./views/AdminDashboard";
import CalendarView from "./views/CalendarView";
import CoursesView from "./views/CoursesView";
import PlannerView from "./views/PlannerView";
import TasksView from "./views/TasksView";
import DatesheetView from "./views/DatesheetView";
import TimetablesView from "./views/TimetablesView";
import ExamsView from "./views/ExamsView";
import AdminCoCurricularView from "./views/AdminCoCurricularView";
import StudentCoCurricularView from "./views/StudentCoCurricularView";
import AnnouncementsView from "./views/AnnouncementsView";
import ResourcesView from "./views/ResourcesView";
import ProgressView from "./views/ProgressView";
import AdminStudentsView from "./views/AdminStudentsView";
import AdminStudentDetailView from "./views/AdminStudentDetailView";
import TrashView from "./views/TrashView";
import TeamActivityView from "./views/TeamActivityView";
import CoAdminsView from "./views/CoAdminsView";
import SettingsView from "./views/SettingsView";

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
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

function LoadingScreen({ label }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.purple, fontFamily: "'Source Serif 4', Georgia, serif" }}>
      {label}
    </div>
  );
}

// Shown whenever the last write to the shared classroom failed to save (network hiccup,
// dropped connection, etc.) after all automatic retries were exhausted. Without this banner,
// a failed save was invisible: the change stayed on screen locally, then quietly disappeared
// the moment a reload or another device's update replaced it with the still-old server copy —
// exactly the "I added something and it went missing" symptom. Retrying here re-attempts the
// exact same save; refreshing is only safe once it succeeds.
function SaveErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl max-w-md"
      style={{ background: "#3A2320", border: `1px solid ${C.red}`, color: "#F5EFE4" }}
    >
      <AlertTriangle size={18} style={{ color: "#E08A7D", flexShrink: 0 }} />
      <div className="text-xs leading-snug">
        <div className="font-semibold mb-0.5">Your last change hasn't saved yet</div>
        <div style={{ color: "#D8C7BE" }}>Keep this tab open — don't refresh until it saves, or you'll lose it.</div>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg flex-shrink-0"
        style={{ background: C.red, color: "#fff" }}
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}

export default function App() {
  const { session, profile, loaded: authLoaded, signOut } = useAuth();
  const { data: classroomData, setData, loaded: dataLoaded, saveError, retryNow, refreshProfiles } = useClassroomData(profile, session?.user?.id ?? null);
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

  if (!authLoaded) return <LoadingScreen label="Loading your tracker…" />;
  if (!session || !profile) return <AuthScreen />;
  if (!dataLoaded || !data) return <LoadingScreen label="Loading your classroom…" />;

  // First-ever load against a brand-new Supabase project: the `classroom` row starts as `{}`.
  // Seed it once with sensible defaults so the app isn't a blank shell.
  if (!data.departments) {
    setData(DEFAULT_SHARED_DATA);
    return <LoadingScreen label="Setting up your classroom…" />;
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
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: "'Source Sans 3', 'Inter', sans-serif" }}>
      <AttachmentPreviewModal />
      <SaveErrorBanner error={saveError} onRetry={retryNow} />
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
        <aside className={`hidden lg:flex lg:flex-col w-64 min-h-screen flex-shrink-0 ${isAdmin ? "text-white" : "bg-white"}`} style={isAdmin ? { background: C.dark } : { borderRight: `1px solid ${C.border}` }}>
          <SidebarContent data={data} isAdmin={isAdmin} tab={tab} goTo={goTo} logout={logout} navSections={NAV_SECTIONS} />
        </aside>

        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
            <aside
              className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col shadow-2xl ${isAdmin ? "text-white" : "bg-white"}`}
              style={isAdmin ? { background: C.dark } : {}}
            >
              <button onClick={() => setMobileNavOpen(false)} className="self-end m-3 mb-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: isAdmin ? C.gray : C.sub }}>
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
          {tab === "students" && isAdmin && <AdminStudentsView data={data} setData={setData} onViewStudent={(key) => { setViewStudentKey(key); goTo("student-detail"); }} refreshProfiles={refreshProfiles} />}
          {tab === "team-activity" && isAdmin && <TeamActivityView data={data} setData={setData} onViewStudent={(key) => { setViewStudentKey(key); goTo("student-detail"); }} goTo={goTo} />}
          {tab === "coadmins" && isAdmin && <CoAdminsView data={data} setData={setData} goTo={goTo} refreshProfiles={refreshProfiles} />}
          {tab === "student-detail" && isAdmin && <AdminStudentDetailView data={data} setData={setData} studentKey={viewStudentKey} goTo={goTo} />}
          {tab === "trash" && isSuperAdmin && <TrashView data={data} setData={setData} />}
          {tab === "datesheet" && <DatesheetView data={data} setData={setData} />}
          {tab === "timetables" && <TimetablesView data={data} setData={setData} />}
          {tab === "exams" && <ExamsView data={data} setData={setData} />}
          {tab === "announcements" && <AnnouncementsView data={data} setData={setData} isAdmin={isAdmin} goTo={goTo} />}
          {tab === "progress" && <ProgressView data={data} setData={setData} isAdmin={isAdmin} />}
          {tab === "resources" && <ResourcesView data={data} setData={setData} />}
          {tab === "settings" && <SettingsView data={data} setData={setData} goTo={goTo} refreshProfiles={refreshProfiles} />}
        </main>
      </div>
    </div>
  );
}
