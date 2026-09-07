import React, { useState } from "react";
import {
  Plus, Trash2,
} from "lucide-react";
import {
  C, uid, fmt,
} from "../theme";
import {
  } from "../data/seedData";
import { moveToTrash } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, Badge, useDeleteConfirm,
} from "../components/UI";

function StudentCoCurricularView({ data, setData }) {
  const [custom, setCustom] = useState({ name: "", provider: "Other" });
  // Only this student's own enrollments — enrollments used to be global and visible to every student.
  const myEnrollments = data.enrollments.filter((e) => !e.ownerKey || e.ownerKey === data.session);

  const enroll = (catalogItem) => {
    if (myEnrollments.some((e) => e.catalogId === catalogItem?.id || (custom.name && e.name === custom.name))) return;
    const item = catalogItem
      ? { id: uid(), catalogId: catalogItem.id, name: catalogItem.name, provider: catalogItem.provider, units: [], ownerKey: data.session }
      : { id: uid(), name: custom.name, provider: custom.provider, units: [], ownerKey: data.session };
    if (!item.name.trim()) return;
    setData((d) => ({ ...d, enrollments: [...d.enrollments, item] }));
    setCustom({ name: "", provider: "Other" });
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const unenroll = (id) => {
    const item = data.enrollments.find((e) => e.id === id);
    confirmDelete(`Your enrollment in "${item?.name || "this"}"`, () => {
      setData((d) => moveToTrash({ ...d, enrollments: d.enrollments.filter((e) => e.id !== id) }, "enrollment", item, `Enrollment: ${item?.name || "enrollment"}`));
    });
  };
  // Modules (the unit-wise breakdown of an enrollment) are added/removed by admin only — students just track their own progress against them.
  const toggleModule = (enrollId, unitId) => setData((d) => ({ ...d, enrollments: d.enrollments.map((e) => e.id !== enrollId ? e : { ...e, units: e.units.map((u) => u.id === unitId ? { ...u, done: !u.done } : u) }) }));

  return (
    <div>
      {deleteModal}
      <p className="text-sm text-[#6E6455] -mt-4 mb-6">Enroll in posted opportunities or add your own. Your admin adds the module breakdown; you track your progress against it.</p>

      {data.coCurricularCatalog.length > 0 && (
        <Card className="mb-4">
          <div className="font-h font-semibold mb-3">Available to join</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {data.coCurricularCatalog.map((c) => {
              const enrolled = myEnrollments.some((e) => e.catalogId === c.id);
              return (
                <div key={c.id} className="flex items-center justify-between border border-[#E6DFD1] rounded-lg px-3 py-2">
                  <div><div className="text-sm font-medium">{c.name}</div><div className="text-xs text-[#A79E8C]">{c.provider}{c.date && ` · ${fmt(c.date)}`}</div></div>
                  <button disabled={enrolled} onClick={() => enroll(c)} className="text-xs px-2 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: C.purple }}>{enrolled ? "Enrolled" : "Enroll"}</button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="font-h font-semibold mb-2">Add your own</div>
        <div className="flex gap-2">
          <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. Coursera — Data Structures" className="flex-1 border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm" />
          <select value={custom.provider} onChange={(e) => setCustom({ ...custom, provider: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
            <option>Data Discourse</option><option>NPTEL</option><option>Club</option><option>Other</option>
          </select>
          <button onClick={() => enroll(null)} className="flex items-center gap-1 text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}><Plus size={14} /></button>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {myEnrollments.map((e) => {
          const done = e.units.filter((u) => u.done).length;
          const pct = e.units.length ? Math.round((done / e.units.length) * 100) : 0;
          return (
            <Card key={e.id}>
              <div className="flex items-center justify-between mb-1">
                <Badge color={C.purple}>{e.provider}</Badge>
                <button onClick={() => unenroll(e.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={14} /></button>
              </div>
              <div className="font-h font-semibold text-[15px] my-1.5">{e.name}</div>
              <div className="h-1.5 bg-[#E6DFD1] rounded mb-3"><div className="h-1.5 rounded" style={{ width: `${pct}%`, background: C.purple }} /></div>
              <div className="text-[11px] font-semibold text-[#A79E8C] mb-1.5">MODULES</div>
              <div className="space-y-1.5">
                {e.units.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={u.done} onChange={() => toggleModule(e.id, u.id)} style={{ accentColor: C.purple }} />
                    <span className={`flex-1 ${u.done ? "line-through text-[#B7AC95]" : ""}`}>{u.name}</span>
                  </label>
                ))}
                {e.units.length === 0 && <div className="text-xs text-[#A79E8C]">Your admin hasn't added modules for this yet.</div>}
              </div>
            </Card>
          );
        })}
        {myEnrollments.length === 0 && <div className="text-sm text-[#A79E8C]">You haven't enrolled in anything yet.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Announcements (admin write / everyone read) ------------------------------ */


export default StudentCoCurricularView;
export { StudentCoCurricularView };
