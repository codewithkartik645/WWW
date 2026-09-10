import React, { useState } from "react";
import {
  Plus, Flame,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from "recharts";
import {
  C, uid,
} from "../theme";
import {
  } from "../data/seedData";
import {
  } from "../utils/files";
import {
  Card, Donut, useStreak,
} from "../components/UI";
import { coursesForUser } from "../utils/courseProgress";

function ProgressView({ data, setData, isAdmin = false }) {
  // Students only see their own logged sessions; a log without an owner is legacy/shared data from before per-student tracking.
  const myLogs = isAdmin ? data.studyLogs : data.studyLogs.filter((l) => !l.ownerKey || l.ownerKey === data.session);
  const myCourses = isAdmin ? data.courses : coursesForUser(data, data.session);
  const totalTopics = myCourses.reduce((s, c) => s + c.units.length, 0);
  const doneTopics = myCourses.reduce((s, c) => s + c.units.filter((u) => u.done).length, 0);
  const overallPct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;
  const chartData = myCourses.map((c) => ({ code: c.code, hours: +(myLogs.filter((l) => l.courseId === c.id).reduce((s, l) => s + l.minutes, 0) / 60).toFixed(1) }));
  const streak = useStreak(myLogs);
  const [logForm, setLogForm] = useState({ courseId: data.courses[0]?.id || "", minutes: 30 });
  const logSession = () => setData((d) => ({ ...d, studyLogs: [...d.studyLogs, { id: uid(), courseId: logForm.courseId, minutes: Number(logForm.minutes), date: new Date().toISOString().slice(0, 10), ownerKey: d.session }] }));

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4">
      <div className="space-y-4">
        <Card>
          <div className="font-h font-semibold mb-3">Hours studied per subject</div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1EADD" /><XAxis dataKey="code" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                <Bar dataKey="hours" fill={C.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <div className="font-h font-semibold mb-3">Subject-wise progress</div>
          <div className="space-y-3">
            {myCourses.map((c) => {
              const done = c.units.filter((u) => u.done).length; const pct = c.units.length ? Math.round((done / c.units.length) * 100) : 0;
              return <div key={c.id}><div className="flex justify-between text-xs mb-1"><span className="font-mono text-[#6E6455]">{c.code}</span><span className="text-[#6E6455]">{pct}%</span></div><div className="h-2 bg-[#E6DFD1] rounded"><div className="h-2 rounded" style={{ width: `${pct}%`, background: c.color }} /></div></div>;
            })}
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <div className="text-xs font-semibold text-[#A79E8C] mb-2">OVERALL PROGRESS</div>
          <div className="flex flex-col items-center"><Donut pct={overallPct} size={120} /><div className="font-h text-xl font-semibold -mt-16">{overallPct}%</div></div>
          <div className="text-center text-xs text-[#6E6455] mt-8">Great job! Keep going 🚀</div>
        </Card>
        <Card><div className="flex items-center gap-2 mb-1"><Flame size={16} className="text-[#A6423A]" /><span className="font-h font-semibold">{streak} Days</span></div><div className="text-xs text-[#A79E8C]">Current streak</div></Card>
        {isAdmin ? (
          <Card>
            <div className="text-xs font-semibold text-[#A79E8C] mb-1">VIEW ONLY</div>
            <div className="text-xs text-[#6E6455]">This shows the student's progress. Completion is marked by the student themselves — admins can view it here, and can add, remove, or hide subjects/units from Subjects.</div>
          </Card>
        ) : (
          <Card>
            <div className="text-xs font-semibold text-[#A79E8C] mb-2">LOG A SESSION</div>
            <select value={logForm.courseId} onChange={(e) => setLogForm({ ...logForm, courseId: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm w-full mb-2">{myCourses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
            <div className="flex gap-2"><input type="number" min="5" step="5" value={logForm.minutes} onChange={(e) => setLogForm({ ...logForm, minutes: e.target.value })} className="border border-[#E6DFD1] rounded-lg px-2 py-2 text-sm w-20" /><button onClick={logSession} className="flex items-center gap-1 text-sm text-white px-3 py-2 rounded-lg" style={{ background: C.purple }}><Plus size={14} /> Log</button></div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ============================= ADMIN ============================= */


export default ProgressView;
export { ProgressView };
