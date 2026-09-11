import React, { useState } from "react";
import {
  UserCheck, Building2, Percent, Search,
} from "lucide-react";
import {
  C, isAdminKey, deptName, fmtFull, activeDepartments,
} from "../theme";
import { logActivity } from "../utils/activity";
import {
  Card, DepartmentScopeTabs,
} from "../components/UI";

const STATUS = {
  present: { label: "Present", color: C.green, bg: "#EEF2E7" },
  absent: { label: "Absent", color: C.red, bg: "#F1E1DC" },
  leave: { label: "Leave", color: C.amber, bg: "#F5E9CC" },
};

const todayStr = () => new Date().toISOString().slice(0, 10);
// Deterministic id so re-marking the same student on the same date overwrites the existing
// record (matches the id-keyed upsert every other table in this app already relies on) instead
// of quietly piling up duplicate rows for the same day.
const attendanceId = (studentKey, date) => `att_${studentKey}_${date}`;

// A student's overall attendance percentage from every record marked for them so far.
function pctFor(records) {
  if (records.length === 0) return null;
  const present = records.filter((a) => a.status === "present").length;
  return Math.round((present / records.length) * 100);
}

function AttendanceView({ data, setData }) {
  const myProfile = data.profiles[data.session];
  const isDirector = myProfile?.role === "admin";
  const isAdmin = isAdminKey(data.session, data.profiles);
  const isHOD = isAdmin && !isDirector;
  const myDeptId = isHOD ? (myProfile?.departmentId || data.departments[0]?.id) : null;
  const hasDepts = data.departments.length > 1;

  // Director must pick ONE specific department to mark/view — there's no meaningful "mark
  // attendance for all departments at once" the way "All Departments" works as a read-only
  // filter elsewhere in the app (Calendar, Announcements, ...).
  const firstActiveDept = activeDepartments(data)[0]?.id || data.departments[0]?.id || "";
  const [deptTab, setDeptTab] = useState(isHOD ? myDeptId : firstActiveDept);
  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState("");

  // Computed unconditionally (even on the branch that doesn't use it) so hook order never
  // depends on the isAdmin/student split below.
  const myRecords = [...data.attendance]
    .filter((a) => a.studentId === data.session)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const myPct = pctFor(myRecords);

  /* ------------------------------ Student: own attendance ------------------------------ */
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}>
              <Percent size={22} />
            </div>
            <div>
              <div className="font-h text-2xl font-semibold">{myPct === null ? "—" : `${myPct}%`}</div>
              <div className="text-xs" style={{ color: "#A79E8C" }}>
                Overall attendance{myRecords.length ? ` · ${myRecords.filter((a) => a.status === "present").length}/${myRecords.length} days present` : " · no records yet"}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Attendance History</div>
          <div className="space-y-1.5 max-h-[440px] overflow-y-auto">
            {myRecords.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-[#F1EADD] pb-1.5">
                <span>{fmtFull(a.date)}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: STATUS[a.status]?.bg, color: STATUS[a.status]?.color }}>
                  {STATUS[a.status]?.label || a.status}
                </span>
              </div>
            ))}
            {myRecords.length === 0 && <div className="text-sm text-[#A79E8C]">No attendance recorded yet — your department's admin marks this after each class.</div>}
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------ Admin / HOD: mark attendance ------------------------------ */
  const effectiveDeptId = isHOD ? myDeptId : deptTab;

  const rosterKeys = Object.keys(data.profiles).filter((k) => {
    if (isAdminKey(k, data.profiles)) return false;
    const dept = data.profiles[k]?.departmentId || data.departments[0]?.id;
    if (dept !== effectiveDeptId) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const name = (data.profiles[k]?.name || "").toLowerCase();
      const email = (data.profiles[k]?.email || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const recordFor = (studentKey) => data.attendance.find((a) => a.id === attendanceId(studentKey, date));

  const mark = (studentKey, status) => {
    const id = attendanceId(studentKey, date);
    const record = { id, studentId: studentKey, departmentId: effectiveDeptId, date, status, markedBy: data.session, markedAt: new Date().toISOString() };
    setData((d) => {
      const exists = d.attendance.some((a) => a.id === id);
      const attendance = exists ? d.attendance.map((a) => a.id === id ? record : a) : [...d.attendance, record];
      return logActivity({ ...d, attendance }, `Attendance marked ${STATUS[status].label.toLowerCase()}: ${d.profiles[studentKey]?.name || "student"} (${date})`);
    });
  };

  const todaysRecords = rosterKeys.map((k) => recordFor(k)).filter(Boolean);
  const presentToday = todaysRecords.filter((a) => a.status === "present").length;

  return (
    <div className="space-y-4">
      {isHOD && hasDepts && (
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white border border-[#E6DFD1] w-fit flex items-center gap-1.5" style={{ color: "#2B2620" }}>
          <Building2 size={13} /> <b>{deptName(data, myDeptId)}</b> <span style={{ color: "#A79E8C" }}>— you only mark and see attendance for your own department</span>
        </div>
      )}
      {isDirector && hasDepts && <DepartmentScopeTabs data={data} isHOD={false} activeId={deptTab} onChange={setDeptTab} includeAll={false} includeInactive />}

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCheck size={16} style={{ color: C.purple }} />
          <span className="text-sm font-semibold">{deptName(data, effectiveDeptId)} · Mark Attendance</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm" />
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="#A79E8C" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student" className="border border-[#E6DFD1] rounded-lg pl-7 pr-2 py-1.5 text-xs w-36" />
          </div>
          <span className="text-xs whitespace-nowrap" style={{ color: "#A79E8C" }}>{todaysRecords.length}/{rosterKeys.length} marked · {presentToday} present</span>
        </div>
      </Card>

      <Card>
        <div className="space-y-2">
          {rosterKeys.map((key) => {
            const profile = data.profiles[key] || {};
            const rec = recordFor(key);
            const overallPct = pctFor(data.attendance.filter((a) => a.studentId === key));
            const isInactive = profile.active === false;
            return (
              <div key={key} className="flex items-center justify-between gap-3 flex-wrap border-b border-[#F1EADD] pb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" style={{ background: isInactive ? "#A79E8C" : "#4F7A5B" }}>
                    {(profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm truncate flex items-center gap-1.5">
                      {profile.name || "Student"}
                      {isInactive && <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#F1E1DC", color: "#A6423A" }}>Deactivated</span>}
                    </div>
                    {overallPct !== null && <div className="text-[11px]" style={{ color: "#A79E8C" }}>{overallPct}% overall</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {Object.entries(STATUS).map(([statusKey, s]) => (
                    <button
                      key={statusKey}
                      onClick={() => mark(key, statusKey)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
                      style={rec?.status === statusKey ? { background: s.color, color: "#fff", borderColor: s.color } : { background: "#fff", color: s.color, borderColor: `${s.color}55` }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {rosterKeys.length === 0 && <div className="text-sm text-[#A79E8C]">No students in this department yet.</div>}
        </div>
      </Card>
    </div>
  );
}

export default AttendanceView;
export { AttendanceView };
