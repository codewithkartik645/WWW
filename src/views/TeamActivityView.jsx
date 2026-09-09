import React, { useState, useMemo } from "react";
import {
  Users2,
  Shield, Search, GraduationCap, Eye, Activity,
} from "lucide-react";
import {
  C, isAdminKey, deptName,
} from "../theme";
import {
  } from "../data/seedData";
import {
  } from "../utils/files";
import {
  Card, Badge,
} from "../components/UI";

function TeamActivityView({ data, setData, onViewStudent, goTo }) {
  const isSuperAdmin = data.profiles[data.session]?.role === "admin"; // only the original admin account manages co-admins
  const isHOD = !isSuperAdmin;
  const myDeptId = isHOD ? (data.profiles[data.session]?.departmentId || data.departments[0]?.id) : null;
  const studentDeptId = (key) => data.profiles[key]?.departmentId || data.departments[0]?.id;

  // An HOD only ever sees their own department's students here — never another department's workload.
  const studentKeys = useMemo(() => Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles) && (!isHOD || studentDeptId(k) === myDeptId)), [data.profiles, isHOD, myDeptId]);
  const coAdminKeys = useMemo(() => Object.keys(data.profiles).filter((k) => isAdminKey(k, data.profiles) && data.profiles[k]?.role !== "admin"), [data.profiles]);

  const roleFor = (key) => (data.profiles[key]?.role === "admin" ? "Admin" : isAdminKey(key, data.profiles) ? "Co-admin" : "Student");
  const roleColor = { Admin: C.dark, "Co-admin": C.purple, Student: C.green };
  const nameFor = (key) => data.profiles[key]?.name || (data.profiles[key]?.role === "admin" ? "Admin" : roleFor(key));

  const [roleFilter, setRoleFilter] = useState("all"); // all | Admin | Co-admin | Student
  const [userFilter, setUserFilter] = useState("all"); // "all" or a specific key
  const [search, setSearch] = useState("");

  const filteredLog = useMemo(() => {
    return (data.activityLog || []).filter((a) => {
      // An HOD only ever sees actions by themselves or by their own department's students —
      // never another department's students, another co-admin, or the Director's own actions,
      // since those could easily reference another department's private data in plain text.
      if (isHOD && a.by !== data.session && !(!isAdminKey(a.by, data.profiles) && studentDeptId(a.by) === myDeptId)) return false;
      if (roleFilter !== "all" && roleFor(a.by) !== roleFilter) return false;
      if (userFilter !== "all" && a.by !== userFilter) return false;
      if (search.trim() && !a.text.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [data.activityLog, data.profiles, isHOD, myDeptId, roleFilter, userFilter, search]);

  const summaryFor = (key) => {
    const enrollCount = data.enrollments.filter((e) => e.ownerKey === key).length;
    const myTasks = data.tasks.filter((t) => t.ownerKey === key);
    const taskDone = myTasks.filter((t) => t.status === "done").length;
    const studyMinutes = data.studyLogs.filter((l) => l.ownerKey === key).reduce((s, l) => s + l.minutes, 0);
    const selfBlocks = data.plannerBlocks.filter((b) => b.kind === "self" && b.ownerKey === key).length;
    return { enrollCount, taskDone, taskTotal: myTasks.length, studyHours: +(studyMinutes / 60).toFixed(1), selfBlocks };
  };

  const activityCountFor = (key) => (data.activityLog || []).filter((a) => a.by === key).length;
  const lastActiveFor = (key) => (data.activityLog || []).find((a) => a.by === key);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#2B2620" }}><Activity size={13} /> ACTIVITY LOG ({filteredLog.length}/{(data.activityLog || []).length})</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#A79E8C" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity" className="border border-[#E6DFD1] rounded-lg pl-7 pr-2 py-1.5 text-xs w-40" />
            </div>
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setUserFilter("all"); }} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-xs">
              <option value="all">All roles</option>
              <option value="Admin">Admin</option>
              <option value="Co-admin">Co-admins</option>
              <option value="Student">Students</option>
            </select>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-xs">
              <option value="all">Everyone</option>
              {Object.keys(data.profiles)
                .filter((k) => roleFilter === "all" || roleFor(k) === roleFilter)
                .filter((k) => !isHOD || k === data.session || (!isAdminKey(k, data.profiles) && studentDeptId(k) === myDeptId))
                .map((k) => <option key={k} value={k}>{nameFor(k)}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs mb-3" style={{ color: "#A79E8C" }}>{isHOD ? `Actions by you and your department's students, most recent first.` : "Every action taken across the tracker, most recent first — admin, co-admins and students."}</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLog.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 text-xs border-b border-[#F4EEE1] pb-2 last:border-0">
              <div className="min-w-0">
                <div style={{ color: "#2B2620" }}>{a.text}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge color={roleColor[roleFor(a.by)] || "#A79E8C"}>{nameFor(a.by)}</Badge>
                </div>
              </div>
              <span className="flex-shrink-0" style={{ color: "#A79E8C" }}>{new Date(a.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
          {filteredLog.length === 0 && <div className="text-sm" style={{ color: "#A79E8C" }}>No activity matches this filter.</div>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#2B2620" }}><GraduationCap size={13} /> STUDENT WORKLOAD ({studentKeys.length}){isHOD && <span className="font-normal normal-case" style={{ color: "#A79E8C" }}> · {deptName(data, myDeptId)}</span>}</div>
          {goTo && <button onClick={() => goTo("students")} className="text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Users2 size={12} /> Manage Students</button>}
        </div>
        <p className="text-xs mb-4" style={{ color: "#A79E8C" }}>Every student's work in one place — tasks, self-study and enrollments — without opening each account.</p>
        <div className="space-y-2">
          {studentKeys.map((key) => {
            const profile = data.profiles[key] || { name: "Student", photo: null };
            const s = summaryFor(key);
            return (
              <div key={key} className="border border-[#E6DFD1] rounded-lg p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden" style={{ background: "#4F7A5B" }}>
                    {profile.photo ? <img src={profile.photo} alt="" className="w-full h-full object-cover" /> : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 text-sm font-medium truncate" style={{ color: "#2B2620" }}>{profile.name || "Student"}</div>
                  <button onClick={() => onViewStudent && onViewStudent(key)} className="text-xs font-medium flex items-center gap-1 flex-shrink-0" style={{ color: C.purple }}><Eye size={12} /> View full activity</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: C.purpleSoft, color: C.purple }}>{s.enrollCount} enrollment{s.enrollCount === 1 ? "" : "s"}</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#EEF2E7", color: C.green }}>{s.taskDone}/{s.taskTotal} tasks done</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#F5E9CC", color: "#9C6B24" }}>{s.studyHours}h studied</span>
                  <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "#EAEEF0", color: "#2C4A63" }}>{s.selfBlocks} planner block{s.selfBlocks === 1 ? "" : "s"}</span>
                </div>
              </div>
            );
          })}
          {studentKeys.length === 0 && <div className="text-sm" style={{ color: "#A79E8C" }}>No student accounts yet.</div>}
        </div>
      </Card>

      {isSuperAdmin && (
        <Card>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#2B2620" }}><Shield size={13} /> CO-ADMIN ACTIVITY ({coAdminKeys.length})</div>
            {goTo && <button onClick={() => goTo("coadmins")} className="text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Shield size={12} /> Manage Co-Admins</button>}
          </div>
          <p className="text-xs mb-4" style={{ color: "#A79E8C" }}>How active each co-admin has been — open Co-Admins to see their full action-by-action log or remove access.</p>
          <div className="space-y-2">
            {coAdminKeys.map((key) => {
              const profile = data.profiles[key] || { name: "Co-admin", photo: null };
              const count = activityCountFor(key);
              const last = lastActiveFor(key);
              return (
                <div key={key} className="border border-[#E6DFD1] rounded-lg p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden" style={{ background: C.purple }}>
                    {profile.photo ? <img src={profile.photo} alt="" className="w-full h-full object-cover" /> : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "#2B2620" }}>{profile.name || "Co-admin"}</div>
                    <div className="text-xs" style={{ color: "#A79E8C" }}>{last ? `Last active ${new Date(last.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "No activity yet"}</div>
                  </div>
                  <Badge color={C.purple}>{count} action{count === 1 ? "" : "s"}</Badge>
                </div>
              );
            })}
            {coAdminKeys.length === 0 && <div className="text-sm" style={{ color: "#A79E8C" }}>No co-admins yet.</div>}
          </div>
        </Card>
      )}
    </div>
  );
}


export default TeamActivityView;
export { TeamActivityView };
