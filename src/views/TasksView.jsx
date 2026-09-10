import React, { useState } from "react";
import {
  Plus, Trash2,
  Check,
} from "lucide-react";
import {
  C, uid, fmt,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, Badge, useDeleteConfirm,
} from "../components/UI";

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
      <div className="flex gap-1 bg-white border border-[#E6DFD1] rounded-lg p-1 w-fit mb-4">
        {["all", "pending", "completed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-md capitalize ${filter === f ? "text-white" : "text-[#6E6455]"}`} style={filter === f ? { background: C.purple } : {}}>{f}</button>
        ))}
      </div>

      <Card className="mb-4">
        <div className="text-xs font-semibold text-[#A79E8C] mb-2">{editable ? "ASSIGN A TASK / DEADLINE" : "ADD A TASK"}</div>
        <div className="grid sm:grid-cols-5 gap-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" className="sm:col-span-2 border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm" />
          <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
            {data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
          <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm" />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
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
                <div className={`text-sm ${t.status === "done" ? "line-through text-[#B7AC95]" : ""}`}>{t.title}</div>
                <div className="text-xs text-[#A79E8C]">{courseCode(t.courseId)} {t.due && `· Due ${fmt(t.due)}`}{editable && t.ownerKey && ` · ${data.profiles[t.ownerKey]?.name || "Student"}'s task`}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge color={priColor[t.priority]}>{t.priority}</Badge>
              {editable && t.ownerKey && <Badge color={C.green}>Personal</Badge>}
              <button onClick={() => confirmDelete(`Task "${t.title}"`, () => removeTask(t.id))} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={15} /></button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="text-sm text-[#A79E8C]">Nothing here.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Datesheet (admin) ------------------------------ */


export default TasksView;
export { TasksView };
