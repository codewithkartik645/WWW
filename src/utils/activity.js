import {
  uid, toMin, minToTime, DAYS,
} from "../theme";

function logActivity(d, text) {
  const entry = { id: uid(), text, ts: new Date().toISOString(), by: d.session };
  return { ...d, activityLog: [entry, ...d.activityLog].slice(0, 150) };
}

/** Soft-delete: stash a copy of the removed item in trash instead of losing it for good.
 *  `extra` carries enough context (e.g. parent course/enrollment id) to reinsert it correctly on restore. */
function moveToTrash(d, type, item, label, extra = {}) {
  const entry = { id: uid(), type, item, extra, label, deletedAt: new Date().toISOString(), deletedBy: d.session };
  return logActivity({ ...d, trash: [entry, ...(d.trash || [])].slice(0, 300) }, `Deleted: ${label}`);
}

function restoreFromTrash(d, entryId) {
  const entry = (d.trash || []).find((t) => t.id === entryId);
  if (!entry) return d;
  let next = { ...d, trash: d.trash.filter((t) => t.id !== entryId) };
  switch (entry.type) {
    case "calendarEvent": next.calendarEvents = [...next.calendarEvents, entry.item]; break;
    case "course": next.courses = [...next.courses, entry.item]; break;
    case "courseUnit": {
      if (next.courses.some((c) => c.id === entry.extra.courseId)) {
        next.courses = next.courses.map((c) => c.id === entry.extra.courseId ? { ...c, units: [...c.units, entry.item] } : c);
      }
      break;
    }
    case "courseSyllabus": {
      if (entry.item && next.courses.some((c) => c.id === entry.extra.courseId)) {
        next.courses = next.courses.map((c) => c.id === entry.extra.courseId ? { ...c, syllabus: entry.item } : c);
      }
      break;
    }
    case "task": next.tasks = [...next.tasks, entry.item]; break;
    case "plannerBlock": next.plannerBlocks = [...next.plannerBlocks, entry.item]; break;
    case "coCurricularCatalog": next.coCurricularCatalog = [...next.coCurricularCatalog, entry.item]; break;
    case "enrollment": next.enrollments = [...next.enrollments, entry.item]; break;
    case "enrollmentModule": {
      if (next.enrollments.some((e) => e.id === entry.extra.enrollId)) {
        next.enrollments = next.enrollments.map((e) => e.id === entry.extra.enrollId ? { ...e, units: [...e.units, entry.item] } : e);
      }
      break;
    }
    case "resource": next.resources = [...next.resources, entry.item]; break;
    case "datesheet": next.datesheets = [...next.datesheets, entry.item]; break;
    case "announcement": next.announcements = [entry.item, ...next.announcements]; break;
    case "studyLog": next.studyLogs = [...next.studyLogs, entry.item]; break;
    default: break;
  }
  return logActivity(next, `Restored: ${entry.label}`);
}

/** Build a recommended self-study week for the 7 days before an exam date,
 *  prioritizing whichever courses have the lowest syllabus completion. */
function generateRecommendedBlocks(datesheet, courses, existingBlocks) {
  if (!datesheet?.date) return [];
  const examDate = new Date(datesheet.date);
  const pool = (datesheet.courseId ? courses.filter((c) => c.id === datesheet.courseId) : courses.filter((c) => c.category === "Core" || c.category.startsWith("Elective")));
  const ranked = [...pool].sort((a, b) => {
    const pa = a.units.length ? a.units.filter((x) => x.done).length / a.units.length : 0;
    const pb = b.units.length ? b.units.filter((x) => x.done).length / b.units.length : 0;
    return pa - pb;
  });
  if (ranked.length === 0) return [];
  // Candidate 1-hour start slots to try, in order of preference, so overlapping
  // revision weeks (e.g. two exams close together) don't all pile onto 19:00.
  const SLOTS = ["19:00", "20:00", "17:00", "21:00", "16:00", "18:00", "15:00", "22:00"];
  const byDay = {};
  DAYS.forEach((d) => { byDay[d] = existingBlocks.filter((b) => b.day === d); });

  const blocks = [];
  for (let i = 7; i >= 1; i--) {
    const day = new Date(examDate);
    day.setDate(examDate.getDate() - i);
    if (day < new Date(new Date().toDateString())) continue; // don't schedule in the past
    const dayName = DAYS[(day.getDay() + 6) % 7];
    const course = ranked[(7 - i) % ranked.length];
    const dayBlocks = byDay[dayName] || [];

    let start = null, end = null;
    for (const s of SLOTS) {
      const sMin = toMin(s), eMin = sMin + 60;
      const clash = dayBlocks.some((b) => {
        const bs = toMin(b.start), be = toMin(b.end);
        return sMin < be && eMin > bs; // any overlap, regardless of block kind or source exam
      });
      if (!clash) { start = s; end = minToTime(eMin); break; }
    }
    if (!start) continue; // every slot that day is taken — skip rather than double-book

    const newBlock = {
      id: uid(), day: dayName, start, end,
      label: i === 1 ? `${course.code} — full revision` : `${course.code} revision`,
      courseId: course.id, color: course.color, kind: "recommended",
      sourceId: datesheet.id, examDate: datesheet.date,
    };
    blocks.push(newBlock);
    byDay[dayName] = [...dayBlocks, newBlock]; // account for it in later iterations too
  }
  return blocks;
}

export { logActivity, moveToTrash, restoreFromTrash, generateRecommendedBlocks };
