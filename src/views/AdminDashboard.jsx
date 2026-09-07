import React, { useMemo } from "react";
import {
  CalendarDays, BookOpen, ListChecks, Wand2, ClipboardList,
} from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer } from "recharts";
import {
  C, fmt,
  daysUntil,
} from "../theme";
import {
  } from "../data/seedData";
import {
  } from "../utils/files";
import {
  Card, Badge,
} from "../components/UI";

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
          <Card key={s.label}><div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${s.color}1A`, color: s.color }}><s.icon size={17} /></div><div className="font-h text-xl font-semibold">{s.value}</div><div className="text-xs text-[#6E6455] mt-0.5">{s.label}</div></Card>
        ))}
      </div>

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
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.activityLog.slice(0, 6).map((a) => (
              <div key={a.id} className="text-xs"><div className="text-[#2B2620]">{a.text}</div><div className="text-[#A79E8C]">{new Date(a.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div></div>
            ))}
            {data.activityLog.length === 0 && <div className="text-sm text-[#A79E8C]">No activity yet.</div>}
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

export default AdminDashboard;
export { AdminDashboard };
