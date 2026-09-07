import React, { useState, useMemo } from "react";
import {
  Users2, Trash2, Search, GraduationCap, Eye,
} from "lucide-react";
import {
  C, isAdminKey, DEFAULT_DEPT_ID, deptName,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, ConfirmModal,
} from "../components/UI";
import { updateProfile } from "../lib/profileAdmin";

function AdminStudentsView({ data, setData, onViewStudent }) {
  const isDirector = data.profiles[data.session]?.role === "admin";
  const isHOD = isAdminKey(data.session, data.profiles) && !isDirector;
  const myDeptId = isHOD ? (data.profiles[data.session]?.departmentId || data.departments[0]?.id) : null;
  const canManageStudent = (key) => isDirector || (isHOD && (data.profiles[key]?.departmentId || data.departments[0]?.id) === myDeptId);
  const studentKeys = useMemo(() => Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles)), [data.profiles]);

  const [deptTab, setDeptTab] = useState(isHOD ? myDeptId : "all");
  const [newStudent, setNewStudent] = useState({ name: "", id: "", password: "", departmentId: isHOD ? myDeptId : (data.departments[0]?.id || DEFAULT_DEPT_ID) });
  const [newStudentError, setNewStudentError] = useState("");

  const [search, setSearch] = useState("");

  const [removeTarget, setRemoveTarget] = useState(null); // student key pending confirmation

  // Quick activity summary per student — enrollments, tasks, logged study time, self-study blocks — for the roster row.
  const summaryFor = (key) => {
    const enrollCount = data.enrollments.filter((e) => e.ownerKey === key).length;
    const myTasks = data.tasks.filter((t) => t.ownerKey === key);
    const taskDone = myTasks.filter((t) => t.status === "done").length;
    const studyMinutes = data.studyLogs.filter((l) => l.ownerKey === key).reduce((s, l) => s + l.minutes, 0);
    const selfBlocks = data.plannerBlocks.filter((b) => b.kind === "self" && b.ownerKey === key).length;
    return { enrollCount, taskDone, taskTotal: myTasks.length, studyHours: +(studyMinutes / 60).toFixed(1), selfBlocks };
  };

  const filteredKeys = studentKeys.filter((key) => {
    const profile = data.profiles[key] || {};
    const studentDept = profile.departmentId || data.departments[0]?.id;
    if (isHOD && studentDept !== myDeptId) return false; // HOD never sees another department's students, full stop
    if (isDirector && deptTab !== "all" && studentDept !== deptTab) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const idMatch = (data.profiles[key]?.email || "").toLowerCase().includes(q);
      const nameMatch = (profile.name || "").toLowerCase().includes(q);
      if (!idMatch && !nameMatch) return false;
    }
    return true;
  });

  const addStudent = () => {
    // Students now sign themselves up (real accounts) — admin can no longer mint a
    // login here. This button assigns/reassigns an ALREADY-signed-up user's department.
  };

  const performRemove = (key) => {
    if (studentKeys.length <= 1) { setNewStudentError("At least one student account must remain."); setRemoveTarget(null); return; }
    // Deleting a real auth account needs Supabase's admin API (service-role key), which
    // must never live in frontend code — so "remove" here means deactivate: the account
    // can no longer sign in, but nothing is destroyed. A super-admin can permanently
    // delete the underlying auth user later from Supabase Dashboard → Authentication.
    updateProfile(key, { active: false }).then(({ error }) => {
      if (!error) setData((d) => logActivity(d, `Student account deactivated: ${d.profiles[key]?.name || key}`));
    });
    setRemoveTarget(null);
  };

  const removeTargetProfile = removeTarget ? data.profiles[removeTarget] : null;

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={!!removeTarget}
        title="Deactivate this student account?"
        message={`${removeTargetProfile?.name || "This student"} won't be able to log in anymore. Their planner, tasks and progress data stay intact and can be restored by reactivating the account from Supabase later.`}
        confirmLabel="Deactivate account"
        onConfirm={() => performRemove(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
      />

      {isDirector && data.departments.length > 1 && (
        <div className="flex gap-1 bg-white border border-[#E6DFD1] rounded-lg p-1 w-fit flex-wrap">
          <button onClick={() => setDeptTab("all")} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === "all" ? "text-white" : "text-[#6E6455]"}`} style={deptTab === "all" ? { background: C.purple } : {}}>All Departments</button>
          {data.departments.map((dp) => (
            <button key={dp.id} onClick={() => setDeptTab(dp.id)} className={`text-xs px-3 py-1.5 rounded-md ${deptTab === dp.id ? "text-white" : "text-[#6E6455]"}`} style={deptTab === dp.id ? { background: C.purple } : {}}>
              {dp.name}
            </button>
          ))}
        </div>
      )}
      {isHOD && data.departments.length > 1 && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white border border-[#E6DFD1] w-fit" style={{ color: "#2B2620" }}>
          <b>{deptName(data, myDeptId)}</b> <span style={{ color: "#A79E8C" }}>— you only see students in your own department</span>
        </div>
      )}

      {(isDirector || deptTab === myDeptId) && (
        <Card>
          <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#2B2620" }}><GraduationCap size={13} /> STUDENTS SIGN UP THEMSELVES</div>
          <p className="text-xs" style={{ color: "#A79E8C" }}>Share the app link — new students create their own login. Once they've signed up, assign their department from the roster below (each row has a department picker).</p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#2B2620" }}><Users2 size={13} /> STUDENT ROSTER ({filteredKeys.length}/{studentKeys.length})</div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#A79E8C" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID" className="border border-[#E6DFD1] rounded-lg pl-7 pr-2 py-1.5 text-xs w-40" />
          </div>
        </div>

        <div className="space-y-3">
          {filteredKeys.map((key) => {
            const profile = data.profiles[key] || { name: "Student", photo: null };
            const s = summaryFor(key);
            const manageable = canManageStudent(key);
            return (
              <div key={key} className="border border-[#E6DFD1] rounded-lg p-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden" style={{ background: "#4F7A5B" }}>
                    {profile.photo
                      ? <img src={profile.photo} alt="" className="w-full h-full object-cover" />
                      : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "#2B2620" }}>{profile.name || "Student"}</div>
                    <div className="text-xs truncate" style={{ color: "#A79E8C" }}>{profile.email}</div>
                  </div>
                  {manageable && data.departments.length > 1 && (
                    <select
                      value={profile.departmentId || data.departments[0]?.id}
                      onChange={(e) => updateProfile(key, { departmentId: e.target.value })}
                      className="text-xs border border-[#E6DFD1] rounded-lg px-2 py-1 flex-shrink-0"
                    >
                      {data.departments.map((dp) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                    </select>
                  )}
                  {manageable ? (
                    <>
                      <button onClick={() => setRemoveTarget(key)} className="text-[#D9D0BC] hover:text-[#A6423A] flex-shrink-0" title="Deactivate this student account"><Trash2 size={15} /></button>
                    </>
                  ) : (
                    <span className="text-[10px] flex-shrink-0" style={{ color: "#A79E8C" }}>view only</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F4EEE1]">
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: C.purpleSoft, color: C.purple }}>{s.enrollCount} enrollment{s.enrollCount === 1 ? "" : "s"}</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#EEF2E7", color: C.green }}>{s.taskDone}/{s.taskTotal} tasks done</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#F5E9CC", color: "#9C6B24" }}>{s.studyHours}h studied</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#EAEEF0", color: "#2C4A63" }}>{s.selfBlocks} planner block{s.selfBlocks === 1 ? "" : "s"}</span>
                  <button onClick={() => onViewStudent && onViewStudent(key)} className="ml-auto text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Eye size={13} /> View full activity</button>
                </div>
              </div>
            );
          })}
          {filteredKeys.length === 0 && <div className="text-sm text-[#A79E8C]">No students match this filter.</div>}
        </div>
      </Card>
    </div>
  );
}

/** Full per-student record: enrollments, study progress, tasks and planner —
 *  opened by tapping "View full activity" on a student in AdminStudentsView.
 *  Admin can delete individual records here (deleting the account itself still
 *  requires the confirm modal over on the roster page). */

export default AdminStudentsView;
export { AdminStudentsView };
