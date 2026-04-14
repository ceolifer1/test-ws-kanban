import { useState, useEffect } from "react";
import { signIn, requestPasswordReset } from "../lib/database";
import { supabase } from "../lib/supabase";

export default function AuthPage({ onAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("login"); // login | forgot | reset

  // Detect password recovery link in URL hash and listen for RECOVERY event
  useEffect(() => {
    // Check hash on mount (handles page refresh with recovery token)
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setView("reset");
    }

    // Listen for Supabase PASSWORD_RECOVERY event (handles redirect flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("reset");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await signIn(email, password);
      onAuth();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSuccess("If that email is registered, a reset link has been sent. Check your inbox.");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      setSuccess("Password updated! You can now sign in.");
      setNewPassword("");
      setConfirmPassword("");
      // Clean up the URL hash so recovery tokens don't linger
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      // Sign out the recovery session so user logs in fresh with new password
      await supabase.auth.signOut();
      setView("login");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <h1 style={styles.logo}>
            <span style={{ color: "var(--accent)" }}>Test</span> Workspace
          </h1>
          <p style={styles.subtitle}>Section 8 Workspace</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        {/* ââ LOGIN VIEW ââ */}
        {view === "login" && (
          <form onSubmit={handleLogin}>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={styles.input}
                required
              />
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
                style={styles.input}
                required
                minLength={6}
              />
            </div>

            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? "Please waitâ¦" : "Sign In"}
            </button>

            <div style={styles.footer}>
              <button
                type="button"
                onClick={() => { setView("forgot"); setError(""); setSuccess(""); }}
                style={styles.link}
              >
                Forgot password?
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span style={styles.footerText}>Access is managed by your administrator.</span>
            </div>
          </form>
        )}

        {/* ââ FORGOT PASSWORD VIEW ââ */}
        {view === "forgot" && (
          <form onSubmit={handleForgotPassword}>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Enter your email and we'll send you a link to reset your password.
              If your admin set up your account, ask them to reset it from the Manage Users panel.
            </p>

            <div style={styles.fieldWrap}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={styles.input}
                required
                autoFocus
              />
            </div>

            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? "Sendingâ¦" : "Send Reset Link"}
            </button>

            <div style={styles.footer}>
              <button
                type="button"
                onClick={() => { setView("login"); setError(""); setSuccess(""); }}
                style={styles.link}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ââ RESET PASSWORD VIEW (from email link) ââ */}
        {view === "reset" && (
          <form onSubmit={handleResetPassword}>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Enter your new password below.
            </p>

            <div style={styles.fieldWrap}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                style={styles.input}
                required
                minLength={6}
                autoFocus
              />
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                style={styles.input}
                required
                minLength={6}
              />
            </div>

            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? "Updatingâ¦" : "Update Password"}
            </button>

            <div style={styles.footer}>
              <button
                type="button"
                onClick={() => { setView("login"); setError(""); setSuccess(""); }}
                style={styles.link}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    padding: 24,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
  },
  logoWrap: { textAlign: "center", marginBottom: 32 },
  logo: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 26,
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.02em",
  },
  subtitle: { color: "var(--text-dim)", fontSize: 13, marginTop: 4 },
  fieldWrap: { marginBottom: 16 },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-dim)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  input: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  },
  btn: {
    width: "100%",
    padding: "12px 20px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    marginTop: 8,
  },
  errorBox: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#ef4444",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
  },
  successBox: {
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
  },
  footerText: { color: "var(--text-dim)", fontSize: 13 },
  link: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    textDecoration: "underline",
    padding: 0,
  },
};
