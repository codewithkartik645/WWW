import React, { useState, useMemo } from "react";
import {
  Trash2, FileText, RefreshCw,
} from "lucide-react";
import {
  C, isAdminKey, fmt,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, restoreFromTrash } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, useDeleteConfirm,
} from "../components/UI";

function TrashView({ data, setData }) {
  const isSuperAdmin = data.profiles[data.session]?.role === "admin"; // only the original admin can restore/purge deleted accounts & data
  const trash = data.trash || [];
  const [filter, setFilter] = useState("all");
  const [confirmDelete, deleteModal] = useDeleteConfirm();

  const types = useMemo(() => Array.from(new Set(trash.map((t) => t.type))), [trash]);
  const filtered = filter === "all" ? trash : trash.filter((t) => t.type === filter);

  if (!isSuperAdmin) {
    return (
      <Card>
        <div className="text-sm" style={{ color: "#A79E8C" }}>Only the original admin account can restore deleted items.</div>
      </Card>
    );
  }

  const restore = (id) => setData((d) => restoreFromTrash(d, id));
  const permanentlyDelete = (id, label) => {
    confirmDelete(`Permanently delete "${label}"? This cannot be undone`, () => {
      setData((d) => logActivity({ ...d, trash: d.trash.filter((t) => t.id !== id) }, `Permanently deleted: ${label}`));
    });
  };
  const emptyTrash = () => {
    confirmDelete(`Permanently delete all ${trash.length} item${trash.length === 1 ? "" : "s"} in Trash? This cannot be undone`, () => {
      setData((d) => logActivity({ ...d, trash: [] }, "Trash emptied"));
    });
  };

  return (
    <div className="space-y-4">
      {deleteModal}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: "#2B2620" }}>{trash.length} item{trash.length === 1 ? "" : "s"} in Trash</div>
          <p className="text-xs mt-0.5" style={{ color: "#A79E8C" }}>Anything deleted by you or a student — tasks, enrollments, timetable entries, accounts and more — lands here first so you can bring it back.</p>
        </div>
        {trash.length > 0 && <button onClick={emptyTrash} className="text-xs px-3 py-1.5 rounded-lg text-white flex-shrink-0" style={{ background: C.red }}>Empty Trash</button>}
      </Card>

      {trash.length > 0 && (
        <div className="flex gap-1 bg-white border border-[#E6DFD1] rounded-lg p-1 w-fit flex-wrap">
          <button onClick={() => setFilter("all")} className={`text-xs px-3 py-1.5 rounded-md ${filter === "all" ? "text-white" : "text-[#6E6455]"}`} style={filter === "all" ? { background: C.purple } : {}}>All</button>
          {types.map((t) => (
            <button key={t} onClick={() => setFilter(t)} className={`text-xs px-3 py-1.5 rounded-md ${filter === t ? "text-white" : "text-[#6E6455]"}`} style={filter === t ? { background: C.purple } : {}}>{TRASH_TYPE_META[t]?.label || t}</button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((entry) => {
          const meta = TRASH_TYPE_META[entry.type] || { label: entry.type, icon: FileText };
          const Icon = meta.icon;
          const deletedByName = entry.deletedBy ? (data.profiles[entry.deletedBy]?.name || (isAdminKey(entry.deletedBy, data.profiles) ? "Admin" : "Student")) : "—";
          return (
            <Card key={entry.id} className="flex items-center justify-between gap-3 !py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Icon size={15} /></div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "#2B2620" }}>{entry.label}</div>
                  <div className="text-xs" style={{ color: "#A79E8C" }}>{meta.label} · Deleted by {deletedByName} · {fmt(entry.deletedAt)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => restore(entry.id)} className="text-xs px-3 py-1.5 rounded-lg text-white flex items-center gap-1" style={{ background: C.green }}><RefreshCw size={12} /> Restore</button>
                <button onClick={() => permanentlyDelete(entry.id, entry.label)} className="text-[#D9D0BC] hover:text-[#A6423A]" title="Permanently delete"><Trash2 size={15} /></button>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card><p className="text-sm text-center py-6" style={{ color: "#A79E8C" }}>{trash.length === 0 ? "Trash is empty." : "Nothing matches this filter."}</p></Card>}
      </div>
    </div>
  );
}

/** "Head office" view for admin: one page that rolls up the raw activity feed
 *  (every action by every user) alongside a workload snapshot for every
 *  student and co-admin, so admin doesn't have to open each account to see
 *  what's going on across the whole tracker. */

export default TrashView;
export { TrashView };
