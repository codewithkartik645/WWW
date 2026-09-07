import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { useAuth } from "./lib/useAuth";
import { supabase } from "./lib/supabaseClient";
import { C } from "./theme";
import { PasswordInput } from "./components/UI";

// Sign up with email+password, land as a "student" by default. The very first person
// (the school's actual admin) promotes themselves to "admin" once, via one SQL command
// in the Supabase dashboard — see supabase/schema.sql for instructions. From then on,
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

  const fieldClass = "rounded-lg px-3.5 py-2.5 text-sm w-full mb-4 border transition-colors focus:outline-none";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        fontFamily: "'Source Sans 3', 'Inter', sans-serif",
        background: `radial-gradient(circle at 50% 0%, ${C.darkSoft} 0%, ${C.dark} 65%)`,
      }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg"
            style={{ background: C.purple, boxShadow: `0 8px 24px ${C.purple}55` }}
          >
            <GraduationCap size={26} />
          </div>
          <div className="text-center">
            <div className="text-2xl tracking-wide" style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: "#F5EFE4" }}>
              Study Tracker
            </div>
            <div className="text-[11px] tracking-[0.2em] uppercase mt-1" style={{ color: "#B7AC95" }}>
              Your academic companion
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-7"
          style={{ background: "#FAF6EF", boxShadow: "0 20px 48px rgba(0,0,0,0.35)" }}
        >
          <div className="text-lg mb-5" style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: C.text }}>
            {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </div>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <>
                <div className="text-xs mb-1.5 font-medium" style={{ color: C.sub }}>Your name</div>
                <input
                  value={name} onChange={(e) => setName(e.target.value)} autoFocus
                  className={fieldClass}
                  style={{ borderColor: C.border, background: "#FFFFFF", color: C.text }}
                />
              </>
            )}
            <div className="text-xs mb-1.5 font-medium" style={{ color: C.sub }}>Email</div>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className={fieldClass}
              style={{ borderColor: C.border, background: "#FFFFFF", color: C.text }}
            />
            {mode !== "forgot" && (
              <>
                <div className="text-xs mb-1.5 font-medium" style={{ color: C.sub }}>Password</div>
                <PasswordInput
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  className={fieldClass}
                  style={{ borderColor: C.border, background: "#FFFFFF", color: C.text }}
                  iconColor={C.sub}
                />
              </>
            )}
            {error && (
              <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#F1E1DC", color: C.red }}>
                {error}
              </div>
            )}
            {notice && (
              <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#EEF2E7", color: C.green }}>
                {notice}
              </div>
            )}
            <button
              type="submit" disabled={busy}
              className="w-full text-sm text-white px-3 py-2.5 rounded-lg font-medium disabled:opacity-50 transition-transform active:scale-[0.99]"
              style={{ background: C.purple }}
            >
              {busy ? "Please wait…" : mode === "signin" ? "Log in" : mode === "signup" ? "Sign up" : "Send reset link"}
            </button>
          </form>
          <div className="flex items-center justify-between mt-5 text-xs">
            {mode === "signin" && (
              <>
                <button onClick={() => { setMode("signup"); setError(""); setNotice(""); }} style={{ color: C.sub }} className="hover:underline">Need an account? Sign up</button>
                <button onClick={() => { setMode("forgot"); setError(""); setNotice(""); }} style={{ color: C.sub }} className="hover:underline">Forgot password?</button>
              </>
            )}
            {mode !== "signin" && (
              <button onClick={() => { setMode("signin"); setError(""); setNotice(""); }} style={{ color: C.sub }} className="hover:underline">← Back to log in</button>
            )}
          </div>
        </div>
        {mode === "signup" && (
          <p className="text-xs text-center mt-5" style={{ color: "#B7AC95" }}>
            New accounts start as a Student. If you're the admin setting this up for the first time, sign up, then follow the "first admin" step in supabase/schema.sql.
          </p>
        )}
      </div>
    </div>
  );
}
