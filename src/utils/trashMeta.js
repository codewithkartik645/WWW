import {
  CalendarDays, BookOpen, FileText, ListChecks, CalendarClock, Users2,
  FolderOpen, Upload, Megaphone, TrendingUp, GraduationCap,
} from "lucide-react";

// Shared by TrashView (the admin-wide "Restore Deleted Items" page) and
// AdminStudentDetailView (a single student's own trash section) — both render
// the same kinds of deleted records, so the label/icon per record type lives
// in one place instead of being duplicated (or, as happened before, defined
// in only one of the two files while the other silently relied on it).
const TRASH_TYPE_META = {
  calendarEvent: { label: "Calendar event", icon: CalendarDays },
  course: { label: "Subject", icon: BookOpen },
  courseUnit: { label: "Unit", icon: BookOpen },
  courseSyllabus: { label: "Syllabus", icon: FileText },
  task: { label: "Task", icon: ListChecks },
  plannerBlock: { label: "Timetable / planner block", icon: CalendarClock },
  coCurricularCatalog: { label: "Co-curricular opportunity", icon: Users2 },
  enrollment: { label: "Enrollment", icon: Users2 },
  enrollmentModule: { label: "Module", icon: Users2 },
  resource: { label: "Resource", icon: FolderOpen },
  datesheet: { label: "Datesheet", icon: Upload },
  announcement: { label: "Announcement", icon: Megaphone },
  studyLog: { label: "Study log entry", icon: TrendingUp },
  studentAccount: { label: "Account", icon: GraduationCap },
};

export { TRASH_TYPE_META };
