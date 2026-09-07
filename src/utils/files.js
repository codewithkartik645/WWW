import React, {} from "react";
import {
  ClipboardList, FileText, Image as ImageIcon, Paperclip,
} from "lucide-react";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function fileToResizedPhoto(file, size = 200) {
  return new Promise((resolve, reject) => {
    fileToDataUrl(file).then((dataUrl) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = dataUrl;
    }).catch(reject);
  });
}

function fileKindIcon(type = "") {
  if (type.includes("pdf")) return FileText;
  if (type.includes("presentation") || type.includes("powerpoint")) return ClipboardList;
  if (type.includes("image")) return ImageIcon;
  return Paperclip;
}

// `window.open()` to a blob:/data: URL gets silently swallowed in a lot of embedded/sandboxed
// contexts (no popup, no error) — that's why "View" on a PDF or image used to just do nothing.
// Instead we preview the file *inside* the app in a modal (an <img> or <iframe> pointed at the
// data URL always renders, since it's not a popup/navigation), and only fall back to opening a
// new tab as a last resort (e.g. if for some reason no preview host is mounted).
let _showAttachmentPreview = null;
function registerAttachmentPreview(fn) { _showAttachmentPreview = fn; }
function openAttachment(dataUrl, fileName, fileType) {
  if (!dataUrl) return;
  if (_showAttachmentPreview) { _showAttachmentPreview({ dataUrl, fileName, fileType }); return; }
  try {
    const [header, base64] = dataUrl.split(",");
    const mime = (header.match(/data:(.*?);base64/) || [])[1] || "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    window.open(blobUrl, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (e) {
    window.open(dataUrl, "_blank", "noopener");
  }
}

export { fileToDataUrl, fileToResizedPhoto, fileKindIcon, registerAttachmentPreview, openAttachment };
