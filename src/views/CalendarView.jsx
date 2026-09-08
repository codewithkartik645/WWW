import React, { useState, useRef } from "react";
import {
  Trash2, ChevronLeft, ChevronRight, Upload, X, FileText,
} from "lucide-react";
import {
  C, uid, fmt, DAYS,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity, moveToTrash } from "../utils/activity";
import {
  } from "../utils/files";
import { parseCalendarPdf } from "../utils/pdfImport";
import {
  Card, TypeBadge, useDeleteConfirm,
} from "../components/UI";

function CalendarView({ data, setData, editable }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: "", date: "", type: "milestone" });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [draftEvents, setDraftEvents] = useState(null); // null = no review panel open
  const [draftFileName, setDraftFileName] = useState("");
  const pdfInputRef = useRef(null);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const dateKey = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const todayKey = new Date().toISOString().slice(0, 10);
  const eventsOn = (key) => [
    ...data.calendarEvents.filter((e) => e.date === key),
    ...data.tasks.filter((t) => t.due === key).map((t) => ({ date: key, title: t.title, type: "task" })),
  ];
  const monthEvents = data.calendarEvents.filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`));
  const shownDate = selected || (monthEvents[0]?.date ?? dateKey(1));
  const shownEvents = eventsOn(shownDate);
  const examCount = monthEvents.filter((e) => e.type === "exam").length;
  const holidayCount = monthEvents.filter((e) => e.type === "holiday").length;
  const milestoneCount = monthEvents.filter((e) => e.type === "milestone").length;
  const typeDot = (type) => type === "exam" ? C.dark : type === "holiday" ? C.green : type === "task" ? C.amber : C.purple;

  const addEvent = () => {
    if (!form.title.trim() || !form.date) return;
    setData((d) => logActivity({ ...d, calendarEvents: [...d.calendarEvents, { id: uid(), ...form }] }, `Event added: ${form.title}`));
    setForm({ title: "", date: "", type: "milestone" });
  };
  const [confirmDelete, deleteModal] = useDeleteConfirm();
  const removeEvent = (id) => {
    const item = data.calendarEvents.find((e) => e.id === id);
    setData((d) => moveToTrash({ ...d, calendarEvents: d.calendarEvents.filter((e) => e.id !== id) }, "calendarEvent", item, `Calendar event: ${item?.title || "event"}`));
  };

  const onPdfSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const drafts = await parseCalendarPdf(file);
      if (drafts.length === 0) {
        setImportError("Couldn't find any dated events in this PDF — it may be a scanned image rather than text. Try a text-based PDF, or add events manually.");
      } else {
        setDraftEvents(drafts.map((ev) => ({ ...ev, id: uid(), include: true })));
        setDraftFileName(file.name);
      }
    } catch (err) {
      setImportError(err.message || "Couldn't read that PDF.");
    } finally {
      setImporting(false);
    }
  };
  const updateDraft = (id, patch) => setDraftEvents((list) => list.map((ev) => ev.id === id ? { ...ev, ...patch } : ev));
  const removeDraft = (id) => setDraftEvents((list) => list.filter((ev) => ev.id !== id));
  const toggleAllDrafts = (include) => setDraftEvents((list) => list.map((ev) => ({ ...ev, include })));
  const confirmImport = () => {
    const chosen = draftEvents.filter((ev) => ev.include && ev.title.trim() && ev.date);
    if (chosen.length === 0) { setDraftEvents(null); return; }
    const existing = new Set(data.calendarEvents.map((ev) => `${ev.date}|${ev.title.trim().toLowerCase()}`));
    const toAdd = chosen
      .filter((ev) => !existing.has(`${ev.date}|${ev.title.trim().toLowerCase()}`))
      .map((ev) => ({ id: uid(), date: ev.date, title: ev.title.trim(), type: ev.type }));
    setData((d) => logActivity({ ...d, calendarEvents: [...d.calendarEvents, ...toAdd] }, `Imported ${toAdd.length} event(s) from ${draftFileName}`));
    setDraftEvents(null);
    setDraftFileName("");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
      {deleteModal}
      <Card className="max-w-md mx-auto lg:mx-0 w-full">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-[#F1E5E4] transition-colors"><ChevronLeft size={16} /></button>
          <div className="flex items-center gap-2">
            <div className="font-h font-semibold text-sm">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
            <button onClick={() => { setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelected(todayKey); }}
              className="text-[10px] px-2 py-0.5 rounded-full border border-[#E6DFD1] text-[#6E6455] hover:border-[#7A2E3A] hover:text-[#7A2E3A] transition-colors">
              Today
            </button>
          </div>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-[#F1E5E4] transition-colors"><ChevronRight size={16} /></button>
        </div>

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-[10.5px] flex items-center gap-1" style={{ color: C.dark }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.dark }} />{examCount} exam{examCount !== 1 ? "s" : ""}</span>
          <span className="text-[10.5px] flex items-center gap-1" style={{ color: C.green }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />{holidayCount} holiday{holidayCount !== 1 ? "s" : ""}</span>
          <span className="text-[10.5px] flex items-center gap-1" style={{ color: C.purple }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.purple }} />{milestoneCount} milestone{milestoneCount !== 1 ? "s" : ""}</span>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-medium text-[#A79E8C] mb-1.5">{DAYS.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const key = dateKey(day); const evs = eventsOn(key);
            const isSel = key === shownDate; const isToday = key === todayKey;
            const isWeekend = i % 7 >= 5;
            const dotTypes = [...new Set(evs.map((e) => e.type))].slice(0, 3);
            return (
              <button key={i} onClick={() => setSelected(key)}
                className={`w-9 h-9 sm:w-9 sm:h-9 mx-auto rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 relative transition-all ${isSel ? "text-white shadow-sm scale-[1.05]" : "hover:bg-[#F1E5E4]"}`}
                style={isSel ? { background: C.purple } : isToday ? { border: `1.5px solid ${C.purple}`, color: C.purple, fontWeight: 600 } : isWeekend ? { color: "#B7AC95" } : {}}>
                {day}
                {dotTypes.length > 0 && (
                  <span className="flex items-center gap-0.5 absolute bottom-1">
                    {dotTypes.map((t, j) => <span key={j} className="w-1 h-1 rounded-full" style={{ background: isSel ? "#fff" : typeDot(t) }} />)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 justify-center mt-3 pt-3 border-t border-[#F4EEE1] flex-wrap">
          {[["milestone", C.purple, "Milestone"], ["exam", C.dark, "Exam"], ["holiday", C.green, "Holiday"], ["task", C.amber, "Task"]].map(([t, col, label]) => (
            <span key={t} className="text-[9.5px] flex items-center gap-1 text-[#A79E8C]"><span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />{label}</span>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="font-h font-semibold mb-3 text-sm">Events on {fmt(shownDate)}</div>
          <div className="space-y-3">
            {shownEvents.length === 0 && <div className="text-sm text-[#A79E8C]">No events this day.</div>}
            {shownEvents.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: typeDot(e.type) }} />
                  <div><div className="text-sm">{e.title}</div>{e.type !== "task" && <TypeBadge type={e.type} />}</div>
                </div>
                {editable && e.id && <button onClick={() => confirmDelete(`Calendar event "${e.title}"`, () => removeEvent(e.id))} className="text-[#D9D0BC] hover:text-[#A6423A]"><Trash2 size={13} /></button>}
              </div>
            ))}
          </div>
        </Card>

        {editable && (
          <Card>
            <div className="font-h font-semibold text-sm mb-2">Add event</div>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm w-full mb-2" />
            <div className="flex gap-2 mb-2">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm flex-1" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm">
                <option value="milestone">Milestone</option><option value="exam">Exam</option><option value="holiday">Holiday</option>
              </select>
            </div>
            <button onClick={addEvent} className="text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}>Add</button>
          </Card>
        )}

        {editable && (
          <Card style={{ borderLeft: `3px solid ${C.purple}` }}>
            <div className="font-h font-semibold text-sm mb-1 flex items-center gap-1.5"><FileText size={14} /> Import academic calendar (PDF)</div>
            <p className="text-xs mb-3" style={{ color: "#A79E8C" }}>Upload the official PDF — dates and events are auto-detected. You'll review, edit, or remove anything before it's added, and can keep editing normally after.</p>
            <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPdfSelected} />
            <button onClick={() => pdfInputRef.current?.click()} disabled={importing}
              className="text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 disabled:opacity-60" style={{ borderColor: C.purple, color: C.purple }}>
              <Upload size={14} /> {importing ? "Reading PDF…" : "Upload PDF"}
            </button>
            {importError && <div className="text-xs mt-2" style={{ color: "#A6423A" }}>{importError}</div>}
          </Card>
        )}
      </div>

      {editable && draftEvents && (
        <div className="lg:col-span-2">
          <Card style={{ borderLeft: `3px solid ${C.purple}` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="font-h font-semibold text-sm flex items-center gap-1.5"><FileText size={14} /> Review events found in "{draftFileName}"</div>
              <button onClick={() => setDraftEvents(null)} className="text-[#A79E8C] hover:text-[#A6423A]"><X size={16} /></button>
            </div>
            <p className="text-xs mb-3" style={{ color: "#A79E8C" }}>{draftEvents.length} event{draftEvents.length !== 1 ? "s" : ""} detected. Uncheck anything wrong, edit titles/dates/types as needed, then import.</p>
            <div className="flex gap-3 mb-3 text-xs">
              <button onClick={() => toggleAllDrafts(true)} className="hover:underline" style={{ color: C.purple }}>Select all</button>
              <button onClick={() => toggleAllDrafts(false)} className="hover:underline" style={{ color: "#6E6455" }}>Deselect all</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 mb-3">
              {draftEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 border border-[#F4EEE1] rounded-lg px-2 py-1.5">
                  <input type="checkbox" checked={ev.include} onChange={(e) => updateDraft(ev.id, { include: e.target.checked })} className="flex-shrink-0" />
                  <input value={ev.title} onChange={(e) => updateDraft(ev.id, { title: e.target.value })} className="border border-[#E6DFD1] rounded-md px-2 py-1 text-xs flex-1 min-w-0" />
                  <input type="date" value={ev.date} onChange={(e) => updateDraft(ev.id, { date: e.target.value })} className="border border-[#E6DFD1] rounded-md px-2 py-1 text-xs flex-shrink-0" />
                  <select value={ev.type} onChange={(e) => updateDraft(ev.id, { type: e.target.value })} className="border border-[#E6DFD1] rounded-md px-2 py-1 text-xs flex-shrink-0">
                    <option value="milestone">Milestone</option><option value="exam">Exam</option><option value="holiday">Holiday</option>
                  </select>
                  <button onClick={() => removeDraft(ev.id)} className="text-[#D9D0BC] hover:text-[#A6423A] flex-shrink-0"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmImport} className="text-sm text-white px-3 py-1.5 rounded-lg" style={{ background: C.purple }}>
                Import {draftEvents.filter((e) => e.include).length} event{draftEvents.filter((e) => e.include).length !== 1 ? "s" : ""}
              </button>
              <button onClick={() => setDraftEvents(null)} className="text-sm px-3 py-1.5 rounded-lg border border-[#E6DFD1]">Cancel</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Subjects / Courses (shared) ------------------------------ */


export default CalendarView;
export { CalendarView };
