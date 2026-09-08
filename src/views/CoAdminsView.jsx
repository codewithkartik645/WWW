import React, { useState, useMemo } from "react";
import {
  Plus, Trash2,
  Shield, ClipboardList,
  Building2,
} from "lucide-react";
import {
  C, uid, isAdminKey, DEFAULT_DEPT_ID, deptName,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, useDeleteConfirm,
} from "../components/UI";
import { updateProfile } from "../lib/profileAdmin";

function CoAdminsView({ data, setData, goTo, refreshProfiles }) {
  const isSuperAdmin = data.profiles[data.session]?.role === "admin"; // only the original admin account manages co-admins
  const coAdminKeys = useMemo(() => Object.keys(data.profiles).filter((k) => isAdminKey(k, data.profiles) && data.profiles[k]?.role !== "admin"), [data.profiles]);
  // Everyone signed up who ISN'T already an admin/coadmin — candidates to promote.
  const studentKeys = useMemo(() => Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles)), [data.profiles]);
  const [expandedActivity, setExpandedActivity] = useState(null); // co-admin key whose activity is expanded
  const activityFor = (key) => (data.activityLog || []).filter((a) => a.by === key).slice(0, 20);
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const [promoteKey, setPromoteKey] = useState("");
  const [promoteDept, setPromoteDept] = useState(data.departments[0]?.id || DEFAULT_DEPT_ID);
  const [promoteError, setPromoteError] = useState("");
  const [actionError, setActionError] = useState("");

  // Departments: the director creates/renames these; each co-admin (HOD) is tagged to exactly one.
  const [newDeptName, setNewDeptName] = useState("");
  const [deptError, setDeptError] = useState("");
  const addDepartment = () => {
    setDeptError("");
    const name = newDeptName.trim();
    if (!name) return;
    if (data.departments.some((dp) => dp.name.toLowerCase() === name.toLowerCase())) { setDeptError("A department with that name already exists."); return; }
    const dept = { id: `dept_${uid()}`, name };
    setData((d) => logActivity({ ...d, departments: [...d.departments, dept] }, `Department added: ${name}`));
    setNewDeptName("");
  };
  const renameDepartment = (id, name) => setData((d) => ({ ...d, departments: d.departments.map((dp) => dp.id === id ? { ...dp, name } : dp) }));
  const removeDepartment = (id) => {
    const dept = data.departments.find((dp) => dp.id === id);
    const inUse = data.courses.some((c) => (c.departmentId || data.departments[0]?.id) === id)
      || Object.keys(data.profiles).some((k) => data.profiles[k]?.departmentId === id);
    if (inUse) { setDeptError(`"${dept?.name}" still has subjects, students or an HOD assigned — reassign them first.`); return; }
    if (data.departments.length <= 1) { setDeptError("At least one department must remain."); return; }
    setDeptError("");
    confirmDelete(`Department "${dept?.name}"`, () => {
      setData((d) => logActivity({ ...d, departments: d.departments.filter((dp) => dp.id !== id) }, `Department removed: ${dept?.name}`));
    });
  };
  const setCoAdminDept = (key, departmentId) => {
    setActionError("");
    updateProfile(key, { departmentId }).then(({ error }) => {
      if (error) { setActionError(`Couldn't reassign department: ${error.message}`); return; }
      setData((d) => logActivity(d, `${d.profiles[key]?.name || "Co-admin"} reassigned to ${deptName(d, departmentId)}`));
      refreshProfiles?.();
    });
  };

  const promoteToCoAdmin = () => {
    setPromoteError("");
    if (!promoteKey) { setPromoteError("Pick a signed-up user to promote."); return; }
    if (!promoteDept) { setPromoteError("Pick a department for this HOD."); return; }
    updateProfile(promoteKey, { role: "coadmin", departmentId: promoteDept }).then(({ error }) => {
      if (error) { setPromoteError(error.message); return; }
      setData((d) => logActivity(d, `${d.profiles[promoteKey]?.name || "A user"} promoted to Co-admin (HOD) — ${deptName(d, promoteDept)}`));
      setPromoteKey("");
      refreshProfiles?.();
    });
  };
  const removeCoAdmin = (key) => {
    confirmDelete(`Admin access for "${data.profiles[key]?.name || "this co-admin"}"`, () => {
      setActionError("");
      updateProfile(key, { role: "student" }).then(({ error }) => {
        if (error) { setActionError(`Couldn't remove admin access: ${error.message}`); return; }
        setData((d) => logActivity(d, `Co-admin access removed: ${d.profiles[key]?.name || key} (now a student)`));
        refreshProfiles?.();
      });
    });
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <div className="text-sm" style={{ color: "#A79E8C" }}>Only the original admin account can manage co-admins.</div>
      </Card>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      {deleteModal}
      {actionError && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "#F1E1DC", color: "#A6423A" }}>{actionError}</div>
      )}

      <Card style={{ borderLeft: "3px solid #2C4A63" }}>
        <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#2B2620" }}><Building2 size={13} /> DEPARTMENTS ({data.departments.length})</div>
        <p className="text-xs mb-3" style={{ color: "#A79E8C" }}>Each HOD below is tagged to one department. Subjects and students are tagged too, so an HOD only manages their own — everything else stays view-only for them.</p>
        <div className="space-y-2 mb-3">
          {data.departments.map((dp) => {
            const hod = coAdminKeys.find((k) => data.profiles[k]?.departmentId === dp.id);
            const courseCount = data.courses.filter((c) => (c.departmentId || data.departments[0]?.id) === dp.id).length;
            const studentCount = Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles) && data.profiles[k]?.departmentId === dp.id).length;
            return (
              <div key={dp.id} className="flex items-center gap-2 flex-wrap border border-[#E6DFD1] rounded-lg px-3 py-2">
                <input value={dp.name} onChange={(e) => renameDepartment(dp.id, e.target.value)} className="flex-1 min-w-[120px] text-sm bg-transparent" style={{ color: "#2B2620" }} />
                <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#F6F0E4", color: "#6E6455" }}>{courseCount} subj · {studentCount} stu</span>
                <span className="text-[10px] flex-shrink-0" style={{ color: "#A79E8C" }}>{hod ? `HOD: ${data.profiles[hod]?.name}` : "No HOD yet"}</span>
                <button onClick={() => removeDepartment(dp.id)} className="text-[#D9D0BC] hover:text-[#A6423A] flex-shrink-0" title="Remove department"><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
        {deptError && <div className="text-xs mb-2" style={{ color: "#A6423A" }}>{deptError}</div>}
        <div className="flex gap-2">
          <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="e.g. Electronics & Communication" className="flex-1 border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm" />
          <button onClick={addDepartment} className="text-xs px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 flex-shrink-0" style={{ background: "#2C4A63" }}><Plus size={13} /> Add dept</button>
        </div>
      </Card>

      <Card style={{ borderLeft: "3px solid #7A2E3A" }}>
        <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#2B2620" }}><Shield size={13} /> CO-ADMINS / HODs ({coAdminKeys.length})</div>
        <p className="text-xs mb-4" style={{ color: "#A79E8C" }}>Give department heads admin access scoped to their own department. As the Super Admin, you can see what each HOD has done and can reassign their department anytime.</p>

        <div className="space-y-3 mb-4">
          {coAdminKeys.map((key) => {
            const profile = data.profiles[key] || { name: "Co-admin", photo: null };
            const isOpen = expandedActivity === key;
            const acts = activityFor(key);
            return (
              <div key={key} className="border border-[#E6DFD1] rounded-lg p-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden" style={{ background: C.purple }}>
                    {profile.photo ? <img src={profile.photo} alt="" className="w-full h-full object-cover" /> : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "#2B2620" }}>{profile.name || "Co-admin"}</div>
                    <div className="text-xs truncate" style={{ color: "#A79E8C" }}>{profile.email}</div>
                  </div>
                  <button onClick={() => setExpandedActivity(isOpen ? null : key)} className="text-xs font-medium flex items-center gap-1 flex-shrink-0" style={{ color: C.purple }}>
                    <ClipboardList size={12} /> {isOpen ? "Hide activity" : `Activity (${acts.length})`}
                  </button>
                  <button onClick={() => removeCoAdmin(key)} className="text-[#D9D0BC] hover:text-[#A6423A] flex-shrink-0" title="Remove admin access (demotes to student)"><Trash2 size={14} /></button>
                </div>
                <div className="mb-1">
                  <div className="text-[11px] font-medium mb-1" style={{ color: "#6E6455" }}>Department (HOD of)</div>
                  <select value={profile.departmentId || data.departments[0]?.id || ""} onChange={(e) => setCoAdminDept(key, e.target.value)} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm w-full">
                    {data.departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                  </select>
                </div>
                {isOpen && (
                  <div className="mt-3 max-h-48 overflow-y-auto border border-[#F1EADD] rounded-lg p-2 space-y-1.5 bg-[#FBF8F2]">
                    {acts.map((a) => (
                      <div key={a.id} className="text-xs flex items-start justify-between gap-2">
                        <span style={{ color: "#2B2620" }}>{a.text}</span>
                        <span className="flex-shrink-0" style={{ color: "#A79E8C" }}>{new Date(a.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))}
                    {acts.length === 0 && <div className="text-xs" style={{ color: "#A79E8C" }}>No recorded activity yet.</div>}
                  </div>
                )}
              </div>
            );
          })}
          {coAdminKeys.length === 0 && <div className="text-sm text-[#A79E8C]">No co-admins yet — you're the only admin.</div>}
        </div>

        <div className="border-t border-[#F4EEE1] pt-4">
          <div className="text-xs font-medium mb-2" style={{ color: "#6E6455" }}>Promote a signed-up user to co-admin (HOD)</div>
          <p className="text-xs mb-2" style={{ color: "#A79E8C" }}>They need to have already signed up in the app — accounts aren't created from here anymore.</p>
          <select value={promoteKey} onChange={(e) => setPromoteKey(e.target.value)} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm w-full mb-2">
            <option value="">Choose a signed-up user…</option>
            {studentKeys.map((k) => <option key={k} value={k}>{data.profiles[k]?.name || "Unnamed"} ({data.profiles[k]?.email})</option>)}
          </select>
          <select value={promoteDept} onChange={(e) => setPromoteDept(e.target.value)} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm w-full mb-2">
            {data.departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
          </select>
          {promoteError && <div className="text-xs mb-2" style={{ color: "#A6423A" }}>{promoteError}</div>}
          <button onClick={promoteToCoAdmin} className="text-xs px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5" style={{ background: C.green }}><Plus size={13} /> Promote to co-admin</button>
        </div>
      </Card>
    </div>
  );
}


export default CoAdminsView;
export { CoAdminsView };
