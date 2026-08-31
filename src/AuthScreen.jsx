import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { useAuth } from "./lib/useAuth";
import { supabase } from "./lib/supabaseClient";

const C = { purple: "#7C3AED", dark: "#0F172A" };

// Replaces the old Landing ("Continue as Admin/Student") + Login (fixed ID/password) screens.
// Real accounts now: sign up with email+password, land as a "student" by default. The very
// first person (the school's actual admin) promotes themselves to "admin" once, via one SQL
// command in the Supabase dashboard — see supabase/schema.sql for instructions. From then on,
// admins/co-admins promote other signed-up users to co-admin/student roles from inside the app.
export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(error.message);
      } else if (mode === "signup") {
        if (!name.trim()) { setError("Enter your name."); setBusy(false); return; }
        const { error } = await signUp(email.trim(), password, name.trim());
        if (error) setError(error.message);
        else setNotice("Check your email to confirm your account, then sign in.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) setError(error.message);
        else setNotice("Password reset link sent — check your email.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ fontFamily: "Inter, sans-serif", background: C.dark }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ background: C.purple }}><GraduationCap size={20} /></div>
          <span className="font-semibold text-lg text-white">StudyTrack</span>
        </div>
        <div className="rounded-2xl p-6" style={{ background: "#1E293B" }}>
          <div className="text-sm font-semibold mb-4 text-white">
            {mode === "signin" ? "Log in" : mode === "signup" ? "Create an account" : "Reset password"}
          </div>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <>
                <div className="text-xs mb-1 text-[#94A3B8]">Your name</div>
                <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg px-3 py-2 text-sm w-full mb-3 border-0 bg-[#0F172A] text-white" autoFocus />
              </>
            )}
            <div className="text-xs mb-1 text-[#94A3B8]">Email</div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg px-3 py-2 text-sm w-full mb-3 border-0 bg-[#0F172A] text-white" />
            {mode !== "forgot" && (
              <>
                <div className="text-xs mb-1 text-[#94A3B8]">Password</div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-lg px-3 py-2 text-sm w-full mb-3 border-0 bg-[#0F172A] text-white" />
              </>
            )}
            {error && <div className="text-xs mb-3 text-[#F87171]">{error}</div>}
            {notice && <div className="text-xs mb-3 text-[#34D399]">{notice}</div>}
            <button type="submit" disabled={busy} className="w-full text-sm text-white px-3 py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: C.purple }}>
              {busy ? "Please wait…" : mode === "signin" ? "Log in" : mode === "signup" ? "Sign up" : "Send reset link"}
            </button>
          </form>
          <div className="flex items-center justify-between mt-4 text-xs">
            {mode === "signin" && (
              <>
                <button onClick={() => { setMode("signup"); setError(""); setNotice(""); }} className="text-[#94A3B8] hover:text-white">Need an account? Sign up</button>
                <button onClick={() => { setMode("forgot"); setError(""); setNotice(""); }} className="text-[#94A3B8] hover:text-white">Forgot password?</button>
              </>
            )}
            {mode !== "signin" && (
              <button onClick={() => { setMode("signin"); setError(""); setNotice(""); }} className="text-[#94A3B8] hover:text-white">← Back to log in</button>
            )}
          </div>
        </div>
        {mode === "signup" && (
          <p className="text-xs text-center mt-4 text-[#64748B]">
            New accounts start as a Student. If you're the admin setting this up for the first time, sign up, then follow the "first admin" step in supabase/schema.sql.
          </p>
        )}
      </div>
    </div>
  );
}
