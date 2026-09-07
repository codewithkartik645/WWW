import React, { useState, useMemo } from "react";
import {
  Bell, Search, Megaphone, X, LogOut, Menu,
} from "lucide-react";
import {
  C, fmt, flatNav,
} from "../theme";
import {
  } from "../components/UI";

function TopBar({ data, setData, tab, isAdmin, query, setQuery, goTo, navSections, logout, onOpenNav }) {
  const label = tab === "student-detail" ? "Student Profile" : (flatNav(navSections).find((n) => n.id === tab)?.label || "");
  const [showPanel, setShowPanel] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out = [];
    data.courses.forEach((c) => c.name.toLowerCase().includes(q) && out.push({ label: c.name, sub: c.code, go: isAdmin ? "subjects" : "courses" }));
    data.tasks.forEach((t) => t.title.toLowerCase().includes(q) && out.push({ label: t.title, sub: "Task", go: "tasks" }));
    data.calendarEvents.forEach((e) => e.title.toLowerCase().includes(q) && out.push({ label: e.title, sub: fmt(e.date), go: "calendar" }));
    return out.slice(0, 6);
  }, [query, data, isAdmin]);

  const lastSeenCount = data.lastSeenAnnouncements?.[data.session] || 0;
  const unread = Math.max(0, data.announcements.length - lastSeenCount);
  const markSeen = () => setData((d) => ({ ...d, lastSeenAnnouncements: { ...d.lastSeenAnnouncements, [d.session]: d.announcements.length } }));
  const toggleAnnouncements = () => {
    setShowPanel((s) => {
      const next = !s;
      if (next) markSeen(); // opening the popup is what counts as "seen" — the badge clears right away
      return next;
    });
  };
  const recent = data.announcements.slice(0, 5);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onOpenNav} className="lg:hidden flex-shrink-0 w-9 h-9 rounded-lg border border-[#E6DFD1] bg-white flex items-center justify-center text-[#6E6455]">
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="font-h text-xl font-semibold truncate">{tab === "dashboard" ? `Welcome back, ${data.profiles[data.session].name}!` : label} {tab === "dashboard" && "👋"}</h1>
            {tab === "dashboard" && <p className="text-sm text-[#6E6455] mt-0.5">{isAdmin ? "Here's an overview of academic and student activity." : "Here's what's happening with your studies today."}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:block relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A79E8C]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subjects, tasks, events…" className="border border-[#E6DFD1] rounded-lg pl-8 pr-3 py-2 text-sm w-64 bg-white" />
            {results.length > 0 && (
              <div className="absolute mt-1 w-full bg-white border border-[#E6DFD1] rounded-lg shadow-lg z-30 overflow-hidden">
                {results.map((r, i) => (
                  <button key={i} onClick={() => { goTo(r.go); setQuery(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#FAF6EF] flex justify-between">
                    <span>{r.label}</span><span className="text-[#A79E8C] text-xs">{r.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <button onClick={toggleAnnouncements} title="Announcements" className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#6E6455] bg-white border border-[#E6DFD1] hover:bg-[#FAF6EF]">
              <Bell size={16} />
              {unread > 0 && <span className="absolute -top-1 -right-1 bg-[#A6423A] text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center leading-none">{unread > 9 ? "9+" : unread}</span>}
            </button>
            {showPanel && (
              <>
                {/* Invisible full-screen catcher so clicking anywhere outside the popup closes it. */}
                <div className="fixed inset-0 z-30" onClick={() => setShowPanel(false)} />
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-[#E6DFD1] rounded-xl shadow-xl z-40 overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F1EADD]">
                    <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#2B2620" }}><Megaphone size={14} style={{ color: C.purple }} /> Announcements</div>
                    <button onClick={() => setShowPanel(false)} title="Close" className="w-6 h-6 rounded-md flex items-center justify-center text-[#A79E8C] hover:bg-[#FAF6EF] hover:text-[#2B2620]"><X size={14} /></button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#F1EADD]">
                    {recent.length === 0 && <div className="px-3.5 py-4 text-sm text-[#A79E8C]">No announcements yet.</div>}
                    {recent.map((a) => (
                      <div key={a.id} className="px-3.5 py-2.5">
                        <div className="text-sm font-medium" style={{ color: "#2B2620" }}>{a.title}</div>
                        {a.message && <div className="text-xs text-[#6E6455] mt-0.5">{a.message}</div>}
                        {a.dataUrl && (
                          <button type="button" onClick={() => openAttachment(a.dataUrl, a.fileName, a.fileType)} className="inline-flex items-center gap-1 text-xs font-medium mt-1" style={{ color: C.purple }}>
                            {React.createElement(fileKindIcon(a.fileType || ""), { size: 12 })} {a.fileName}
                          </button>
                        )}
                        <div className="text-[10px] text-[#A79E8C] mt-1">{fmt(a.date)}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setShowPanel(false); goTo("announcements"); }} className="w-full text-center text-xs font-medium py-2.5 border-t border-[#F1EADD] hover:bg-[#FAF6EF]" style={{ color: C.purple }}>
                    View all announcements
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-[#E6DFD1] bg-white text-[#6E6455] hover:bg-[#FAF6EF] flex-shrink-0"
          >
            <LogOut size={14} /> <span className="hidden xs:inline">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================= STUDENT ============================= */


export default TopBar;
export { TopBar };
