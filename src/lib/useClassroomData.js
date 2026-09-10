import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

// ============================================================================
// Table map: one entry per array the app keeps in `data`. Each entry knows how
// to turn one in-memory JS object into the row Supabase expects (toRow) and
// back (fromRow). Most tables just wrap the whole object in a jsonb `item`
// column alongside whatever columns RLS needs to check (department_id,
// owner_id, kind) — see supabase/schema.sql for the full policy set.
// ============================================================================
const DEPT_TABLES = {
  courses: { table: "courses", toRow: (item, deptFallback) => ({ id: item.id, department_id: item.departmentId || deptFallback, item }), fromRow: (r) => r.item },
  calendarEvents: { table: "calendar_events", toRow: (item) => ({ id: item.id, department_id: item.departmentId || null, item }), fromRow: (r) => r.item },
  datesheets: { table: "datesheets", toRow: (item, deptFallback) => ({ id: item.id, department_id: item.departmentId || deptFallback, item }), fromRow: (r) => r.item },
  plannerBlocks: { table: "planner_blocks", toRow: (item) => ({ id: item.id, kind: item.kind || "class", department_id: item.departmentId || null, owner_id: item.ownerKey || null, item }), fromRow: (r) => r.item },
  coCurricularCatalog: { table: "co_curricular_catalog", toRow: (item) => ({ id: item.id, department_id: item.departmentId || null, item }), fromRow: (r) => r.item },
  resources: { table: "resources", toRow: (item) => ({ id: item.id, department_id: item.departmentId || null, item }), fromRow: (r) => r.item },
  announcements: { table: "announcements", toRow: (item) => ({ id: item.id, department_id: item.departmentId || null, item }), fromRow: (r) => r.item },
};
const OWNER_TABLES = {
  tasks: { table: "tasks", toRow: (item) => ({ id: item.id, owner_id: item.ownerKey || null, item }), fromRow: (r) => r.item },
  studyLogs: { table: "study_logs", toRow: (item) => ({ id: item.id, owner_id: item.ownerKey, item }), fromRow: (r) => r.item },
  enrollments: { table: "enrollments", toRow: (item) => ({ id: item.id, owner_id: item.ownerKey, item }), fromRow: (r) => r.item },
  // Per-student unit checkoffs / elective picks — students cannot write the shared `courses` table.
  courseProgress: { table: "course_progress", toRow: (item) => ({ id: item.id, owner_id: item.ownerKey, item }), fromRow: (r) => r.item },
};
const DEPARTMENTS_TABLE = { table: "departments", toRow: (d) => ({ id: d.id, name: d.name, active: d.active !== false }), fromRow: (r) => ({ id: r.id, name: r.name, active: r.active }) };
const ACTIVITY_TABLE = { table: "activity_log", toRow: (a) => ({ id: a.id, by: a.by, ts: a.ts, text: a.text }), fromRow: (r) => ({ id: r.id, by: r.by, ts: r.ts, text: r.text }) };
const TRASH_TABLE = {
  table: "trash_entries",
  toRow: (t) => ({ id: t.id, type: t.type, deleted_by: t.deletedBy || null, item: t.item ?? {}, extra: t.extra ?? {}, label: t.label ?? null, deleted_at: t.deletedAt || new Date().toISOString() }),
  fromRow: (r) => ({ id: r.id, type: r.type, item: r.item, extra: r.extra, label: r.label, deletedAt: r.deleted_at, deletedBy: r.deleted_by }),
};

function isIgnorableWriteError(error) {
  const msg = (error?.message || "").toLowerCase();
  const code = error?.code || error?.details || "";
  // Duplicate insert on a retry of an append-only table — the row already landed.
  return error?.code === "23505" || String(code).includes("23505") || msg.includes("duplicate key");
}

// Diff two id-keyed arrays: which items are brand new or changed, which disappeared.
function diffArrays(oldArr = [], newArr = []) {
  const oldMap = new Map(oldArr.map((x) => [x.id, x]));
  const newMap = new Map(newArr.map((x) => [x.id, x]));
  const upserts = [];
  for (const [id, item] of newMap) {
    const prev = oldMap.get(id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) upserts.push(item);
  }
  const removedIds = [...oldMap.keys()].filter((id) => !newMap.has(id));
  return { upserts, removedIds };
}

const EMPTY_SHARED = {
  departments: [], courses: [], calendarEvents: [], datesheets: [], plannerBlocks: [],
  tasks: [], studyLogs: [], coCurricularCatalog: [], enrollments: [], courseProgress: [], resources: [],
  announcements: [], activityLog: [], trash: [], autoMode: true, semester: "",
  lastSeenAnnouncements: {}, plannerHourRanges: {},
};

// Replaces the old single-JSONB-blob persistence. `data` still looks exactly like it did
// before (one object with courses/calendarEvents/tasks/... arrays) — every view still calls
// setData(updater) exactly as before — but underneath, each array now lives in its own real
// Supabase table with a Row Level Security policy the DATABASE itself enforces (see
// supabase/schema.sql). A co-admin's credentials genuinely cannot read or write another
// department's rows, no matter how the request is made — not just because the UI hides it.
export function useClassroomData(authProfile, userId) {
  const [shared, setShared] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const latestShared = useRef(null);
  const writeTimers = useRef({}); // one debounce timer per table, so editing courses doesn't delay saving tasks
  const pendingCount = useRef(0); // how many table-writes are scheduled/in-flight, for the unload guard
  const failedWrites = useRef([]); // last failed payload per table, so Retry re-saves instead of reloading (reload would drop the unsaved local change)
  const lastPersisted = useRef(null);
  // Resolves once the most recent departments write has landed. courses/calendar_events/
  // datesheets/planner_blocks/co_curricular_catalog/resources/announcements all reference a
  // department_id via a foreign key — writing one of those before its department exists in the
  // database fails with a foreign-key violation. This is most likely to bite on first-run
  // seeding, where departments AND courses are created in the very same setData() call.
  const departmentsSettled = useRef(Promise.resolve());

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) return;
    const dict = {};
    for (const p of data) dict[p.id] = { name: p.name, role: p.role, departmentId: p.department_id, photo: p.photo_url, email: p.email, active: p.active };
    setProfiles(dict);
  }, []);

  // One-time full fetch of every table, on mount / login.
  const loadAll = useCallback(async () => {
    const [depts, settingsRes, prefsRes, ...rest] = await Promise.all([
      supabase.from(DEPARTMENTS_TABLE.table).select("*"),
      supabase.from("classroom_settings").select("*").eq("id", 1).single(),
      supabase.from("user_prefs").select("*"),
      ...Object.values({ ...DEPT_TABLES, ...OWNER_TABLES }).map((cfg) => supabase.from(cfg.table).select("*")),
      supabase.from(ACTIVITY_TABLE.table).select("*").order("ts", { ascending: false }),
      supabase.from(TRASH_TABLE.table).select("*").order("deleted_at", { ascending: false }),
    ]);

    const keys = [...Object.keys(DEPT_TABLES), ...Object.keys(OWNER_TABLES)];
    const next = { ...EMPTY_SHARED };
    next.departments = (depts.data || []).map(DEPARTMENTS_TABLE.fromRow);
    keys.forEach((key, i) => {
      const cfg = ({ ...DEPT_TABLES, ...OWNER_TABLES })[key];
      next[key] = (rest[i]?.data || []).map(cfg.fromRow).filter(Boolean);
    });
    next.activityLog = (rest[keys.length]?.data || []).map(ACTIVITY_TABLE.fromRow);
    next.trash = (rest[keys.length + 1]?.data || []).map(TRASH_TABLE.fromRow);
    if (settingsRes.data) { next.autoMode = settingsRes.data.auto_mode; next.semester = settingsRes.data.semester; }
    const lastSeen = {}, hourRanges = {};
    for (const row of prefsRes.data || []) {
      lastSeen[row.user_id] = row.last_seen_announcements;
      hourRanges[row.user_id] = { start: row.planner_hour_start, end: row.planner_hour_end };
    }
    next.lastSeenAnnouncements = lastSeen;
    next.plannerHourRanges = hourRanges;

    latestShared.current = next;
    lastPersisted.current = next;
    failedWrites.current = [];
    setShared(next);
  }, []);

  // Persist one table's add/update/remove diff, with a small retry-with-backoff on failure —
  // same "don't lose a change silently" guarantee the old single-blob version had, just scoped
  // per table now instead of per whole-classroom write.
  const writeTable = useCallback((key, cfg, upserts, removedIds, attempt = 0) => {
    const run = async () => {
      // Any table other than departments itself must wait for the department rows it
      // references to have actually landed first — see the comment on departmentsSettled above.
      if (key !== "departments" && DEPT_TABLES[key]) await departmentsSettled.current;
      const jobs = [];
      // activity_log is append-only (no UPDATE/DELETE RLS). The in-memory log is sliced to
      // 150 entries, which would otherwise try to DELETE old rows and fail with a save error.
      const appendOnly = key === "activityLog";
      if (upserts.length) {
        jobs.push(appendOnly
          ? supabase.from(cfg.table).insert(upserts)
          : supabase.from(cfg.table).upsert(upserts));
      }
      if (removedIds.length && !appendOnly) jobs.push(supabase.from(cfg.table).delete().in("id", removedIds));
      if (jobs.length === 0) return;
      pendingCount.current += 1;
      const results = await Promise.all(jobs);
      pendingCount.current -= 1;
      const failed = results.find((r) => r?.error && !isIgnorableWriteError(r.error));
      if (failed) {
        // eslint-disable-next-line no-console
        console.error(`Failed to save ${cfg.table}:`, failed.error.message);
        failedWrites.current = failedWrites.current.filter((w) => w.key !== key);
        failedWrites.current.push({ key, cfg, upserts, removedIds });
        setSaveError(failed.error.message);
        if (attempt < 3) setTimeout(() => writeTable(key, cfg, upserts, removedIds, attempt + 1), 1500 * (attempt + 1));
      } else {
        failedWrites.current = failedWrites.current.filter((w) => w.key !== key);
        if (lastPersisted.current && latestShared.current) {
          lastPersisted.current = { ...lastPersisted.current, [key]: latestShared.current[key] };
        }
        if (failedWrites.current.length === 0) setSaveError(null);
      }
    };
    const promise = run();
    if (key === "departments") departmentsSettled.current = promise.catch(() => {}); // a failed dept write shouldn't wedge every dependent table forever
    return promise;
  }, []);

  const scheduleWrite = useCallback((key, cfg, oldArr, newArr, deptFallback) => {
    if (writeTimers.current[key]) clearTimeout(writeTimers.current[key]);
    pendingCount.current += 1;
    writeTimers.current[key] = setTimeout(() => {
      pendingCount.current -= 1;
      const { upserts, removedIds } = diffArrays(oldArr, newArr);
      if (upserts.length === 0 && removedIds.length === 0) return;
      writeTable(key, cfg, upserts.map((item) => cfg.toRow(item, deptFallback)), removedIds);
    }, 400);
  }, [writeTable]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadAll();
      await loadProfiles();
      if (!cancelled) setLoaded(true);
    })();

    // Live updates: re-fetch the affected table on any change from another device/user. A full
    // per-table refetch (rather than trying to patch the single changed row into local state) is
    // simpler and, since it only affects one table's worth of rows, still fast.
    const refetchOne = async (key, cfg) => {
      const { data } = await supabase.from(cfg.table).select("*");
      setShared((prev) => {
        if (!prev) return prev;
        const next = { ...prev, [key]: (data || []).map(cfg.fromRow) };
        latestShared.current = next;
        return next;
      });
    };
    const channel = supabase.channel("classroom-sync");
    Object.entries({ ...DEPT_TABLES, ...OWNER_TABLES, departments: DEPARTMENTS_TABLE, activityLog: ACTIVITY_TABLE, trash: TRASH_TABLE }).forEach(([key, cfg]) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: cfg.table }, () => refetchOne(key, cfg));
    });
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "classroom_settings" }, (payload) => {
      setShared((prev) => prev ? { ...prev, autoMode: payload.new.auto_mode, semester: payload.new.semester } : prev);
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "user_prefs" }, async () => {
      const { data } = await supabase.from("user_prefs").select("*");
      const lastSeen = {}, hourRanges = {};
      for (const row of data || []) { lastSeen[row.user_id] = row.last_seen_announcements; hourRanges[row.user_id] = { start: row.planner_hour_start, end: row.planner_hour_end }; }
      setShared((prev) => prev ? { ...prev, lastSeenAnnouncements: lastSeen, plannerHourRanges: hourRanges } : prev);
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadProfiles());
    channel.subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      Object.values(writeTimers.current).forEach(clearTimeout);
    };
  }, [loadAll, loadProfiles]);

  // setData mirrors the old API exactly: setData(updaterFnOrValue) operating on the FULL data
  // object (shared fields + profiles + session). Every view calls this the same way it always
  // has — the diffing happens transparently underneath, per table, per key that actually changed.
  const setData = useCallback((updater) => {
    setShared((prevShared) => {
      const prevFull = { ...prevShared, profiles, session: userId };
      const nextFull = typeof updater === "function" ? updater(prevFull) : updater;
      // eslint-disable-next-line no-unused-vars
      const { profiles: _p, session: _s, ...nextShared } = nextFull;
      latestShared.current = nextShared;

      const deptFallback = nextShared.departments?.[0]?.id;
      // Departments go first, and immediately (no debounce) — every other department-scoped
      // table's write waits on departmentsSettled before it actually hits the network, but that
      // only works if this write is already in flight by the time their timers fire.
      if (prevShared?.departments !== nextShared.departments) {
        const { upserts, removedIds } = diffArrays(prevShared?.departments || [], nextShared.departments || []);
        if (upserts.length || removedIds.length) {
          pendingCount.current += 1;
          writeTable("departments", DEPARTMENTS_TABLE, upserts.map((d) => DEPARTMENTS_TABLE.toRow(d)), removedIds).finally(() => { pendingCount.current -= 1; });
        }
      }
      for (const [key, cfg] of Object.entries({ ...DEPT_TABLES, ...OWNER_TABLES, activityLog: ACTIVITY_TABLE, trash: TRASH_TABLE })) {
        if (prevShared?.[key] !== nextShared[key]) scheduleWrite(key, cfg, prevShared?.[key] || [], nextShared[key] || [], deptFallback);
      }
      if (prevShared?.autoMode !== nextShared.autoMode || prevShared?.semester !== nextShared.semester) {
        if (writeTimers.current.__settings) clearTimeout(writeTimers.current.__settings);
        pendingCount.current += 1;
        writeTimers.current.__settings = setTimeout(() => {
          pendingCount.current -= 1;
          pendingCount.current += 1;
          supabase.from("classroom_settings").update({ auto_mode: nextShared.autoMode, semester: nextShared.semester }).eq("id", 1)
            .then(({ error }) => { pendingCount.current -= 1; if (error) setSaveError(error.message); });
        }, 400);
      }
      // Per-user prefs: only ever write the CURRENT user's own row (matches the RLS policy —
      // "manage own prefs" — and there's never a legitimate reason to write someone else's).
      const prevMine = prevShared?.lastSeenAnnouncements?.[userId];
      const nextMine = nextShared.lastSeenAnnouncements?.[userId];
      const prevHours = prevShared?.plannerHourRanges?.[userId];
      const nextHours = nextShared.plannerHourRanges?.[userId];
      if (prevMine !== nextMine || JSON.stringify(prevHours) !== JSON.stringify(nextHours)) {
        if (writeTimers.current.__prefs) clearTimeout(writeTimers.current.__prefs);
        pendingCount.current += 1;
        writeTimers.current.__prefs = setTimeout(() => {
          pendingCount.current -= 1;
          pendingCount.current += 1;
          supabase.from("user_prefs").upsert({
            user_id: userId,
            last_seen_announcements: nextMine || 0,
            planner_hour_start: nextHours?.start ?? 6,
            planner_hour_end: nextHours?.end ?? 23,
          }).then(({ error }) => { pendingCount.current -= 1; if (error) setSaveError(error.message); });
        }, 400);
      }

      return nextShared;
    });
  }, [profiles, userId, scheduleWrite, writeTable]);

  useEffect(() => {
    const handler = (e) => {
      if (pendingCount.current > 0) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Re-attempt every currently-failed write. Individual tables already retry themselves
  // automatically; this is for the "Retry" button so a person isn't just waiting on a timer.
  const retryNow = useCallback(() => {
    const queued = [...failedWrites.current];
    setSaveError(null);
    if (queued.length) {
      queued.forEach((w) => writeTable(w.key, w.cfg, w.upserts, w.removedIds));
      return;
    }
    // No remembered payload (e.g. settings/prefs). Re-diff local state against last successful load.
    const prev = lastPersisted.current;
    const next = latestShared.current;
    if (!prev || !next) { loadAll(); return; }
    const deptFallback = next.departments?.[0]?.id;
    const { upserts: deptUps, removedIds: deptRem } = diffArrays(prev.departments || [], next.departments || []);
    if (deptUps.length || deptRem.length) writeTable("departments", DEPARTMENTS_TABLE, deptUps.map((d) => DEPARTMENTS_TABLE.toRow(d)), deptRem);
    for (const [key, cfg] of Object.entries({ ...DEPT_TABLES, ...OWNER_TABLES, activityLog: ACTIVITY_TABLE, trash: TRASH_TABLE })) {
      const { upserts, removedIds } = diffArrays(prev[key] || [], next[key] || []);
      if (upserts.length || removedIds.length) writeTable(key, cfg, upserts.map((item) => cfg.toRow(item, deptFallback)), removedIds);
    }
  }, [loadAll, writeTable]);

  const data = loaded && shared ? { ...shared, profiles, session: userId } : null;
  return { data, setData, loaded, saveError, retryNow, refreshProfiles: loadProfiles };
}
