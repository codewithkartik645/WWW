import React, { useState, useMemo } from "react";
import {
  Plus, Trash2, Upload, Download, Eye, X, FileText, EyeOff,
} from "lucide-react";
import {
  C, uid, isAdminKey, DEFAULT_DEPT_ID, deptName,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash } from "../utils/activity";
import {
  openAttachment,
} from "../utils/files";
import {
  Card, Badge, useDeleteConfirm, ResourceLine,
} from "../components/UI";
import { uploadAttachment } from "../lib/uploadAttachment";

function CoursesView({ data, setData, editable }) {
  const isDirector = data.profiles[data.session]?.role === "admin";
  const isHOD = isAdminKey(data.session, data.profiles) && !isDirector;
  const myDeptId = isHOD ? (data.profiles[data.session]?.departmentId || data.departments[0]?.id) : null;
  const canManageCourse = (c) => isDirector || (isHOD && (c.departmentId || data.departments[0]?.id) === myDeptId);

  const [deptTab, setDeptTab] = useState(isHOD ? myDeptId : "all");
  const [newUnit, setNewUnit] = useState({});
  const [semesterInput, setSemesterInput] = useState(data.semester);
  const [newSubject, setNewSubject] = useState({ code: "", name: "", credits: 3, category: "Core", departmentId: isHOD ? myDeptId : (data.departments[0]?.id || DEFAULT_DEPT_ID) });

  const toggleTopic = (courseId, unitId) => setData((d) => ({ ...d, courses: d.courses.map((c) => c.id !== courseId ? c : { ...c, units: c.units.map((u) => u.id === unitId ? { ...u, done: !u.done } : u) }) }));
  const setElective = (courseId, name) => setData((d) => ({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, name } : c) }));
  const addUnit = (courseId) => {
    const name = (newUnit[courseId] || "").trim();
    if (!name) return;
    setData((d) => logActivity({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, units: [...c.units, u(uid(), name)] } : c) }, `Unit added to ${data.courses.find((c) => c.id === courseId)?.code}: ${name}`));
    setNewUnit((s) => ({ ...s, [courseId]: "" }));
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const removeUnit = (courseId, unitId) => {
    const course = data.courses.find((c) => c.id === courseId);
    const item = course?.units.find((u) => u.id === unitId);
    setData((d) => moveToTrash({ ...d, courses: d.courses.map((c) => c.id !== courseId ? c : { ...c, units: c.units.filter((u) => u.id !== unitId) }) }, "courseUnit", item, `Unit "${item?.name || "unit"}" (${course?.code || ""})`, { courseId }));
  };
  const toggleCourseHidden = (courseId) => setData((d) => logActivity({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, hidden: !c.hidden } : c) }, `Subject ${data.courses.find((c) => c.id === courseId)?.hidden ? "shown" : "hidden"}: ${data.courses.find((c) => c.id === courseId)?.code}`));
  const toggleUnitHidden = (courseId, unitId) => setData((d) => ({ ...d, courses: d.courses.map((c) => c.id !== courseId ? c : { ...c, units: c.units.map((u) => u.id === unitId ? { ...u, hidden: !u.hidden } : u) }) }));
  const saveSemester = () => setData((d) => logActivity({ ...d, semester: semesterInput }, `Semester updated to: ${semesterInput}`));
  const palette = [C.purple, "#2C4A63", C.amber, "#A34C6D", C.green, "#4A4335", "#6B4423"];
  const addSubject = () => {
    if (!newSubject.code.trim() || !newSubject.name.trim()) return;
    const targetDept = isHOD ? myDeptId : (newSubject.departmentId || data.departments[0]?.id);
    const color = palette[data.courses.length % palette.length];
    const course = { id: uid(), code: newSubject.code.trim(), name: newSubject.name.trim(), credits: Number(newSubject.credits) || 0, category: newSubject.category, departmentId: targetDept, color, units: [] };
    setData((d) => logActivity({ ...d, courses: [...d.courses, course] }, `Subject added: ${course.code} — ${course.name} (${deptName(data, targetDept)})`));
    setNewSubject({ code: "", name: "", credits: 3, category: "Core", departmentId: newSubject.departmentId });
  };
  const removeSubject = (courseId) => {
    const course = data.courses.find((c) => c.id === courseId);
    confirmDelete(`Subject "${course?.code} — ${course?.name}" and all its unit-wise progress`, () => {
      setData((d) => moveToTrash({ ...d, courses: d.courses.filter((c) => c.id !== courseId) }, "course", course, `Subject: ${course?.code} — ${course?.name}`));
    });
  };

  const uploadSyllabus = async (courseId, file) => {
    if (!file) return;
    if (file.size > 25_000_000) { alert("That file is larger than 25MB — pick a smaller PDF."); return; }
    const { url: dataUrl } = await uploadAttachment(file); // "dataUrl" name kept for compatibility; it's a real Storage URL now
    const course = data.courses.find((c) => c.id === courseId);
    setData((d) => logActivity({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, syllabus: { fileName: file.name, fileType: file.type, dataUrl } } : c) }, `Syllabus uploaded: ${course?.code}`));
  };
  const removeSyllabus = (courseId) => {
    const course = data.courses.find((c) => c.id === courseId);
    confirmDelete(`Syllabus for "${course?.code}"`, () => {
      setData((d) => moveToTrash({ ...d, courses: d.courses.map((c) => c.id === courseId ? { ...c, syllabus: null } : c) }, "courseSyllabus", course?.syllabus, `Syllabus: ${course?.code}`, { courseId }));
    });
  };

  const grouped = useMemo(() => {
    const cats = {};
    let visibleCourses = editable ? data.courses : data.courses.filter((c) => !c.hidden);
    if (!editable) {
      const myStudentDept = data.profiles[data.session]?.departmentId || data.departments[0]?.id;
      visibleCourses = visibleCourses.filter((c) => (c.departmentId || data.departments[0]?.id) === myStudentDept);
    } else if (isHOD) {
      visibleCourses = visibleCourses.filter((c) => (c.departmentId || data.departments[0]?.id) === myDeptId); // HOD never sees another department's subjects
    } else if (deptTab !== "all") {
      visibleCourses = visibleCourses.filter((c) => (c.departmentId || data.departments[0]?.id) === deptTab);
    }
    visibleCourses.forEach((c) => {
      const course = editable ? c : { ...c, units: c.units.filter((u) => !u.hidden) };
      (cats[c.category] = cats[c.category] || []).push(course);
    });
    return cats;
  }, [data.courses, editable, deptTab, isHOD, myDeptId, data.session, data.profiles, data.departments]);

  const materialsFor = (courseId) => data.resources.filter((r) => r.courseId === courseId);

  return (
    <div>
      {deleteModal}
      {editable ? (
        <Card className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1">
            <div className="text-xs font-semibold text-[#A79E8C] mb-1">CURRENT SEMESTER</div>
            <input value={semesterInput} onChange={(e) => setSemesterInput(e.target.value)} placeholder="e.g. VI Semester · B.Tech CSE · AKTU (Even 2026-27)" className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm w-full" />
          </div>
          <button onClick={saveSemester} className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}>Update</button>
        </Card>
      ) : (
        <p className="text-sm text-[#6E6455] -mt-4 mb-6">{data.semester}</p>
      )}
      {editable && <p className="text-sm text-[#6E6455] -mt-2 mb-4">Unit-wise syllabus management — add a subject when the semester changes, or edit units on existing ones.</p>}

      {editable && isDirector && data.departments.length > 1 && (
        <div className="flex gap-1 bg-white border border-[#E6DFD1] rounded-lg p-1 mb-4 w-fit flex-wrap">
          <button onClick={() => setDeptTab("all")} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === "all" ? "text-white" : "text-[#6E6455]"}`} style={deptTab === "all" ? { background: C.purple } : {}}>All Departments</button>
          {data.departments.map((dp) => (
            <button key={dp.id} onClick={() => setDeptTab(dp.id)} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === dp.id ? "text-white" : "text-[#6E6455]"}`} style={deptTab === dp.id ? { background: C.purple } : {}}>
              {dp.name}
            </button>
          ))}
        </div>
      )}
      {editable && isHOD && data.departments.length > 1 && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white border border-[#E6DFD1] w-fit mb-4" style={{ color: "#2B2620" }}>
          <b>{deptName(data, myDeptId)}</b> <span style={{ color: "#A79E8C" }}>— you only see subjects in your own department</span>
        </div>
      )}

      {editable && (isDirector || deptTab === myDeptId) && (
        <Card className="mb-6">
          <div className="text-xs font-semibold text-[#A79E8C] mb-2">ADD A NEW SUBJECT</div>
          <div className="grid sm:grid-cols-5 gap-2">
            <input value={newSubject.code} onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })} placeholder="Code, e.g. BCS601" className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm" />
            <input value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} placeholder="Subject name" className="sm:col-span-2 border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm" />
            <input type="number" min="0" value={newSubject.credits} onChange={(e) => setNewSubject({ ...newSubject, credits: e.target.value })} placeholder="Credits" className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm" />
            <select value={newSubject.category} onChange={(e) => setNewSubject({ ...newSubject, category: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
              <option>Core</option><option>Elective I</option><option>Elective II</option><option>Lab</option><option>Project</option><option>Non-Credit</option>
            </select>
            {isDirector && data.departments.length > 1 && (
              <select value={newSubject.departmentId} onChange={(e) => setNewSubject({ ...newSubject, departmentId: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm sm:col-span-2">
                {data.departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
              </select>
            )}
          </div>
          <button onClick={addSubject} className="mt-3 flex items-center gap-1 text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Add Subject</button>
        </Card>
      )}

      {Object.entries(grouped).map(([cat, courses]) => (
        <div key={cat} className="mb-6">
          <div className="text-xs font-semibold text-[#A79E8C] mb-2 uppercase tracking-wide">{cat}</div>
          <div className="grid sm:grid-cols-2 gap-4">
            {courses.map((c) => {
              const done = c.units.filter((u) => u.done).length;
              const pct = c.units.length ? Math.round((done / c.units.length) * 100) : 0;
              const mats = materialsFor(c.id);
              return (
                <Card key={c.id} className={c.hidden && editable ? "opacity-60" : ""}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-[#A79E8C]">{c.code}{c.credits ? ` · ${c.credits} cr` : ""}</span>
                    <div className="flex items-center gap-2">
                      {editable && data.departments.length > 1 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#F6F0E4", color: "#6E6455" }}>{deptName(data, c.departmentId || data.departments[0]?.id)}</span>}
                      {editable && !canManageCourse(c) && <span className="text-[9px]" style={{ color: "#A79E8C" }}>view only</span>}
                      {c.hidden && editable && <Badge color="#A79E8C">hidden</Badge>}
                      <span className="text-xs font-semibold" style={{ color: c.color }}>{pct}%</span>
                      {canManageCourse(c) && editable && (
                        <button onClick={() => toggleCourseHidden(c.id)} title={c.hidden ? "Show to students" : "Hide from students"} className="text-[#D9D0BC] hover:text-[#2B2620]">
                          {c.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      {canManageCourse(c) && editable && <button onClick={() => removeSubject(c.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={13} /></button>}
                    </div>
                  </div>
                  {c.options ? (
                    <select value={c.name} onChange={(e) => setElective(c.id, e.target.value)} className="font-h font-semibold text-[15px] mb-2 bg-transparent border-b border-[#E6DFD1] w-full pb-1">
                      {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : <div className="font-h font-semibold text-[15px] mb-2">{c.name}</div>}
                  <div className="h-1.5 bg-[#E6DFD1] rounded mb-3"><div className="h-1.5 rounded" style={{ width: `${pct}%`, background: c.color }} /></div>

                  <div className="text-[11px] font-semibold text-[#A79E8C] mb-1.5">UNIT-WISE PROGRESS</div>
                  <div className="space-y-1.5 mb-2">
                    {c.units.map((u) => (
                      <label key={u.id} className={`flex items-center gap-2 text-sm group ${u.hidden && editable ? "opacity-50" : ""} ${editable ? "cursor-default" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          checked={u.done}
                          disabled={editable}
                          onChange={() => !editable && toggleTopic(c.id, u.id)}
                          title={editable ? "Only the student can mark a topic complete" : ""}
                          style={{ accentColor: c.color }}
                        />
                        <span className={`flex-1 ${u.done ? "line-through text-[#B7AC95]" : ""}`}>{u.name}{u.hidden && editable ? " (hidden)" : ""}</span>
                        {editable && canManageCourse(c) && (
                          <button onClick={() => toggleUnitHidden(c.id, u.id)} title={u.hidden ? "Show to students" : "Hide from students"} className="opacity-0 group-hover:opacity-100 text-[#D9D0BC] hover:text-[#2B2620]">
                            {u.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                        {editable && canManageCourse(c) && <button onClick={() => confirmDelete(`Unit "${u.name}"`, () => removeUnit(c.id, u.id))} className="opacity-0 group-hover:opacity-100 text-[#D9D0BC] hover:text-[#A6423A]"><X size={13} /></button>}
                      </label>
                    ))}
                  </div>
                  {editable && canManageCourse(c) && (
                    <div className="flex gap-2 mb-3">
                      <input value={newUnit[c.id] || ""} onChange={(e) => setNewUnit((s) => ({ ...s, [c.id]: e.target.value }))} placeholder="Add unit/topic…" className="flex-1 border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-xs" />
                      <button onClick={() => addUnit(c.id)} className="text-xs px-2 py-1.5 rounded-lg text-white" style={{ background: c.color }}><Plus size={13} /></button>
                    </div>
                  )}

                  {mats.length > 0 && (
                    <div className="pt-2 border-t border-[#F1EADD]">
                      <div className="text-[11px] font-semibold text-[#A79E8C] mb-1.5">MATERIAL</div>
                      {mats.map((r) => <ResourceLine key={r.id} r={r} />)}
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#F1EADD] mt-2">
                    <div className="text-[11px] font-semibold text-[#A79E8C] mb-1.5">SYLLABUS (PDF)</div>
                    {c.syllabus ? (
                      <div className="flex items-center justify-between gap-2">
                        {/* View opens the PDF inline in a new tab; Download is a separate explicit action — the
                            old single link had `download` set, which forced a save dialog and blocked viewing. */}
                        <button type="button" onClick={() => openAttachment(c.syllabus.dataUrl, c.syllabus.fileName, c.syllabus.fileType)} className="flex items-center gap-1.5 text-xs truncate" style={{ color: C.purple }}>
                          <FileText size={13} /> {c.syllabus.fileName}
                        </button>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a href={c.syllabus.dataUrl} download={c.syllabus.fileName} title="Download" className="text-[#A79E8C] hover:text-[#2B2620]"><Download size={13} /></a>
                          {editable && canManageCourse(c) && <button onClick={() => removeSyllabus(c.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={13} /></button>}
                        </div>
                      </div>
                    ) : editable && canManageCourse(c) ? (
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: C.purple }}>
                        <Upload size={13} /> Upload syllabus PDF
                        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { uploadSyllabus(c.id, e.target.files[0]); e.target.value = ""; }} />
                      </label>
                    ) : (
                      <div className="text-xs" style={{ color: "#A79E8C" }}>Not uploaded yet.</div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      {editable && <p className="text-xs text-[#A79E8C]">To upload material for a subject, use the Resources page and pick the subject there.</p>}
    </div>
  );
}


export default CoursesView;
export { CoursesView };
