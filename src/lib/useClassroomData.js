import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Replaces the old localStorage/window.storage persistence. Now:
//  - the shared classroom fields (courses, tasks, announcements, ...) live in one
//    row of the `classroom` table and sync live to every connected browser via
//    Supabase Realtime — no more "student's bell doesn't update" class of bug,
//    because there's nothing to poll: the server pushes the change.
//  - `profiles` is built from the real `profiles` table (one row per real user)
//    instead of a hardcoded admin/student pair.
//  - `session` is the signed-in user's id (a UUID), matching what the rest of
//    the app already expects at `data.session`.
export function useClassroomData(authProfile, userId) {
  const [shared, setShared] = useState(null); // the JSONB blob from `classroom`
  const [profiles, setProfiles] = useState({}); // { [userId]: {name, role, departmentId, photo} }
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(null); // non-null when the last write to the server failed
  const writeTimer = useRef(null);
  const retryTimer = useRef(null);
  const latestShared = useRef(null);
  const pendingRef = useRef(false); // true whenever there's a scheduled or in-flight write not yet confirmed saved

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) return;
    const dict = {};
    for (const p of data) {
      dict[p.id] = { name: p.name, role: p.role, departmentId: p.department_id, photo: p.photo_url, email: p.email, active: p.active };
    }
    setProfiles(dict);
  }, []);

  // Actually performs the write and reports whether it succeeded — a previous version of this
  // function fired the request and never checked the result, so a failed save (dropped
  // connection, an RLS rule rejecting it, a transient Supabase hiccup, ...) looked identical to a
  // successful one: the change stayed visible locally until the next reload or the next Realtime
  // update quietly replaced it with the still-old server copy. That's the "I added something and
  // it went missing" bug. Now a failure surfaces via `saveError` and retries automatically.
  const persist = useCallback((payload, attempt = 0) => {
    supabase.from("classroom").update({ data: payload, updated_at: new Date().toISOString() }).eq("id", 1)
      .then(({ error }) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to save classroom data:", error.message);
          setSaveError(error.message);
          // Automatic retry with backoff, up to 3 tries, as long as this is still the latest
          // pending write (a newer edit superseding it will have its own retry chain).
          if (attempt < 3 && latestShared.current === payload) {
            if (retryTimer.current) clearTimeout(retryTimer.current);
            retryTimer.current = setTimeout(() => persist(payload, attempt + 1), 1500 * (attempt + 1));
          } else {
            pendingRef.current = false;
          }
        } else {
          setSaveError(null);
          pendingRef.current = false;
        }
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("classroom").select("data").eq("id", 1).single();
      if (!cancelled && !error) {
        latestShared.current = data.data;
        setShared(data.data);
      }
      await loadProfiles();
      if (!cancelled) setLoaded(true);
    })();

    // Live updates: any other device's write shows up here automatically.
    const channel = supabase
      .channel("classroom-sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "classroom", filter: "id=eq.1" }, (payload) => {
        latestShared.current = payload.new.data;
        setShared(payload.new.data);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        loadProfiles();
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, [loadProfiles]);

  // setData mirrors the old API: setData(updaterFnOrValue) where the value/updater
  // operates on the FULL `data` object (shared fields + profiles + session). We only
  // persist the shared fields back to the classroom row — profiles/session are
  // derived elsewhere and read-only from this hook's point of view.
  const setData = useCallback((updater) => {
    setShared((prevShared) => {
      const prevFull = { ...prevShared, profiles, session: userId };
      const nextFull = typeof updater === "function" ? updater(prevFull) : updater;
      // eslint-disable-next-line no-unused-vars
      const { profiles: _p, session: _s, ...nextShared } = nextFull;
      latestShared.current = nextShared;

      // Debounce writes so rapid edits (typing, dragging) don't spam the DB.
      pendingRef.current = true;
      if (writeTimer.current) clearTimeout(writeTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      writeTimer.current = setTimeout(() => persist(nextShared), 400);

      return nextShared;
    });
  }, [profiles, userId, persist]);

  // Best-effort: if the tab is closed/refreshed while a write is still pending (within the 400ms
  // debounce window, or mid-retry after a failure), warn instead of losing the change silently.
  useEffect(() => {
    const handler = (e) => {
      if (pendingRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const retryNow = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (latestShared.current) persist(latestShared.current);
  }, [persist]);

  const data = loaded && shared ? { ...shared, profiles, session: userId } : null;
  return { data, setData, loaded, saveError, retryNow };
}
