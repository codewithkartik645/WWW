// A minimal in-memory stand-in for @supabase/supabase-js, covering exactly the calls
// App.jsx/useAuth/useClassroomData/profileAdmin/uploadAttachment actually make.
import { vi } from "vitest";

export function createMockSupabase() {
  const state = {
    users: new Map(), // id -> { email, password }
    profiles: new Map(), // id -> profile row
    classroom: { data: {} },
    currentUserId: null,
    authListeners: [],
  };

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

  function makeQuery(table) {
    return {
      select: (_cols) => ({
        eq: (col, val) => ({
          single: async () => {
            if (table === "profiles") {
              const row = state.profiles.get(val);
              return row ? { data: row, error: null } : { data: null, error: { message: "not found" } };
            }
            if (table === "classroom") {
              return { data: { data: state.classroom.data }, error: null };
            }
          },
        }),
        // profiles.select("*") with no .eq() -> all rows
        then: (resolve) => resolve({ data: [...state.profiles.values()], error: null }),
      }),
      update: (patch) => ({
        eq: async (col, val) => {
          if (table === "profiles") {
            const row = state.profiles.get(val);
            if (!row) return { error: { message: "not found" } };
            Object.assign(row, patch);
            return { error: null };
          }
          if (table === "classroom") {
            state.classroom.data = patch.data;
            return { error: null };
          }
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
    from: (table) => makeQuery(table),
    channel: () => ({
      on: function () { return this; },
      subscribe: function () { return this; },
    }),
    removeChannel: () => {},
    storage,
  };

  return { supabase, state };
}
