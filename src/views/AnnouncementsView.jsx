import React, { useState, useRef, useMemo } from "react";
import {
  Trash2, ChevronLeft, Megaphone, Download, X, Paperclip,
} from "lucide-react";
import {
  C, uid, fmt, deptName, activeDepartments, visibleAnnouncementsFor,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash } from "../utils/activity";
import {
  fileKindIcon, openAttachment,
} from "../utils/files";
import {
  Card, useDeleteConfirm, DepartmentScopeTabs,
} from "../components/UI";
import { uploadAttachment } from "../lib/uploadAttachment";

function AnnouncementsView({ data, setData, isAdmin, goTo }) {
  const fileRef = useRef();
  const myProfile = data.profiles[data.session];
  const isDirector = isAdmin && myProfile?.role === "admin";
  const isHOD = isAdmin && myProfile?.role === "coadmin";
  const myDeptId = isHOD ? (myProfile?.departmentId || data.departments[0]?.id) : null;
  const hasDepts = data.departments.length > 1;

  // "all" = every department can see it (campus-wide notice). A specific id scopes it to
  // just that department. An HOD can only ever post to their own department.
  const [postTo, setPostTo] = useState(isHOD ? myDeptId : "all");
  const [viewTab, setViewTab] = useState(isHOD ? myDeptId : "all"); // which department's notices the Director is currently looking at

  const [form, setForm] = useState({ title: "", message: "" });
  const [pending, setPending] = useState(null); // { name, type, dataUrl }
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const onFile = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 25_000_000) { alert("That file is larger than 25MB — try a smaller PDF or image."); return; }
    setUploadError(""); setUploading(true);
    try {
      const { url: dataUrl } = await uploadAttachment(f); // "dataUrl" name kept for compatibility; it's a real Storage URL now
      setPending({ name: f.name, type: f.type, dataUrl });
    } catch (err) {
      setUploadError(err.message || "Couldn't upload that file — try again.");
    } finally {
      setUploading(false);
    }
  };
  const clearPending = () => { setPending(null); if (fileRef.current) fileRef.current.value = ""; };

  const add = () => {
    if (!form.title.trim()) return;
    const departmentId = isHOD ? myDeptId : (postTo === "all" ? null : postTo);
    setData((d) => logActivity({ ...d, announcements: [{ id: uid(), ...form, departmentId, fileName: pending?.name, fileType: pending?.type, dataUrl: pending?.dataUrl, date: new Date().toISOString().slice(0, 10) }, ...d.announcements] }, `Announcement published${departmentId ? ` (${deptName(d, departmentId)})` : " (all departments)"}: ${form.title}`));
    setForm({ title: "", message: "" });
    clearPending();
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  // An HOD may only remove their own department's notices — never a campus-wide one posted by the Director.
  const canManage = (a) => isDirector || (isHOD && a.departmentId === myDeptId);
  const remove = (id) => {
    const item = data.announcements.find((a) => a.id === id);
    confirmDelete(`Announcement "${item?.title || "announcement"}"`, () => {
      setData((d) => moveToTrash({ ...d, announcements: d.announcements.filter((a) => a.id !== id) }, "announcement", item, `Announcement: ${item?.title || "announcement"}`));
    });
  };

  // Student/HOD view: their own department's notices plus every campus-wide one.
  // The Director additionally gets a tab strip to narrow down to one department at a time.
  const visible = useMemo(() => {
    const base = visibleAnnouncementsFor(data, data.session);
    if (isDirector && viewTab !== "all") return base.filter((a) => a.departmentId === viewTab);
    return base;
  }, [data, isDirector, viewTab]);

  return (
    <div>
      {deleteModal}
      {goTo && (
        <button onClick={() => goTo("dashboard")} className="text-sm font-medium flex items-center gap-1 mb-3" style={{ color: C.purple }}>
          <ChevronLeft size={15} /> Back to Dashboard
        </button>
      )}
      {isAdmin ? (
        <Card className="mb-4">
          <div className="font-h font-semibold mb-2">New announcement</div>
          {isHOD && hasDepts && (
            <div className="text-xs mb-2 px-2.5 py-1.5 rounded-lg w-fit" style={{ background: "#F6F0E4", color: "#6E6455" }}>
              Posting to <b>{deptName(data, myDeptId)}</b> only — co-admins can't post campus-wide notices.
            </div>
          )}
          {isDirector && hasDepts && (
            <div className="mb-2">
              <div className="text-xs font-medium mb-1" style={{ color: "#6E6455" }}>Post to</div>
              <select value={postTo} onChange={(e) => setPostTo(e.target.value)} className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm w-full">
                <option value="all">All Departments (everyone sees this)</option>
                {activeDepartments(data).map((dp) => <option key={dp.id} value={dp.id}>{dp.name} only</option>)}
              </select>
            </div>
          )}
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm w-full mb-2" />
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" rows={2} className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm w-full mb-2" />
          {pending ? (
            <div className="flex items-center justify-between border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm mb-2">
              <span className="flex items-center gap-1.5 truncate" style={{ color: C.purple }}>{React.createElement(fileKindIcon(pending.type), { size: 14 })} {pending.name}</span>
              <button onClick={clearPending} className="text-[#D9D0BC] hover:text-[#A6423A] flex-shrink-0"><X size={14} /></button>
            </div>
          ) : (
            <label className="border border-dashed border-[#D8D2C2] rounded-lg flex items-center justify-center gap-2 py-3 cursor-pointer text-center hover:bg-[#FAF6EF] mb-2">
              <Paperclip size={15} style={{ color: C.purple }} />
              <span className="text-xs font-medium">{uploading ? "Uploading…" : "Attach a PDF or image (optional)"}</span>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={onFile} disabled={uploading} />
            </label>
          )}
          {uploadError && <div className="text-xs mb-2" style={{ color: "#A6423A" }}>{uploadError}</div>}
          <button onClick={add} className="text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}>Publish</button>
        </Card>
      ) : (
        <Card className="mb-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Megaphone size={16} /></div>
          <div>
            <div className="font-h font-semibold text-sm">Announcements</div>
            <p className="text-xs text-[#6E6455] mt-0.5">Posted by your admins and co-admins. You can view and download any attachments below.</p>
          </div>
        </Card>
      )}

      {isDirector && <DepartmentScopeTabs data={data} isHOD={false} activeId={viewTab} onChange={setViewTab} includeInactive />}

      <div className="space-y-2">
        {visible.map((a) => {
          const AttIcon = a.dataUrl ? fileKindIcon(a.fileType || "") : null;
          return (
            <Card key={a.id} className="flex items-start justify-between">
              <div>
                <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                  {a.title}
                  {isAdmin && hasDepts && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: a.departmentId ? "#F6F0E4" : "#EAEEF0", color: a.departmentId ? "#6E6455" : "#2C4A63" }}>
                      {a.departmentId ? deptName(data, a.departmentId) : "All Departments"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#6E6455] mt-1">{a.message}</div>
                {a.dataUrl && (
                  <div className="inline-flex items-center gap-2 mt-1.5">
                    <button type="button" onClick={() => openAttachment(a.dataUrl, a.fileName, a.fileType)} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: C.purple }}>
                      <AttIcon size={13} /> {a.fileName}
                    </button>
                    <a href={a.dataUrl} download={a.fileName} title="Download" className="text-[#A79E8C] hover:text-[#2B2620]"><Download size={12} /></a>
                  </div>
                )}
                <div className="text-[10px] text-[#A79E8C] mt-1">{fmt(a.date)}</div>
              </div>
              {isAdmin && canManage(a) && <button onClick={() => remove(a.id)} className="text-[#D9D0BC] hover:text-[#A6423A] flex-shrink-0"><Trash2 size={15} /></button>}
            </Card>
          );
        })}
        {visible.length === 0 && <div className="text-sm text-[#A79E8C]">No announcements yet.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Resources (shared, real file upload) ------------------------------ */


export default AnnouncementsView;
export { AnnouncementsView };
