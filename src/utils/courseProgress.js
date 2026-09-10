import { uid } from "../theme";

function progressRow(data, userId, courseId) {
  return (data.courseProgress || []).find((p) => p.ownerKey === userId && p.courseId === courseId);
}

/** Overlay this user's own unit checkoffs and elective pick onto the shared course list.
 *  Completion is personal — writing `courses.units[].done` is blocked for students by RLS. */
function coursesForUser(data, userId) {
  return (data.courses || []).map((c) => {
    const p = progressRow(data, userId, c.id);
    const doneSet = new Set(p?.doneUnitIds || []);
    return {
      ...c,
      name: p?.electiveName || c.name,
      units: (c.units || []).map((u) => ({ ...u, done: doneSet.has(u.id) })),
    };
  });
}

function upsertProgress(d, courseId, patch) {
  const ownerKey = d.session;
  const list = d.courseProgress || [];
  const existing = list.find((p) => p.ownerKey === ownerKey && p.courseId === courseId);
  if (existing) {
    return { ...d, courseProgress: list.map((p) => (p === existing ? { ...p, ...patch } : p)) };
  }
  return { ...d, courseProgress: [...list, { id: uid(), ownerKey, courseId, doneUnitIds: [], ...patch }] };
}

function toggleUnitProgress(d, courseId, unitId) {
  const existing = progressRow(d, d.session, courseId);
  const ids = existing?.doneUnitIds || [];
  const doneUnitIds = ids.includes(unitId) ? ids.filter((id) => id !== unitId) : [...ids, unitId];
  return upsertProgress(d, courseId, { doneUnitIds });
}

function setElectiveProgress(d, courseId, electiveName) {
  return upsertProgress(d, courseId, { electiveName });
}

export { coursesForUser, toggleUnitProgress, setElectiveProgress };
