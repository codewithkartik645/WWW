import React, {} from "react";
import {
  Download, RefreshCw,
} from "lucide-react";
import {
  C, fmtFull,
  daysUntil, DAYS,
} from "../theme";
import {
  } from "../data/seedData";
import { generateRecommendedBlocks } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, Badge,
} from "../components/UI";

function ExamsView({ data, setData }) {
  const regenerate = (ds) => {
    setData((d) => {
      const cleared = { ...d, plannerBlocks: d.plannerBlocks.filter((b) => b.sourceId !== ds.id) };
      const blocks = generateRecommendedBlocks(ds, cleared.courses, cleared.plannerBlocks);
      return { ...cleared, plannerBlocks: [...cleared.plannerBlocks, ...blocks] };
    });
  };
  const sorted = [...data.datesheets].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-4">
      {sorted.length === 0 && <Card><div className="text-sm text-[#A79E8C]">No exam datesheets published yet.</div></Card>}
      {sorted.map((ds) => {
        const blocks = data.plannerBlocks.filter((b) => b.sourceId === ds.id).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
        const dLeft = daysUntil(ds.date);
        return (
          <Card key={ds.id}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-h font-semibold">{ds.title}</div>
                <div className="text-xs text-[#A79E8C]">{ds.examType} · {fmtFull(ds.date)}</div>
              </div>
              <Badge color={dLeft <= 7 ? C.red : dLeft <= 15 ? C.amber : C.green}>{dLeft >= 0 ? `${dLeft}d left` : "past"}</Badge>
            </div>
            {ds.dataUrl && <a href={ds.dataUrl} download={ds.fileName} className="text-xs flex items-center gap-1 mb-3" style={{ color: C.purple }}><Download size={12} /> Download datesheet</a>}
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-[#A79E8C]">RECOMMENDED REVISION WEEK</div>
              <button onClick={() => regenerate(ds)} className="flex items-center gap-1 text-xs" style={{ color: C.purple }}><RefreshCw size={12} /> Regenerate</button>
            </div>
            {blocks.length === 0 ? <div className="text-sm text-[#A79E8C]">Will generate automatically 7 days before the exam.</div> : (
              <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-2">
                {blocks.map((b) => (
                  <div key={b.id} className="rounded-lg p-2 text-xs text-white" style={{ background: b.color }}>
                    <div className="font-semibold">{b.day}</div><div>{b.start}–{b.end}</div><div className="opacity-90">{b.label}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------ Co-curricular ------------------------------ */


export default ExamsView;
export { ExamsView };
