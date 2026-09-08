import React, {} from "react";
import {
  ChevronLeft,
  Users2, TrendingUp, ListChecks, CalendarClock,
  Check, Trash2,
} from "lucide-react";
import {
  C, deptName, fmt,
} from "../theme";
import {
  } from "../data/seedData";
import { moveToTrash } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, Badge, useDeleteConfirm,
} from "../components/UI";

function AdminStudentDetailView({ data, setData, studentKey, goTo }) {
  const profile = studentKey ? data.profiles[studentKey] : null;
  const [confirmDelete, deleteModal] = useDeleteConfirm();

  if (!profile) {
    return (
      <div className="space-y-4">
        <Card><p className="text-sm text-[#6E6455]">No student selected. Go back to Manage Students and choose one to view.</p></Card>
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
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 overflow-hidden" style={{ background: "#4F7A5B" }}>
            {profile.photo ? <img src={profile.photo} alt="" className="w-full h-full object-cover" /> : (profile.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-h font-semibold text-lg" style={{ color: "#2B2620" }}>{profile.name || "Student"}</div>
            <div className="text-xs" style={{ color: "#A79E8C" }}>{profile.email} · {deptName(data, profile.departmentId || data.departments[0]?.id)}</div>
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-4 gap-3">
        <Card className="!p-3 text-center"><div className="font-h text-xl font-semibold" style={{ color: C.purple }}>{enrollments.length}</div><div className="text-[11px]" style={{ color: "#A79E8C" }}>Co-curricular enrollments</div></Card>
        <Card className="!p-3 text-center"><div className="font-h text-xl font-semibold" style={{ color: C.green }}>{tasks.filter((t) => t.status === "done").length}/{tasks.length}</div><div className="text-[11px]" style={{ color: "#A79E8C" }}>Personal tasks done</div></Card>
        <Card className="!p-3 text-center"><div className="font-h text-xl font-semibold" style={{ color: "#9C6B24" }}>{(totalMinutes / 60).toFixed(1)}h</div><div className="text-[11px]" style={{ color: "#A79E8C" }}>Study time logged</div></Card>
        <Card className="!p-3 text-center"><div className="font-h text-xl font-semibold" style={{ color: "#2C4A63" }}>{selfBlocks.length}</div><div className="text-[11px]" style={{ color: "#A79E8C" }}>Self-study blocks</div></Card>
      </div>

      <Card>
        <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#2B2620" }}><Users2 size={13} /> CO-CURRICULAR ENROLLMENTS</div>
        <div className="space-y-2">
          {enrollments.map((e) => {
            const done = e.units.filter((u) => u.done).length;
            const pct = e.units.length ? Math.round((done / e.units.length) * 100) : 0;
            return (
              <div key={e.id} className="border border-[#E6DFD1] rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-xs" style={{ color: "#A79E8C" }}>{e.provider} · {done}/{e.units.length} modules ({pct}%)</div>
                </div>
                <button onClick={() => removeEnrollment(e.id)} className="text-[#D9D0BC] hover:text-[#A6423A] flex-shrink-0"><Trash2 size={14} /></button>
              </div>
            );
          })}
          {enrollments.length === 0 && <div className="text-sm text-[#A79E8C]">Not enrolled in anything yet.</div>}
        </div>
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#2B2620" }}><TrendingUp size={13} /> STUDY LOG ({(totalMinutes / 60).toFixed(1)}h total)</div>
        <div className="space-y-1.5">
          {studyLogs.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm py-1">
              <span>{courseCode(l.courseId)} · {l.minutes} min · {fmt(l.date)}</span>
              <button onClick={() => removeStudyLog(l.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={13} /></button>
            </div>
          ))}
          {studyLogs.length === 0 && <div className="text-sm text-[#A79E8C]">No study sessions logged yet.</div>}
        </div>
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#2B2620" }}><ListChecks size={13} /> TASKS</div>
        <p className="text-xs mb-3" style={{ color: "#A79E8C" }}>Personal tasks this student added themselves. They also see {sharedTasks.length} task{sharedTasks.length === 1 ? "" : "s"} assigned to everyone — manage those from Tasks &amp; Deadlines.</p>
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 border border-[#E6DFD1] rounded-lg p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <button onClick={() => cycleTaskStatus(t.id)} className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0"
                  style={t.status === "done" ? { background: C.green, borderColor: C.green } : t.status === "in-progress" ? { background: C.amber, borderColor: C.amber } : { borderColor: C.border }}>
                  {t.status === "done" && <Check size={12} className="text-white" />}
                </button>
                <div className="min-w-0">
                  <div className={`text-sm truncate ${t.status === "done" ? "line-through text-[#B7AC95]" : ""}`}>{t.title}</div>
                  <div className="text-xs" style={{ color: "#A79E8C" }}>{courseCode(t.courseId)} {t.due && `· Due ${fmt(t.due)}`}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge color={priColor[t.priority]}>{t.priority}</Badge>
                <button onClick={() => removeTask(t.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <div className="text-sm text-[#A79E8C]">No personal tasks added yet.</div>}
        </div>
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "#2B2620" }}><CalendarClock size={13} /> SELF-STUDY PLANNER BLOCKS</div>
        <div className="space-y-1.5">
          {selfBlocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-sm py-1">
              <span>{b.day} · {b.start}–{b.end} · {b.label}</span>
              <button onClick={() => removeBlock(b.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={13} /></button>
            </div>
          ))}
          {selfBlocks.length === 0 && <div className="text-sm text-[#A79E8C]">No self-study blocks scheduled yet.</div>}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Trash / Restore ------------------------------ */


export default AdminStudentDetailView;
export { AdminStudentDetailView };
