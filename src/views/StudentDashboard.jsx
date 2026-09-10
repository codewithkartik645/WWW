import React, {} from "react";
import {
  TrendingUp,
  Check, Flame, Megaphone, ClipboardList,
} from "lucide-react";
import {
  C, fmt,
  daysUntil, toMin, DAYS,
} from "../theme";
import {
  } from "../data/seedData";
import {
  } from "../utils/files";
import {
  Card, Badge, Donut, useStreak, weekLogHours,
} from "../components/UI";
import { coursesForUser } from "../utils/courseProgress";

function StudentDashboard({ data, setData, goTo }) {
  const dueTasks = data.tasks.filter((t) => t.status !== "done" && t.due).sort((a, b) => new Date(a.due) - new Date(b.due));
  const nextExam = data.datesheets.map((e) => ({ ...e, dLeft: daysUntil(e.date) })).filter((e) => e.dLeft >= 0).sort((a, b) => a.dLeft - b.dLeft)[0];

  const streak = useStreak(data.studyLogs);
  const myCourses = coursesForUser(data, data.session);
  const totalTopics = myCourses.reduce((s, c) => s + c.units.length, 0);
  const doneTopics = myCourses.reduce((s, c) => s + c.units.filter((u) => u.done).length, 0);
  const overallPct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;

  const todayName = DAYS[(new Date().getDay() + 6) % 7];
  const todaysBlocks = data.plannerBlocks.filter((b) => b.day === todayName).sort((a, b) => toMin(a.start) - toMin(b.start));
  const courseName = (id) => data.courses.find((c) => c.id === id)?.code;

  const weekHours = weekLogHours(data.studyLogs);
  const doneTasks = data.tasks.filter((t) => t.status === "done").length;

  const stats = [
    { label: "Study Streak", value: `${streak} Days`, icon: Flame, color: "#A6423A" },
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
            <div className="text-xs text-[#6E6455] mt-0.5">{s.label}</div>
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
                <div className="text-[#6E6455] text-xs mt-0.5">{a.message}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="font-h font-semibold mb-3">Today's Schedule</div>
          {todaysBlocks.length === 0 && <div className="text-sm text-[#A79E8C]">Nothing planned. <button onClick={() => goTo("planner")} className="underline" style={{ color: C.purple }}>Add a block</button></div>}
          <div className="space-y-2">
            {todaysBlocks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                <span className="font-mono text-xs text-[#6E6455] w-12">{b.start}</span>
                <span>{b.label}{b.courseId ? ` · ${courseName(b.courseId)}` : ""}</span>
                <Badge color={b.kind === "class" ? C.dark : b.kind === "recommended" ? C.amber : C.green}>{b.kind === "class" ? "class" : b.kind === "recommended" ? "recommended" : "self study"}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Upcoming Deadlines</div>
          {dueTasks.length === 0 && <div className="text-sm text-[#A79E8C]">All caught up.</div>}
          <div className="space-y-2">
            {dueTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title}</span><span className="text-xs text-[#A79E8C] font-mono">{fmt(t.due)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <div className="font-h font-semibold mb-3">Smart Timetable</div>
          <p className="text-xs text-[#6E6455] mb-3">Auto-generated the week before each ST / PUT, weighted toward subjects with the least syllabus covered.</p>
          <button onClick={() => goTo("exams")} className="text-sm px-3 py-2 rounded-lg text-white" style={{ background: C.purple }}>View Exams & Timetable</button>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Progress Overview</div>
          <div className="flex items-center gap-6">
            <Donut pct={overallPct} size={90} />
            <div><div className="font-h text-2xl font-semibold">{overallPct}%</div><div className="text-xs text-[#6E6455]">Overall syllabus progress</div></div>
          </div>
        </Card>
      </div>
    </div>
  );
}


export default StudentDashboard;
export { StudentDashboard };
