import React, { useState, useRef } from "react";
import {
  Trash2, Wand2, Upload, Download,
} from "lucide-react";
import {
  C, uid, fmtFull,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash, generateRecommendedBlocks } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, useDeleteConfirm,
} from "../components/UI";
import { uploadAttachment } from "../lib/uploadAttachment";

function DatesheetView({ data, setData }) {
  const fileRef = useRef();
  const [form, setForm] = useState({ title: "", examType: "ST", date: "", courseId: "" });
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const onFile = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 25_000_000) { alert("File is too large (limit 25MB)."); return; }
    setUploadError(""); setUploading(true);
    try {
      const { url: dataUrl } = await uploadAttachment(f); // "dataUrl" name kept for compatibility; it's a real Storage URL now
      setPendingFile({ name: f.name, type: f.type, dataUrl });
    } catch (err) {
      setUploadError(err.message || "Couldn't upload that file — try again.");
    } finally {
      setUploading(false);
    }
  };

  const upload = () => {
    if (!form.title.trim() || !form.date) return;
    const ds = { id: uid(), ...form, fileName: pendingFile?.name, fileType: pendingFile?.type, dataUrl: pendingFile?.dataUrl, uploadedAt: new Date().toISOString() };
    setData((d) => {
      let next = { ...d, datesheets: [...d.datesheets, ds] };
      if (d.autoMode) {
        const blocks = generateRecommendedBlocks(ds, next.courses, next.plannerBlocks);
        next = { ...next, plannerBlocks: [...next.plannerBlocks, ...blocks] };
        next = logActivity(next, `Datesheet uploaded: ${ds.title} — timetable auto-generated`);
      } else {
        next = logActivity(next, `Datesheet uploaded: ${ds.title}`);
      }
      return next;
    });
    setForm({ title: "", examType: "ST", date: "", courseId: "" });
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const remove = (id) => {
    const item = data.datesheets.find((x) => x.id === id);
    confirmDelete(`Datesheet "${item?.title || "datesheet"}" (its auto-generated timetable entries will also be removed)`, () => {
      setData((d) => moveToTrash({ ...d, datesheets: d.datesheets.filter((x) => x.id !== id), plannerBlocks: d.plannerBlocks.filter((b) => b.sourceId !== id) }, "datesheet", item, `Datesheet: ${item?.title || "datesheet"}`));
    });
  };

  const toggleAuto = () => setData((d) => ({ ...d, autoMode: !d.autoMode }));

  return (
    <div>
      {deleteModal}
      <Card className="mb-4 flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.purpleSoft, color: C.purple }}><Wand2 size={20} /></div>
        <div className="flex-1">
          <div className="font-h font-semibold">Automatic Timetable Generation</div>
          <p className="text-xs text-[#6E6455] mt-0.5">When Auto Mode is on, saving a datesheet immediately generates a recommended revision week; if the exam is still further out, the plan also auto-fills once it enters the 7-day window on your next visit.</p>
        </div>
        <button onClick={toggleAuto} className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: data.autoMode ? "#E4EADD" : "#F1E1DC", color: data.autoMode ? "#34502F" : "#6E2C25" }}>
          Auto Mode: {data.autoMode ? "ON" : "OFF"}
        </button>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="font-h font-semibold mb-3">Upload Datesheet (ST / PUT / External)</div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title, e.g. DBMS Sessional Test 1" className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm w-full mb-2" />
          <div className="grid grid-cols-3 gap-2 mb-2">
            <select value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm"><option>ST</option><option>PUT</option><option>External</option></select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm" />
            <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
              <option value="">All subjects</option>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </div>
          <label className="border border-dashed border-[#D8D2C2] rounded-lg flex flex-col items-center justify-center gap-1 py-6 cursor-pointer text-center mb-3 hover:bg-[#FAF6EF]">
            <Upload size={20} style={{ color: C.purple }} />
            <span className="text-sm font-medium">{uploading ? "Uploading…" : pendingFile ? pendingFile.name : "Upload Datesheet (PDF / Image)"}</span>
            <span className="text-xs text-[#A79E8C]">Supported: PDF, JPG, PNG (max 25MB)</span>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
          {uploadError && <div className="text-xs mb-2" style={{ color: "#A6423A" }}>{uploadError}</div>}
          <button onClick={upload} className="text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}>Save Datesheet</button>
        </Card>

        <Card>
          <div className="font-h font-semibold mb-3">Recent Uploads</div>
          <div className="space-y-2">
            {[...data.datesheets].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).map((ds) => {
              const generated = data.plannerBlocks.some((b) => b.sourceId === ds.id);
              return (
                <div key={ds.id} className="flex items-center justify-between text-sm border-b border-[#F1EADD] pb-2">
                  <div>
                    <div className="font-medium">{ds.title}</div>
                    <div className="text-xs text-[#A79E8C]">{ds.examType} · exam {fmtFull(ds.date)} {generated && "· timetable generated"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ds.dataUrl && <a href={ds.dataUrl} download={ds.fileName} className="text-[#A79E8C] hover:text-[#2B2620]"><Download size={14} /></a>}
                    <button onClick={() => remove(ds.id)} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
            {data.datesheets.length === 0 && <div className="text-sm text-[#A79E8C]">No datesheets uploaded yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Timetables (admin, generated list) ------------------------------ */


export default DatesheetView;
export { DatesheetView };
