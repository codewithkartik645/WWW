import React, { useMemo } from "react";
import {
  CalendarDays, BookOpen, ListChecks, Wand2, ClipboardList, Users2, Building2, ChevronRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer } from "recharts";
import {
  C, fmt,
  daysUntil, isDeptActive, isAdminKey,
} from "../theme";
import {
  } from "../data/seedData";
import {
  } from "../utils/files";
import {
  Card, Badge,
} from "../components/UI";

function AdminDashboard({ data, setData, goTo }) {
  const myProfile = data.profiles[data.session];
  const isDirector = myProfile?.role === "admin";
  const isHOD = !isDirector;
  const myDeptId = isHOD ? (myProfile?.departmentId || data.departments[0]?.id) : null;
  const hasDepts = data.departments.length > 1;
  const deptOf = (courseOrDatesheet) => courseOrDatesheet.departmentId || data.departments[0]?.id;

  // Everything on this page is scoped to the HOD's own department; a Director sees the
  // combined totals up top, plus a per-department breakdown grid further down.
  const scopedCourses = isHOD ? data.courses.filter((c) => deptOf(c) === myDeptId) : data.courses;
  const scopedDatesheets = isHOD ? data.datesheets.filter((ds) => deptOf(ds) === myDeptId) : data.datesheets;
  const scopedEvents = isHOD ? data.calendarEvents.filter((e) => !e.departmentId || e.departmentId === myDeptId) : data.calendarEvents;

  const upcomingDatesheets = [...scopedDatesheets].map((e) => ({ ...e, dLeft: daysUntil(e.date) })).filter((e) => e.dLeft >= 0).sort((a, b) => a.dLeft - b.dLeft);
  const pendingTasks = data.tasks.filter((t) => t.status !== "done").length;
  const monthEvents = scopedEvents.filter((e) => new Date(e.date).getMonth() === new Date().getMonth()).length;

  const stats = [
    { label: "Subjects", value: scopedCourses.length, icon: BookOpen, color: C.purple },
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

  // Per-department snapshot for the Director — the "one central dashboard, clear
  // department-wise view" the whole point of keeping departments separate is for.
  const departmentSnapshots = useMemo(() => {
    if (!isDirector) return [];
    return data.departments.map((dp) => {
      const deptCourses = data.courses.filter((c) => deptOf(c) === dp.id);
      const deptStudents = Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles) && (data.profiles[k]?.departmentId || data.departments[0]?.id) === dp.id);
      const hodKey = Object.keys(data.profiles).find((k) => data.profiles[k]?.role === "coadmin" && data.profiles[k]?.departmentId === dp.id);
      const deptDatesheets = data.datesheets.filter((ds) => deptOf(ds) === dp.id).map((ds) => ({ ...ds, dLeft: daysUntil(ds.date) })).filter((ds) => ds.dLeft >= 0);
      return {
        dept: dp,
        studentCount: deptStudents.length,
        courseCount: deptCourses.length,
        hodName: hodKey ? data.profiles[hodKey]?.name : null,
        upcomingExams: deptDatesheets.length,
      };
    });
  }, [isDirector, data]);

  return (
    <div>
      {isHOD && hasDepts && (
        <div className="mb-4 flex items-center gap-2 text-xs px-3 py-2 rounded-lg w-fit" style={{ background: "#F6F0E4", color: "#6E6455" }}>
          <Building2 size={13} /> You're viewing <b>{data.departments.find((d) => d.id === myDeptId)?.name}</b> — everything below is scoped to your department.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}><div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${s.color}1A`, color: s.color }}><s.icon size={17} /></div><div className="font-h text-xl font-semibold">{s.value}</div><div className="text-xs text-[#6E6455] mt-0.5">{s.label}</div></Card>
        ))}
      </div>

      {isDirector && hasDepts && (
        <Card className="mb-6">
          <div className="font-h font-semibold mb-1">Departments at a glance</div>
          <p className="text-xs mb-3" style={{ color: "#A79E8C" }}>Every department, managed separately, in one place. Click through to Manage Students or Co-Admins for the full picture.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departmentSnapshots.map(({ dept, studentCount, courseCount, hodName, upcomingExams }) => (
              <button
                key={dept.id}
                onClick={() => goTo("students")}
                className="text-left border rounded-lg p-3.5 transition-colors hover:bg-[#FAF6EF]"
                style={{ borderColor: "#E6DFD1", opacity: isDeptActive(dept) ? 1 : 0.65, background: isDeptActive(dept) ? "transparent" : "#F6F0E4" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    <Building2 size={14} style={{ color: C.purple }} /> {dept.name}
                  </div>
                  <ChevronRight size={14} style={{ color: "#B7AC95" }} />
                </div>
                {!isDeptActive(dept) && <Badge color="#A6423A">Inactive</Badge>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: C.purpleSoft, color: C.purple }}><Users2 size={10} className="inline mr-1" />{studentCount} student{studentCount === 1 ? "" : "s"}</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#F6F0E4", color: "#6E6455" }}>{courseCount} subject{courseCount === 1 ? "" : "s"}</span>
                  {upcomingExams > 0 && <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#F5E9CC", color: "#9C6B24" }}>{upcomingExams} exam{upcomingExams === 1 ? "" : "s"} upcoming</span>}
                </div>
                <div className="text-xs mt-2" style={{ color: "#A79E8C" }}>{hodName ? `HOD: ${hodName}` : "No HOD assigned — you're managing this one directly"}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6 flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Wand2 size={20} /></div>
        <div className="flex-1">
          <div className="font-h font-semibold">Automatic Timetable Generation</div>
          <p className="text-xs text-[#6E6455] mt-0.5">Timetable is generated automatically the week before each ST / PUT if not generated manually.</p>
        </div>
        <button onClick={toggleAuto} className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: data.autoMode ? "#E4EADD" : "#F1E1DC", color: data.autoMode ? "#34502F" : "#6E2C25" }}>Auto Mode: {data.autoMode ? "ON" : "OFF"}</button>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="font-h font-semibold mb-3">Upcoming Dates Overview</div>
          <div className="space-y-2">
            {upcomingDatesheets.slice(0, 5).map((ds) => (
              <div key={ds.id} className="flex items-center justify-between text-sm">
                <div><div>{ds.title}</div><div className="text-xs text-[#A79E8C]">{fmt(ds.date)}</div></div>
                <Badge color={ds.dLeft <= 7 ? C.red : C.amber}>In {ds.dLeft} Days</Badge>
              </div>
            ))}
            {upcomingDatesheets.length === 0 && <div className="text-sm text-[#A79E8C]">None yet.</div>}
          </div>
          <button onClick={() => goTo("calendar")} className="text-xs mt-3" style={{ color: C.purple }}>View Full Calendar →</button>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Datesheet & Timetable</div>
          <p className="text-xs text-[#6E6455] mb-3">Upload a datesheet and the recommended revision week generates automatically.</p>
          <button onClick={() => goTo("datesheet")} className="text-sm text-white px-3 py-2 rounded-lg w-full mb-2" style={{ background: C.purple }}>Upload Datesheet</button>
          <button onClick={() => goTo("timetables")} className="text-sm px-3 py-2 rounded-lg w-full border border-[#E6DFD1]">View Generated Timetables</button>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Recent Activity</div>
          <p className="text-xs mb-2" style={{ color: "#A79E8C" }}>See who did what, filterable by person or role.</p>
          <button onClick={() => goTo("team-activity")} className="text-sm px-3 py-2 rounded-lg w-full border border-[#E6DFD1]">Open Activity & Work →</button>
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

export default AdminDashboard;
export { AdminDashboard };
