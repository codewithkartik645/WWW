import React, { useState, useMemo } from "react";
import {
  Plus, Trash2, X,
} from "lucide-react";
import {
  C, uid, fmt, makeUnit, deptName, activeDepartments,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, Badge, useDeleteConfirm, DepartmentScopeTabs,
} from "../components/UI";

function AdminCoCurricularView({ data, setData }) {
  const myProfile = data.profiles[data.session];
  const isDirector = myProfile?.role === "admin";
  const isHOD = myProfile?.role === "coadmin";
  const myDeptId = isHOD ? (myProfile?.departmentId || data.departments[0]?.id) : null;
  const hasDepts = data.departments.length > 1;

  const [form, setForm] = useState({ name: "", provider: "Data Discourse", date: "", notes: "" });
  const [postTo, setPostTo] = useState(isHOD ? myDeptId : "all");
  const [viewTab, setViewTab] = useState(isHOD ? myDeptId : "all");
  const [newModule, setNewModule] = useState({});

  const add = () => {
    if (!form.name.trim()) return;
    const departmentId = isHOD ? myDeptId : (postTo === "all" ? null : postTo);
    setData((d) => logActivity({ ...d, coCurricularCatalog: [...d.coCurricularCatalog, { id: uid(), ...form, departmentId }] }, `Co-curricular opportunity posted${departmentId ? ` (${deptName(d, departmentId)})` : " (all departments)"}: ${form.name}`));
    setForm({ ...form, name: "", date: "", notes: "" });
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  // An HOD may only manage catalog entries and enrollments tied to their own department —
  // never a campus-wide opportunity the Director posted, and never another department's students.
  const canManageCatalog = (c) => isDirector || (isHOD && c.departmentId === myDeptId);
  const remove = (id) => {
    const item = data.coCurricularCatalog.find((c) => c.id === id);
    confirmDelete(`Opportunity "${item?.name || "opportunity"}"`, () => {
      setData((d) => moveToTrash({ ...d, coCurricularCatalog: d.coCurricularCatalog.filter((c) => c.id !== id) }, "coCurricularCatalog", item, `Co-curricular opportunity: ${item?.name || "opportunity"}`));
    });
  };

  const addModule = (enrollId) => {
    const name = (newModule[enrollId] || "").trim();
    if (!name) return;
    setData((d) => logActivity({ ...d, enrollments: d.enrollments.map((e) => e.id === enrollId ? { ...e, units: [...e.units, makeUnit(uid(), name)] } : e) }, `Module added to ${data.enrollments.find((e) => e.id === enrollId)?.name}: ${name}`));
    setNewModule((s) => ({ ...s, [enrollId]: "" }));
  };
  const removeModule = (enrollId, unitId) => {
    const enroll = data.enrollments.find((e) => e.id === enrollId);
    const item = enroll?.units.find((u) => u.id === unitId);
    confirmDelete(`Module "${item?.name || "module"}"`, () => {
      setData((d) => moveToTrash({ ...d, enrollments: d.enrollments.map((e) => e.id !== enrollId ? e : { ...e, units: e.units.filter((u) => u.id !== unitId) }) }, "enrollmentModule", item, `Module: ${item?.name || "module"} (${enroll?.name || ""})`, { enrollId }));
    });
  };

  // Catalog: own department's postings plus every campus-wide one. The Director can narrow
  // further with the tab strip; an HOD only ever sees/manages their own department's.
  const visibleCatalog = useMemo(() => data.coCurricularCatalog.filter((c) => {
    if (isHOD) return !c.departmentId || c.departmentId === myDeptId;
    if (viewTab === "all") return true;
    return c.departmentId === viewTab;
  }), [data.coCurricularCatalog, isHOD, myDeptId, viewTab]);

  // Enrollments: scoped by the enrolled STUDENT's own department, since the enrollment
  // itself has no departmentId — it belongs to whichever student signed up for it.
  const enrollmentDeptId = (e) => data.profiles[e.ownerKey]?.departmentId || data.departments[0]?.id;
  const visibleEnrollments = useMemo(() => data.enrollments.filter((e) => {
    if (isHOD) return enrollmentDeptId(e) === myDeptId;
    if (viewTab === "all") return true;
    return enrollmentDeptId(e) === viewTab;
  }), [data.enrollments, isHOD, myDeptId, viewTab]);

  return (
    <div>
      {deleteModal}
      <p className="text-sm text-[#6E6455] -mt-4 mb-6">Post clubs, courses (Data Discourse, NPTEL, etc.), or events students can enroll in.</p>

      {(isDirector || isHOD) && hasDepts && <DepartmentScopeTabs data={data} isHOD={isHOD} activeId={viewTab} onChange={setViewTab} includeInactive />}

      <Card className="mb-4">
        <div className="text-xs font-semibold text-[#A79E8C] mb-2">POST AN OPPORTUNITY</div>
        {isHOD && hasDepts && (
          <div className="text-xs mb-2 px-2.5 py-1.5 rounded-lg w-fit" style={{ background: "#F6F0E4", color: "#6E6455" }}>
            For <b>{deptName(data, myDeptId)}</b> only
          </div>
        )}
        {isDirector && hasDepts && (
          <select value={postTo} onChange={(e) => setPostTo(e.target.value)} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm w-full mb-2">
            <option value="all">All Departments</option>
            {activeDepartments(data).map((dp) => <option key={dp.id} value={dp.id}>{dp.name} only</option>)}
          </select>
        )}
        <div className="grid sm:grid-cols-4 gap-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="sm:col-span-2 border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm" />
          <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
            <option>Data Discourse</option><option>NPTEL</option><option>Club</option><option>Other</option>
          </select>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm" />
        </div>
        <button onClick={add} className="mt-3 flex items-center gap-1 text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Post</button>
      </Card>
      <div className="space-y-2 mb-6">
        {visibleCatalog.map((c) => (
          <Card key={c.id} className="flex items-center justify-between !py-3">
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                {c.name}
                {hasDepts && (isDirector || isHOD) && (
                  <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: c.departmentId ? "#F6F0E4" : "#EAEEF0", color: c.departmentId ? "#6E6455" : "#2C4A63" }}>
                    {c.departmentId ? deptName(data, c.departmentId) : "All Depts"}
                  </span>
                )}
              </div>
              <div className="text-xs text-[#A79E8C]">{c.provider}{c.date && ` · ${fmt(c.date)}`}</div>
            </div>
            {canManageCatalog(c) && <button onClick={() => remove(c.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={15} /></button>}
          </Card>
        ))}
        {visibleCatalog.length === 0 && <div className="text-sm text-[#A79E8C]">Nothing posted yet.</div>}
      </div>

      <div className="text-xs font-semibold text-[#A79E8C] mb-2 uppercase tracking-wide">Student Enrollments — manage modules</div>
      <p className="text-xs text-[#6E6455] mb-3">Students enroll themselves, but only you can add or remove the module breakdown each one tracks progress against.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {visibleEnrollments.map((e) => (
          <Card key={e.id}>
            <div className="flex items-center justify-between mb-1">
              <Badge color={C.purple}>{e.provider}</Badge>
              {e.ownerKey && <span className="text-xs" style={{ color: "#A79E8C" }}>{data.profiles[e.ownerKey]?.name || "Student"}</span>}
            </div>
            <div className="font-h font-semibold text-[15px] my-1.5">{e.name}</div>
            <div className="space-y-1.5 mb-2">
              {e.units.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm group">
                  <span className={u.done ? "line-through text-[#B7AC95]" : ""}>{u.name}</span>
                  <button onClick={() => removeModule(e.id, u.id)} className="opacity-0 group-hover:opacity-100 text-[#D9D0BC] hover:text-[#A6423A]"><X size={13} /></button>
                </div>
              ))}
              {e.units.length === 0 && <div className="text-xs text-[#A79E8C]">No modules yet.</div>}
            </div>
            <div className="flex gap-2">
              <input value={newModule[e.id] || ""} onChange={(ev) => setNewModule((s) => ({ ...s, [e.id]: ev.target.value }))} placeholder="Add module…" className="flex-1 border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-xs" />
              <button onClick={() => addModule(e.id)} className="text-xs px-2 py-1.5 rounded-lg text-white" style={{ background: C.purple }}><Plus size={13} /></button>
            </div>
          </Card>
        ))}
        {visibleEnrollments.length === 0 && <div className="text-sm text-[#A79E8C]">No students have enrolled in anything yet.</div>}
      </div>
    </div>
  );
}


export default AdminCoCurricularView;
export { AdminCoCurricularView };
