import React, { useState } from "react";
import {
  CalendarClock, Plus, Wand2, X, RefreshCw, Pencil,
} from "lucide-react";
import {
  C, uid, fmtFull,
  daysUntil, DAYS,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash, generateRecommendedBlocks } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, useDeleteConfirm,
} from "../components/UI";

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
      {data.datesheets.length === 0 && <Card><div className="text-sm text-[#A79E8C]">Upload a datesheet first — timetables generate automatically from it.</div></Card>}
      {data.datesheets.map((ds) => {
        const blocks = data.plannerBlocks.filter((b) => b.sourceId === ds.id).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
        const dLeft = daysUntil(ds.date);
        const urgency = dLeft < 0 ? { bg: "#F4EEE1", fg: "#6E6455", label: "Past" } : dLeft <= 3 ? { bg: "#F1E1DC", fg: C.red, label: `${dLeft}d left` } : dLeft <= 7 ? { bg: "#F5E9CC", fg: "#9C6B24", label: `${dLeft}d left` } : { bg: "#EEF2E7", fg: C.green, label: `${dLeft}d left` };
        return (
          <Card key={ds.id} className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ background: "linear-gradient(135deg, #FAF6EF, #FFFFFF)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Wand2 size={17} /></div>
                <div>
                  <div className="font-h font-semibold flex items-center gap-2">{ds.title} <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: urgency.bg, color: urgency.fg }}>{urgency.label}</span></div>
                  <div className="text-xs text-[#A79E8C]">{ds.examType} · {fmtFull(ds.date)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => addBlock(ds)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#E6DFD1] text-[#6E6455] hover:bg-[#FAF6EF]"><Plus size={13} /> Add entry</button>
                <button onClick={() => regenerate(ds)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: C.purple }}><RefreshCw size={13} /> Regenerate</button>
              </div>
            </div>
            <div className="px-5 pb-5">
            {blocks.length === 0 ? <div className="text-sm text-[#A79E8C]">Not generated yet — it will appear automatically within 7 days of the exam, click Regenerate, or Add entry to build one manually.</div> : (
              <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {blocks.map((b) => (
                  editingId === b.id ? (
                    <div key={b.id} className="rounded-xl p-2.5 text-xs bg-white border-2 shadow-sm" style={{ borderColor: b.color }}>
                      <select value={editForm.day} onChange={(e) => setEditForm({ ...editForm, day: e.target.value })} className="border border-[#E6DFD1] rounded px-1 py-1 text-xs w-full mb-1">
                        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <div className="flex gap-1 mb-1">
                        <input type="time" value={editForm.start} onChange={(e) => setEditForm({ ...editForm, start: e.target.value })} className="border border-[#E6DFD1] rounded px-1 py-1 text-xs w-full" />
                        <input type="time" value={editForm.end} onChange={(e) => setEditForm({ ...editForm, end: e.target.value })} className="border border-[#E6DFD1] rounded px-1 py-1 text-xs w-full" />
                      </div>
                      <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} placeholder="Label" className="border border-[#E6DFD1] rounded px-1 py-1 text-xs w-full mb-1" />
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(b.id)} className="flex-1 text-white text-xs py-1 rounded" style={{ background: C.purple }}>Save</button>
                        <button onClick={cancelEdit} className="flex-1 text-xs py-1 rounded border border-[#E6DFD1]">Cancel</button>
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


export default TimetablesView;
export { TimetablesView };
