import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Replaces the old fixed "admin"/"student" credential check with real Supabase Auth.
// `profile` is this user's row from the `profiles` table (name, role, department, photo).
export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = logged out
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    let cancelled = false;
    setLoadingProfile(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) {
          if (data.active === false) {
            // Deactivated by an admin — sign them out immediately rather than let a
            // disabled account keep using a still-valid browser session.
            supabase.auth.signOut();
            setProfile(null);
          } else {
            setProfile(data);
          }
        }
        setLoadingProfile(false);
      });
    return () => { cancelled = true; };
  }, [session]);

  const signUp = useCallback(async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } }, // read by the handle_new_user() trigger
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (data) setProfile(data);
  }, [session]);

  return {
    session,
    loaded: session !== undefined && !loadingProfile,
    profile,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };
}
