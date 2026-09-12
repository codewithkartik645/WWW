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
      options: {
        data: { name }, // read by the handle_new_user() trigger
        // Without this, Supabase falls back to the project's Auth "Site URL" for the
        // confirmation-email link — if that's unset or points somewhere else, clicking
        // "Confirm your email" lands on a blank/generic Supabase page instead of back in
        // this app. Sending window.location.origin here fixes it FROM THE CODE SIDE, but
        // it only works if that same origin is also added under Authentication → URL
        // Configuration → Redirect URLs in the Supabase dashboard — Supabase silently
        // ignores emailRedirectTo values that aren't allow-listed there.
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    // Defense in depth: even if the Supabase project's "Confirm email" setting is ever off
    // or misconfigured, don't let an unverified account into the app. Supabase leaves
    // email_confirmed_at null until the confirmation link is clicked.
    if (!data.user?.email_confirmed_at && !data.user?.confirmed_at) {
      await supabase.auth.signOut();
      return { error: { message: "Please confirm your email before logging in — check your inbox (and spam folder) for the confirmation link." } };
    }
    return { error: null };
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
