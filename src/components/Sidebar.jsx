import React, {} from "react";
import {
  GraduationCap,
} from "lucide-react";
import {
  C, deptName,
} from "../theme";

function SidebarContent({ data, isAdmin, tab, goTo, logout, navSections }) {
  return (
    <>
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: C.purple }}><GraduationCap size={18} /></div>
        <div>
          <div className="font-h font-semibold text-[15px] leading-tight">StudyTrack</div>
          <div className="text-[11px] text-[#A79E8C]">{isAdmin ? "Admin Panel" : "Plan · Track · Succeed"}</div>
        </div>
      </div>
      <nav className="px-3 flex-1 space-y-1 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.section} className="mb-3">
            <div className={`text-[10px] font-semibold tracking-wide px-3 mb-1 ${isAdmin ? "text-[#6E6455]" : "text-[#A79E8C]"}`}>{section.section}</div>
            {section.items.map((t) => {
              const Icon = t.icon; const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => goTo(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? "font-semibold" : isAdmin ? "text-[#D9D0BC] hover:bg-[#2B2620]" : "text-[#6E6455] hover:bg-[#FAF6EF]"}`}
                  style={active ? (isAdmin ? { background: C.purple, color: "white" } : { background: C.purpleSoft, color: C.purple }) : {}}>
                  <Icon size={17} /> {t.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={`m-3 rounded-xl p-3 ${isAdmin ? "bg-[#2B2620]" : "bg-[#FAF6EF]"}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden" style={{ background: C.purple }}>
            {data.profiles[data.session].photo
              ? <img src={data.profiles[data.session].photo} alt="" className="w-full h-full object-cover" />
              : (data.profiles[data.session].name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{data.profiles[data.session].name}</div>
            <div className="text-[11px] text-[#A79E8C]">
              {data.profiles[data.session]?.role === "admin" ? "Super Admin" : isAdmin ? "Admin" : (data.departments.length > 1 ? `Student · ${deptName(data, data.profiles[data.session]?.departmentId || data.departments[0]?.id)}` : "Student")}
            </div>
          </div>
        </div>
        <button onClick={logout} className={`w-full text-xs py-1.5 rounded-lg ${isAdmin ? "bg-[#3A3327] text-[#E7DFCF]" : "bg-white border border-[#E6DFD1] text-[#6E6455]"}`}>Log out</button>
      </div>
    </>
  );
}

/* ---------------------------- Shared bits ---------------------------- */


export default SidebarContent;
export { SidebarContent };
