import React, { useState, useEffect, useMemo } from "react";
import {
  Trash2, Download, Eye, X, EyeOff,
} from "lucide-react";
import {
  C,
} from "../theme";
import {
  fileKindIcon, openAttachment, registerAttachmentPreview,
} from "../utils/files";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

// Mounted once at the app root; shows whatever openAttachment() was last called with.
function AttachmentPreviewModal() {
  const [item, setItem] = useState(null); // { dataUrl, fileName, fileType }
  useEffect(() => { registerAttachmentPreview(setItem); return () => registerAttachmentPreview(null); }, []);
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => { if (e.key === "Escape") setItem(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item]);
  if (!item) return null;
  const mimeFromUrl = (item.dataUrl.match(/^data:(.*?);base64/) || [])[1] || "";
  const type = item.fileType || mimeFromUrl;
  const isImage = type.includes("image");
  const isPdf = type.includes("pdf");
  const close = () => setItem(null);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.7)" }} onClick={close}>
      {/* Fixed to the viewport corner (not the card), so it's always visible and clickable even
          if the card's own header gets squeezed by an unusual iframe/viewport height. */}
      <button
        onClick={close}
        title="Close"
        aria-label="Close preview"
        className="fixed top-4 right-4 z-[61] w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-[#2B2620] hover:bg-[#F1EADD] border border-[#E6DFD1]"
      >
        <X size={20} />
      </button>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] min-h-[50vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E6DFD1] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {React.createElement(fileKindIcon(type), { size: 15, style: { color: C.purple }, className: "flex-shrink-0" })}
            <span className="text-sm font-medium truncate">{item.fileName || "Attachment"}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <a href={item.dataUrl} download={item.fileName || "attachment"} title="Download" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E6455] hover:bg-[#FAF6EF]"><Download size={15} /></a>
            <button onClick={close} title="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E6455] hover:bg-[#FAF6EF]"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-[#FAF6EF] flex items-center justify-center overflow-auto">
          {isImage ? (
            <img src={item.dataUrl} alt={item.fileName || "attachment"} className="max-w-full max-h-full object-contain" />
          ) : isPdf ? (
            <iframe src={item.dataUrl} title={item.fileName || "attachment"} className="w-full h-full border-0" />
          ) : (
            <div className="text-center p-8">
              <div className="text-sm text-[#6E6455] mb-3">This file type can't be previewed here.</div>
              <a href={item.dataUrl} download={item.fileName || "attachment"} className="text-sm text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: C.purple }}><Download size={13} /> Download instead</a>
            </div>
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-[#E6DFD1] flex-shrink-0 flex justify-end">
          <button onClick={close} className="text-sm font-medium px-4 py-1.5 rounded-lg text-white" style={{ background: C.purple }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// A "View" button that previews the attachment (new tab) without ever triggering a save-to-disk,
// paired with an explicit "Download" link that always downloads. Handles both data: URLs (uploaded
// files) and plain http(s) links (e.g. a pasted Google Drive URL) sensibly.
function AttachmentActions({ dataUrl, url, fileName, iconOnly = false }) {
  const isRemote = !dataUrl && !!url;
  return (
    <span className="inline-flex items-center gap-2 flex-shrink-0">
      <button
        type="button"
        onClick={() => (isRemote ? window.open(url, "_blank", "noopener") : openAttachment(dataUrl, fileName))}
        title="View"
        className={iconOnly ? "text-[#A79E8C] hover:text-[#2B2620]" : "inline-flex items-center gap-1 text-xs font-medium hover:underline"}
        style={iconOnly ? {} : { color: C.purple }}
      >
        <Eye size={iconOnly ? 13 : 12} />{!iconOnly && " View"}
      </button>
      {dataUrl && (
        <a href={dataUrl} download={fileName} title="Download" className="text-[#A79E8C] hover:text-[#2B2620]">
          <Download size={iconOnly ? 13 : 12} />
        </a>
      )}
    </span>
  );
}

function Card({ children, className = "", style = {} }) { return <div className={`card p-5 ${className}`} style={style}>{children}</div>; }

function ConfirmModal({ open, title, message, confirmLabel = "Remove", cancelLabel = "Cancel", danger = true, icon: Icon = Trash2, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: danger ? "#F1E1DC" : C.purpleSoft }}>
            <Icon size={15} color={danger ? C.red : C.purple} />
          </div>
          <div className="text-sm font-semibold" style={{ color: "#2B2620" }}>{title}</div>
        </div>
        <p className="text-xs leading-relaxed mb-4" style={{ color: "#6E6455" }}>{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-lg border border-[#E6DFD1]" style={{ color: "#2B2620" }}>{cancelLabel}</button>
          <button onClick={onConfirm} className="text-sm px-3 py-1.5 rounded-lg text-white" style={{ background: danger ? C.red : C.purple }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** Reusable "are you sure?" flow for any delete button — renders a ConfirmModal and
 *  runs the given action only once confirmed. Deleted items are recoverable from Trash,
 *  so the modal copy reflects that instead of implying the action is permanent. */

function useDeleteConfirm() {
  const [pending, setPending] = useState(null); // { label, onConfirm }
  const requestDelete = (label, onConfirm) => setPending({ label, onConfirm });
  const modal = (
    <ConfirmModal
      open={!!pending}
      title="Delete this item?"
      message={pending ? `${pending.label} will be removed. You can restore it later from Trash if this was a mistake.` : ""}
      confirmLabel="Delete"
      onConfirm={() => { pending.onConfirm(); setPending(null); }}
      onCancel={() => setPending(null)}
    />
  );
  return [requestDelete, modal];
}


function PasswordInput({ className = "", style = {}, iconColor, wrapperClassName = "relative", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className={wrapperClassName}>
      <input
        {...props}
        type={show ? "text" : "password"}
        className={`${className} pr-9`}
        style={style}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
        style={{ color: iconColor || "#A79E8C" }}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function Badge({ children, color }) { return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ background: color }}>{children}</span>; }

function TypeBadge({ type }) { const map = { exam: C.dark, holiday: C.green, milestone: C.purple }; return <Badge color={map[type] || "#A79E8C"}>{type}</Badge>; }

function useStreak(studyLogs) {
  return useMemo(() => {
    const days = new Set(studyLogs.map((l) => l.date));
    let s = 0, d = new Date();
    while (days.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }, [studyLogs]);
}

function weekLogHours(studyLogs) {
  const start = new Date(); start.setDate(start.getDate() - 6);
  const mins = studyLogs.filter((l) => new Date(l.date) >= start).reduce((s, l) => s + l.minutes, 0);
  return +(mins / 60).toFixed(1);
}


function Donut({ pct, size = 90, color = C.purple }) {
  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={[{ v: pct }, { v: 100 - pct }]} dataKey="v" innerRadius={size * 0.36} outerRadius={size * 0.48} startAngle={90} endAngle={-270}>
            <Cell fill={color} /><Cell fill={C.gray} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------ Calendar (shared) ------------------------------ */


function ResourceLine({ r }) {
  const Icon = fileKindIcon(r.fileType || "");
  // No `download` attribute here — clicking opens/previews the file in a new tab instead of
  // forcing a save dialog. A small separate download icon covers anyone who does want the file.
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      {r.dataUrl ? (
        <button type="button" onClick={() => openAttachment(r.dataUrl, r.fileName || r.title, r.fileType)} className="flex items-center gap-2 text-xs truncate" style={{ color: C.purple }}>
          <Icon size={13} className="flex-shrink-0" /> <span className="truncate">{r.title}</span>
        </button>
      ) : (
        <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs truncate" style={{ color: C.purple }}>
          <Icon size={13} className="flex-shrink-0" /> <span className="truncate">{r.title}</span>
        </a>
      )}
      {r.dataUrl && <a href={r.dataUrl} download={r.fileName} title="Download" className="text-[#A79E8C] hover:text-[#2B2620] flex-shrink-0"><Download size={12} /></a>}
    </div>
  );
}

/* ------------------------------ Study Planner / College Classes (shared) ------------------------------ */


export { Card, Badge, TypeBadge, ConfirmModal, useDeleteConfirm, PasswordInput, AttachmentActions, AttachmentPreviewModal, Donut, useStreak, weekLogHours, ResourceLine };
