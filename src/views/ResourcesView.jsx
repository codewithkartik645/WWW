import React, { useState, useRef } from "react";
import {
  Plus, Trash2, Upload, Download,
} from "lucide-react";
import {
  C, uid,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash } from "../utils/activity";
import {
  fileKindIcon, openAttachment,
} from "../utils/files";
import {
  Card, useDeleteConfirm,
} from "../components/UI";
import { uploadAttachment } from "../lib/uploadAttachment";

function ResourcesView({ data, setData }) {
  const fileRef = useRef();
  const [mode, setMode] = useState("file");
  const [form, setForm] = useState({ title: "", url: "", courseId: "" });
  const [pending, setPending] = useState(null);

  const onFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 25_000_000) { alert("That file is larger than 25MB — please paste a link instead (e.g. Google Drive)."); return; }
    const { url: dataUrl } = await uploadAttachment(f); // "dataUrl" name kept for compatibility; it's a real Storage URL now
    setPending({ name: f.name, type: f.type, dataUrl });
  };

  const add = () => {
    if (mode === "file") {
      if (!pending) return;
      setData((d) => logActivity({ ...d, resources: [...d.resources, { id: uid(), title: form.title || pending.name, fileName: pending.name, fileType: pending.type, dataUrl: pending.dataUrl, courseId: form.courseId || null }] }, `Resource uploaded: ${form.title || pending.name}`));
      setPending(null); if (fileRef.current) fileRef.current.value = "";
    } else {
      if (!form.title.trim() || !form.url.trim()) return;
      setData((d) => logActivity({ ...d, resources: [...d.resources, { id: uid(), title: form.title, url: form.url, courseId: form.courseId || null }] }, `Resource linked: ${form.title}`));
    }
    setForm({ title: "", url: "", courseId: "" });
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const remove = (id) => {
    const item = data.resources.find((r) => r.id === id);
    confirmDelete(`Resource "${item?.title || "resource"}"`, () => {
      setData((d) => moveToTrash({ ...d, resources: d.resources.filter((r) => r.id !== id) }, "resource", item, `Resource: ${item?.title || "resource"}`));
    });
  };
  const courseCode = (id) => data.courses.find((c) => c.id === id)?.code;

  return (
    <div>
      {deleteModal}
      <Card className="mb-4">
        <div className="flex gap-1 bg-[#FAF6EF] rounded-lg p-1 w-fit mb-3">
          {["file", "link"].map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`text-xs px-3 py-1.5 rounded-md capitalize ${mode === m ? "bg-white shadow-sm font-medium" : "text-[#6E6455]"}`}>{m === "file" ? "Upload file" : "Paste link"}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mb-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (optional for file)" className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm" />
          <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
            <option value="">General (no subject)</option>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </div>
        {mode === "file" ? (
          <label className="border border-dashed border-[#D8D2C2] rounded-lg flex flex-col items-center justify-center gap-1 py-6 cursor-pointer text-center hover:bg-[#FAF6EF]">
            <Upload size={20} style={{ color: C.purple }} />
            <span className="text-sm font-medium">{pending ? pending.name : "Click to choose a file"}</span>
            <span className="text-xs text-[#A79E8C]">PDF, PPT, DOC, XLS, images — up to ~1MB</span>
            <input ref={fileRef} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt" className="hidden" onChange={onFile} />
          </label>
        ) : (
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm w-full" />
        )}
        <button onClick={add} className="mt-3 flex items-center gap-1 text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Add resource</button>
      </Card>

      <div className="space-y-2">
        {data.resources.map((r) => {
          const Icon = fileKindIcon(r.fileType || "");
          return (
            <Card key={r.id} className="flex items-center justify-between !py-3">
              {/* Clicking the title now views/previews the file (was silently blocked before, since
                  browsers refuse to navigate a top-level tab straight to a data: URL); the separate
                  Download icon covers anyone who wants to save it. */}
              {r.dataUrl ? (
                <button type="button" onClick={() => openAttachment(r.dataUrl, r.fileName || r.title, r.fileType)} className="flex items-center gap-2 text-sm" style={{ color: C.purple }}>
                  <Icon size={15} /> {r.title}{r.courseId && <span className="text-xs text-[#A79E8C]">· {courseCode(r.courseId)}</span>}
                </button>
              ) : (
                <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm" style={{ color: C.purple }}>
                  <Icon size={15} /> {r.title}{r.courseId && <span className="text-xs text-[#A79E8C]">· {courseCode(r.courseId)}</span>}
                </a>
              )}
              <div className="flex items-center gap-2">
                {r.dataUrl && <a href={r.dataUrl} download={r.fileName} title="Download" className="text-[#A79E8C] hover:text-[#2B2620]"><Download size={14} /></a>}
                <button onClick={() => remove(r.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={15} /></button>
              </div>
            </Card>
          );
        })}
        {data.resources.length === 0 && <div className="text-sm text-[#A79E8C]">No resources saved yet.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Progress (shared) ------------------------------ */


export default ResourcesView;
export { ResourcesView };
