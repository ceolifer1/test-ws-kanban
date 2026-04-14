import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { getProfile, getBoards, signOut, acceptInvitesForEmail } from "./lib/database";
import AuthPage from "./components/AuthPage";
import BoardSelector from "./components/BoardSelector";
import KanbanBoard from "./components/KanbanBoard";
import UserManagement from "./components/UserManagement";

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@400;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:        #0f1114;
  --surface:   #181b20;
  --surface2:  #22262d;
  --border:    #2a2e36;
  --text:      #e8e6e3;
  --text-dim:  #8b8d93;
  --accent:    #d4943a;
  --accent-soft: rgba(212,148,58,0.12);
  --danger:    #ef4444;
  --radius:    10px;
  --shadow:    0 2px 12px rgba(0,0,0,0.35);
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

::selection { background: var(--accent); color: #000; }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }
`;

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [boards, setBoards] = useState([]);
  const [activeBoard, setActiveBoard] = useState(null);
  const [view, setView] = useState("boards"); // boards | users
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserData(session.user);
      else {
        setProfile(null);
        setBoards([]);
        setActiveBoard(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (user) => {
    try {
      const prof = await getProfile(user.id);
      setProfile(prof);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
    try {
      const bds = await getBoards(user.id);
      setBoards(bds);
      await acceptInvitesForEmail(user.email, user.id);
      const updatedBoards = await getBoards(user.id);
      setBoards(updatedBoards);
    } catch (err) {
      console.error("Failed to load boards:", err);
    }
    setLoading(false);
  };

  const refreshBoards = async () => {
    if (!session) return;
    try {
      const bds = await getBoards(session.user.id);
      setBoards(bds);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setSession(null);
    setProfile(null);
    setBoards([]);
    setActiveBoard(null);
  };

  if (loading) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "var(--accent)", marginBottom: 12 }}>
              Findmysec8.com
            </h1>
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Loading…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      {!session ? (
        <AuthPage onAuth={() => {}} />
      ) : view === "users" && (profile?.role === "superadmin" || profile?.role === "admin") ? (
        <UserManagement
          profile={profile}
          onBack={() => setView("boards")}
        />
      ) : activeBoard ? (
        <KanbanBoard
          board={activeBoard}
          userId={session.user.id}
          profile={profile}
          onBack={() => setActiveBoard(null)}
        />
      ) : (
        <BoardSelector
          boards={boards}
          userId={session.user.id}
          profile={profile}
          onSelect={setActiveBoard}
          onRefresh={refreshBoards}
          onLogout={handleLogout}
          onManageUsers={(profile?.role === "superadmin" || profile?.role === "admin") ? () => setView("users") : null}
        />
      )}
    </>
  );
}
