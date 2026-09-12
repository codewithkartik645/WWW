import React, { useState } from "react";
import {
  CalendarClock, Plus, Trash2, Wand2,
  Building2,
  Award, Pencil,
} from "lucide-react";
import {
  C, uid, isAdminKey, deptName, toMin, DAYS, activeDepartments,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, useDeleteConfirm,
} from "../components/UI";

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
    if (isAdmin && isDirector && data.departments.length > 1 && deptTab === "all") return; // must pick a specific department first — see banner above
    const course = data.courses.find((c) => c.id === form.courseId);
    const kind = isAdmin ? "class" : "self";
    const ownerKey = isAdmin ? null : data.session; // self-study blocks belong to whichever student created them
    const departmentId = isAdmin ? (isHOD ? myDeptId : (deptTab !== "all" ? deptTab : (activeDepartments(data)[0]?.id || data.departments[0]?.id))) : studentDeptId;
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
    if (b.kind === "recommended" && b.departmentId && b.departmentId !== studentDeptId) return false; // ...and only their own department's auto-generated revision blocks
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
              <div className="text-sm font-semibold" style={{ color: "#2B2620" }}>{isAdmin ? "Edit class" : "Edit self-study block"}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select value={editForm.day} onChange={(e) => setEditForm({ ...editForm, day: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-xs col-span-2">
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="time" value={editForm.start} onChange={(e) => setEditForm({ ...editForm, start: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-xs" />
              <input type="time" value={editForm.end} onChange={(e) => setEditForm({ ...editForm, end: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-xs" />
            </div>
            <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} placeholder="Label" className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-xs w-full mb-4" />
            <div className="flex items-center justify-between gap-2">
              <button onClick={deleteBlock} className="text-xs px-3 py-1.5 rounded-lg text-[#A6423A] border border-[#F1E1DC] hover:bg-[#F5E9E5] flex items-center gap-1"><Trash2 size={12} /> Delete</button>
              <div className="flex gap-2">
                <button onClick={closeBlock} className="text-xs px-3 py-1.5 rounded-lg border border-[#E6DFD1]" style={{ color: "#2B2620" }}>Cancel</button>
                <button onClick={saveBlock} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: C.purple }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!isAdmin && !lockFilter && (
        <div className="flex gap-1 bg-white border border-[#E6DFD1] rounded-lg p-1 mb-4 w-fit">
          {["all", "self", "class", "recommended"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-md capitalize ${filter === f ? "text-white" : "text-[#6E6455]"}`} style={filter === f ? { background: C.purple } : {}}>
              {f === "class" ? "College Class" : f === "self" ? "Self Study" : f}
            </button>
          ))}
        </div>
      )}

      {isAdmin && isDirector && data.departments.length > 1 && (
        <div className="flex gap-1 bg-white border border-[#E6DFD1] rounded-lg p-1 mb-4 w-fit flex-wrap">
          <button onClick={() => setDeptTab("all")} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === "all" ? "text-white" : "text-[#6E6455]"}`} style={deptTab === "all" ? { background: C.purple } : {}}>All Departments</button>
          {data.departments.map((dp) => (
            <button key={dp.id} onClick={() => setDeptTab(dp.id)} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === dp.id ? "text-white" : "text-[#6E6455]"}`} style={deptTab === dp.id ? { background: C.purple } : {}}>
              {dp.name}
            </button>
          ))}
        </div>
      )}
      {isAdmin && isHOD && data.departments.length > 1 && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white border border-[#E6DFD1] w-fit mb-4" style={{ color: "#2B2620" }}>
          <b>{deptName(data, myDeptId)}</b> <span style={{ color: "#A79E8C" }}>— you only manage classes in your own department</span>
        </div>
      )}

      {(isAdmin || filter === "self") && (
        <Card className="mb-4">
          <div className="text-xs font-semibold text-[#A79E8C] mb-2">{isAdmin ? "SCHEDULE A RECURRING CLASS" : "ADD A SELF-STUDY BLOCK"}</div>
          {isAdmin && isDirector && data.departments.length > 1 && deptTab === "all" && (
            <div className="text-xs mb-2 px-2.5 py-1.5 rounded-lg w-fit" style={{ background: "#F5E9CC", color: "#9C6B24" }}>
              Pick a specific department tab above before scheduling — a class needs one department.
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-end">
            <div><div className="text-xs text-[#6E6455] mb-1">Day</div>
              <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
            </div>
            <div><div className="text-xs text-[#6E6455] mb-1">Start</div><input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm" /></div>
            <div><div className="text-xs text-[#6E6455] mb-1">End</div><input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm" /></div>
            <div><div className="text-xs text-[#6E6455] mb-1">Subject</div>
              <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
                <option value="">— optional —</option>{(isAdmin ? data.courses.filter((c) => (c.departmentId || data.departments[0]?.id) === (isHOD ? myDeptId : (deptTab !== "all" ? deptTab : data.departments[0]?.id))) : data.courses.filter((c) => (c.departmentId || data.departments[0]?.id) === studentDeptId)).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]"><div className="text-xs text-[#6E6455] mb-1">Label</div>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={isAdmin ? "e.g. DBMS Lecture" : "e.g. DBMS revision"} className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <button onClick={addBlock} className="flex items-center gap-1 text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Add</button>
          </div>
        </Card>
      )}
      {!isAdmin && lockFilter && filter === "class" && (
        <Card className="mb-4"><p className="text-xs text-[#6E6455]">This is the recurring class schedule your admin has set — it's read-only here.</p></Card>
      )}

      <Card className="overflow-x-auto !p-0" style={{ borderRadius: 18, boxShadow: "0 4px 20px rgba(76,29,149,0.07), 0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden", border: "1px solid #F1E7E0" }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2.5 flex-wrap gap-2" style={{ background: "linear-gradient(180deg, #FAF5EF 0%, #FFFFFF 100%)", borderBottom: "1px solid #F1EADD" }}>
          <div className="flex items-center gap-1.5">
            <CalendarClock size={13} color={C.purple} />
            <div className="font-h font-bold text-xs" style={{ color: "#2B2620", letterSpacing: "0.07em" }}>THIS WEEK</div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-medium flex-wrap justify-end">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#F6F0E4]" title="Choose which hours the grid shows">
              <select value={hourRange.start} onChange={(e) => updateHourRange({ ...hourRange, start: Number(e.target.value) })} className="bg-transparent font-semibold" style={{ border: "none", color: "#4A4335" }}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
              <span style={{ color: "#A79E8C" }}>–</span>
              <select value={hourRange.end} onChange={(e) => updateHourRange({ ...hourRange, end: Number(e.target.value) })} className="bg-transparent font-semibold" style={{ border: "none", color: "#4A4335" }}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "#F6F0E4", color: "#4A4335" }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.dark }} /> Class</span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "#EEF2E7", color: "#3C5E42" }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.green }} /> Self Study</span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "#F8F1DC", color: "#9C6B24" }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ border: `1.5px dashed ${C.amber}` }} /> Recommended</span>
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
                    ? { background: `linear-gradient(135deg, ${C.purple}, #7A2E3A)`, color: "#fff", boxShadow: "0 3px 8px rgba(124,58,237,0.4)", transform: "scale(1.06)" }
                    : { color: isWeekend ? "#C9A9AE" : "#4A4335", background: isWeekend ? "#F9F4EE" : "transparent" }}
                >{d}</span>
              </div>
            );
          })}
          {visibleHours.map((h, hi) => (
            <React.Fragment key={h}>
              <div className="text-right pr-2 font-bold" style={{ height: CELL_H, fontSize: 9, color: "#4A4335", letterSpacing: "0.02em" }}>{h > 12 ? h - 12 : h}<span style={{ fontSize: 6.5, marginLeft: 1 }}>{h >= 12 ? "PM" : "AM"}</span></div>
              {DAYS.map((d) => {
                const blocks = visibleBlocks.filter((b) => b.day === d && Math.floor(toMin(b.start) / 60) === h);
                const isToday = todayDayAbbr === d;
                const isWeekend = d === "Sat" || d === "Sun";
                return (
                  <div key={d} className="relative transition-colors"
                    style={{
                      height: CELL_H,
                      borderTop: "1px solid #F1E9DE",
                      borderLeft: "1px solid #F1E9DE",
                      background: isToday ? "linear-gradient(180deg, #FBF6F0 0%, #F6EFE7 100%)" : isWeekend ? "#FCFAF5" : hi % 2 === 0 ? "#FFFFFF" : "#FDFBF6",
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
                            // A class spanning more than 60 minutes overflows past its own hour
                            // row into the next row's <div>. Without an explicit z-index here,
                            // that next row's own background silently paints over the overflow
                            // (it only reappeared on hover, once hover:z-30 kicked in) — this
                            // keeps it visible all the time, not just while hovering.
                            zIndex: 10,
                            paddingLeft: 6, paddingRight: 4, paddingTop: 2, paddingBottom: 2,
                            fontSize: 9, color: "#fff",
                            background: `linear-gradient(140deg, ${baseColor}, ${baseColor}CC)`,
                            borderLeft: `2.5px solid ${baseColor === C.amber ? "#9C6B24" : "rgba(255,255,255,0.75)"}`,
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
        <Card className="mt-3 text-center py-6" style={{ borderStyle: "dashed", borderColor: "#E6D8D6", background: "#FBF7F2" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: C.purpleSoft }}>
            <CalendarClock size={16} color={C.purple} />
          </div>
          <div className="text-sm font-semibold" style={{ color: "#2B2620" }}>Your week is wide open</div>
          <div className="text-xs mt-0.5" style={{ color: "#A79E8C" }}>{isAdmin ? "Schedule a recurring class above to fill in the grid." : "Add a self-study block above to start planning your week."}</div>
        </Card>
      ) : (
        <div className="text-xs mt-2" style={{ color: "#A79E8C" }}>
          {isAdmin ? "Click a class block to edit or delete it." : "Click your own self-study blocks to edit or delete them."}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Tasks (shared) ------------------------------ */


export default PlannerView;
export { PlannerView };
