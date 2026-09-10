// A minimal in-memory stand-in for @supabase/supabase-js, covering exactly the calls
// App.jsx/useAuth/useClassroomData/profileAdmin/uploadAttachment actually make.
// Mirrors the real per-table schema (supabase/schema.sql) — one Map per table — rather
// than the old single-blob `classroom` row, so tests exercise the same data shape
// production actually uses.

const TABLES = [
  "departments", "courses", "calendar_events", "datesheets", "planner_blocks",
  "tasks", "study_logs", "co_curricular_catalog", "enrollments", "resources",
  "announcements", "activity_log", "trash_entries", "user_prefs",
];

export function createMockSupabase() {
  const state = {
    users: new Map(), // id -> { email, password }
    profiles: new Map(), // id -> profile row
    tables: Object.fromEntries(TABLES.map((t) => [t, new Map()])), // table -> Map<id, row>
    settings: { id: 1, semester: "", auto_mode: true },
    currentUserId: null,
    authListeners: [],
  };
  // Convenience used by tests: read every row of a table as a plain array.
  state.rows = (table) => [...state.tables[table].values()];

  function currentSession() {
    if (!state.currentUserId) return null;
    return { user: { id: state.currentUserId, email: state.users.get(state.currentUserId)?.email } };
  }
  function fireAuthChange() {
    const sess = currentSession();
    state.authListeners.forEach((cb) => cb("SIGNED_IN", sess));
  }

  const authorizedError = () => ({ message: "Not authenticated" });

  const auth = {
    getSession: async () => ({ data: { session: currentSession() } }),
    onAuthStateChange: (cb) => {
      state.authListeners.push(cb);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signUp: async ({ email, password, options }) => {
      const id = `user_${state.users.size + 1}`;
      state.users.set(id, { email, password });
      state.profiles.set(id, {
        id, email, role: "student",
        name: options?.data?.name || email.split("@")[0],
        department_id: null, photo_url: null, active: true,
      });
      // In real Supabase, signUp doesn't auto-sign-in if email confirmation is on; our mock
      // signs in immediately for simplicity, matching "confirmations off" (fine for a school tool).
      state.currentUserId = id;
      fireAuthChange();
      return { error: null };
    },
    signInWithPassword: async ({ email, password }) => {
      const entry = [...state.users.entries()].find(([, u]) => u.email === email);
      if (!entry || entry[1].password !== password) return { error: { message: "Invalid login credentials" } };
      state.currentUserId = entry[0];
      fireAuthChange();
      return { error: null };
    },
    signOut: async () => { state.currentUserId = null; fireAuthChange(); return { error: null }; },
    updateUser: async ({ password }) => {
      if (!state.currentUserId) return { error: authorizedError() };
      state.users.get(state.currentUserId).password = password;
      return { error: null };
    },
    resetPasswordForEmail: async () => ({ error: null }),
  };

  // A tiny thenable query builder covering exactly the chains the app uses:
  //   .select("*")                          -> array
  //   .select("*").eq(col, val)              -> array (or object via .single())
  //   .select("*").eq(col, val).single()     -> one row
  //   .select("*").order(col, {ascending})   -> array
  //   .insert(rows) / .upsert(rows)          -> writes rows by id
  //   .update(patch).eq(col, val)            -> patches matching rows
  //   .delete().in(col, vals)                -> removes matching rows
  // Mirrors the "not null references departments(id)" / nullable-FK columns in schema.sql —
  // so a bug like writing a course before its department exists actually fails the test the
  // same way real Postgres would reject it, instead of silently succeeding in-memory.
  function checkForeignKeys(table, rows, state) {
    const DEPT_FK_TABLES = new Set(["courses", "calendar_events", "datesheets", "planner_blocks", "co_curricular_catalog", "resources", "announcements"]);
    if (!DEPT_FK_TABLES.has(table)) return null;
    for (const r of rows) {
      if (r.department_id != null && !state.tables.departments.has(r.department_id)) {
        return { message: `insert or update on table "${table}" violates foreign key constraint — department "${r.department_id}" does not exist` };
      }
    }
    return null;
  }

  function selectResultFor(table, rows, state) {
  // Simulate the real RLS policies (see supabase/schema.sql) so tests can actually verify
  // cross-department isolation, not just assume the SQL policy text is correct: a co-admin's
  // SELECT here is filtered exactly like Postgres would filter it for their department_id.
  const DEPT_SCOPED = ["courses", "calendar_events", "datesheets", "co_curricular_catalog", "resources", "announcements"];
  if (DEPT_SCOPED.includes(table) && state.currentUserId) {
    const me = state.profiles.get(state.currentUserId);
    if (me && me.role !== "admin") {
      rows = rows.filter((r) => r.department_id == null || r.department_id === me.department_id);
    }
  }
  if (table === "planner_blocks" && state.currentUserId) {
    const me = state.profiles.get(state.currentUserId);
    if (me && me.role !== "admin") {
      rows = rows.filter((r) => (r.kind === "self" ? r.owner_id === state.currentUserId : (r.department_id == null || r.department_id === me.department_id)));
    }
  }
  return rows;
}

function makeQuery(table, state) {
    const map = state.tables[table];

    function selectResult(rows) {
      return {
        eq: (col, val) => selectResult(rows.filter((r) => r[col] === val)),
        order: () => selectResult(rows), // order doesn't matter for test assertions
        single: async () => (rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "not found" } }),
        then: (resolve) => resolve({ data: rows, error: null }),
      };
    }

    return {
      select: () => {
        if (table === "profiles") return selectResult([...state.profiles.values()]);
        if (table === "classroom_settings") return selectResult([state.settings]);
        const rows = map ? [...map.values()] : [];
        return selectResult(selectResultFor(table, rows, state));
      },
      insert: async (rows) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        const fkError = checkForeignKeys(table, arr, state);
        if (fkError) return { error: fkError };
        for (const r of arr) map.set(r.id, r);
        return { error: null };
      },
      upsert: async (rows) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        const fkError = checkForeignKeys(table, arr, state);
        if (fkError) return { error: fkError };
        for (const r of arr) {
          if (table === "user_prefs") map.set(r.user_id, r);
          else map.set(r.id, { ...map.get(r.id), ...r });
        }
        return { error: null };
      },
      update: (patch) => ({
        eq: async (col, val) => {
          if (table === "profiles") {
            const row = state.profiles.get(val);
            if (!row) return { error: { message: "not found" } };
            Object.assign(row, patch);
            return { error: null };
          }
          if (table === "classroom_settings") {
            Object.assign(state.settings, patch);
            return { error: null };
          }
          for (const row of map.values()) if (row[col] === val) Object.assign(row, patch);
          return { error: null };
        },
      }),
      delete: () => ({
        in: async (col, vals) => {
          for (const [id, row] of [...map.entries()]) if (vals.includes(row[col])) map.delete(id);
          return { error: null };
        },
        eq: async (col, val) => {
          for (const [id, row] of [...map.entries()]) if (row[col] === val) map.delete(id);
          return { error: null };
        },
      }),
    };
  }

  const storage = {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://fake-storage.test/file.pdf" } }),
      remove: async () => ({ error: null }),
    }),
  };

  const supabase = {
    auth,
    from: (table) => makeQuery(table, state),
    channel: () => ({
      on: function () { return this; },
      subscribe: function () { return this; },
    }),
    removeChannel: () => {},
    storage,
  };

  return { supabase, state };
}
