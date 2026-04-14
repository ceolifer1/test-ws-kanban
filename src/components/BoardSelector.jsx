import { useState, useEffect, useRef } from "react";
import { createBoard, createColumn, updateBoard, deleteBoard, getAllProfiles, addBoardMember } from "../lib/database";
import { DEFAULT_COLUMNS } from "../lib/constants";

export default function BoardSelector({ boards, userId, onSelect, onRefresh, onLogout, onManageUsers, profile }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("\ud83d\udccb");
  const [template, setTemplate] = useState("general");
  const [loading, setLoading] = useState(false);
  const [settingsBoard, setSettingsBoard] = useState(null);
  const [editingBoard, setEditingBoard] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Load all users for member dropdown
  useEffect(() => {
    getAllProfiles().then(setAllUsers).catch(console.error);
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const board = await createBoard(name.trim(), desc.trim(), emoji, userId);
      // Create template columns
      const cols = DEFAULT_COLUMNS[template] || DEFAULT_COLUMNS.general;
      for (const col of cols) {
        await createColumn(board.id, col.name, col.emoji, col.position);
      }
      // Add selected members
      for (const mem of selectedMembers) {
        if (mem.userId !== userId) {
          await addBoardMember(board.id, mem.userId, mem.role);
        }
      }
      setCreating(false);
      setName("");
      setDesc("");
      setSelectedMembers([]);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleDeleteBoard = async (boardId) => {
    if (!confirm("Delete this board and all its data? This cannot be undone.")) return;
    try {
      await deleteBoard(boardId);
      setSettingsBoard(null);
      onRefresh();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  };

  const handleEditBoard = async () => {
    if (!editingBoard || !editingBoard.name.trim()) return;
    setLoading(true);
    try {
      await updateBoard(editingBoard.id, {
        name: editingBoard.name.trim(),
        description: editingBoard.description?.trim() || "",
        emoji: editingBoard.emoji,
      });
      setEditingBoard(null);
      setSettingsBoard(null);
      onRefresh();
    } catch (err) {
      alert("Failed to update: " + err.message);
    }
    setLoading(false);
  };

  const addMemberToSelection = (user) => {
    if (user.id === userId) return; // owner is auto-added
    if (selectedMembers.find((m) => m.userId === user.id)) return;
    setSelectedMembers((p) => [...p, { userId: user.id, name: user.full_name, email: user.email, avatar_color: user.avatar_color, role: "member" }]);
  };

  const removeMemberFromSelection = (uid) => {
    setSelectedMembers((p) => p.filter((m) => m.userId !== uid));
  };

  const updateMemberRole = (uid, role) => {
    setSelectedMembers((p) => p.map((m) => (m.userId === uid ? { ...m, role } : m)));
  };

  const availableUsers = allUsers.filter(
    (u) => u.id !== userId && !selectedMembers.find((m) => m.userId === u.id)
  );

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.logo}>
              <span style={{ color: "var(--accent)" }}>Findmysec8</span>.com
            </h1>
            <p style={styles.subtitle}>Select a board to get started</p>
          </div>
          <div style={styles.userArea}>
            {onManageUsers && (
              <button onClick={onManageUsers} style={styles.manageUsersBtn}>
                Manage Users
              </button>
            )}
            <div style={{ ...styles.avatar, background: profile?.avatar_color || "var(--accent)" }}>
              {initials}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{profile?.full_name}</p>
              <p style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, textTransform: "uppercase" }}>{profile?.role}</p>
              <button onClick={onLogout} style={styles.logoutBtn}>Sign out</button>
            </div>
          </div>
        </div>

        {/* Board grid */}
        <div style={styles.grid}>
          {boards.map((b) => (
            <div key={b.id} style={{ position: "relative" }}>
              <button style={styles.boardCard} onClick={() => onSelect(b)}>
                <span style={styles.boardEmoji}>{b.emoji}</span>
                <h3 style={styles.boardName}>{b.name}</h3>
                <p style={styles.boardDesc}>{b.description || "No description"}</p>
                <span style={styles.roleBadge}>{b.memberRole}</span>
              </button>
              {/* Settings gear — only for admins/owners */}
              {(b.memberRole === "admin" || b.owner_id === userId) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSettingsBoard(settingsBoard === b.id ? null : b.id); }}
                  style={styles.gearBtn}
                  title="Board settings"
                >
                  \u2699\ufe0f
                </button>
              )}
              {/* Settings dropdown */}
              {settingsBoard === b.id && (
                <SettingsDropdown
                  board={b}
                  onEdit={() => { setEditingBoard({ ...b }); setSettingsBoard(null); }}
                  onDelete={() => handleDeleteBoard(b.id)}
                  onClose={() => setSettingsBoard(null)}
                />
              )}
            </div>
          ))}

          {/* Create new board */}
          <button style={styles.createCard} onClick={() => { setCreating(true); setSelectedMembers([]); }}>
            <span style={{ fontSize: 28, opacity: 0.4 }}>+</span>
            <p style={{ fontSize: 13, color: "var(--text-dim)" }}>New Board</p>
          </button>
        </div>

        {/* Create modal */}
        {creating && (
          <div style={styles.overlay} onClick={() => setCreating(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.modalTitle}>Create New Board</h2>

              <div style={styles.fieldWrap}>
                <label style={styles.label}>Board Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Client Onboarding, Capital Raises, Operations"
                  style={styles.input}
                  autoFocus
                />
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.label}>Description</label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="What is this board for?"
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.label}>Icon</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["\ud83d\udccb", "\ud83c\udfaf", "\ud83d\udce2", "\ud83d\udcb0", "\ud83c\udfe0", "\u2699\ufe0f", "\ud83d\ude80", "\ud83d\udcca"].map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      style={{
                        ...styles.emojiBtn,
                        background: emoji === e ? "var(--accent-soft)" : "var(--bg)",
                        border: `1px solid ${emoji === e ? "var(--accent)" : "var(--border)"}`,
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.label}>Column Template</label>
                <select value={template} onChange={(e) => setTemplate(e.target.value)} style={styles.input}>
                  <option value="general">General (To Do \u2192 Done)</option>
                  <option value="development">Development (Backlog \u2192 Deployed)</option>
                  <option value="marketing">Marketing (Ideas \u2192 Published)</option>
                </select>
              </div>

              {/* Member selection */}
              <div style={styles.fieldWrap}>
                <label style={styles.label}>Add Members</label>
                {availableUsers.length > 0 ? (
                  <select
                    value=""
                    onChange={(e) => {
                      const user = allUsers.find((u) => u.id === e.target.value);
                      if (user) addMemberToSelection(user);
                    }}
                    style={styles.input}
                  >
                    <option value="">Select a user to add\u2026</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} \u2014 {u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--text-dim)" }}>No other users available</p>
                )}

                {/* Selected members list */}
                {selectedMembers.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {selectedMembers.map((m) => (
                      <div key={m.userId} style={styles.memberRow}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                          <div style={{ ...styles.memberAvatar, background: m.avatar_color || "var(--accent)" }}>
                            {m.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 500 }}>{m.name}</p>
                            <p style={{ fontSize: 10, color: "var(--text-dim)" }}>{m.email}</p>
                          </div>
                        </div>
                        <select
                          value={m.role}
                          onChange={(e) => updateMemberRole(m.userId, e.target.value)}
                          style={{ ...styles.input, width: 90, padding: "4px 8px", fontSize: 11 }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => removeMemberFromSelection(m.userId)}
                          style={styles.removeMemberBtn}
                        >
                          \u00d7
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <button onClick={() => setCreating(false)} style={styles.ghostBtn}>Cancel</button>
                <button onClick={handleCreate} disabled={!name.trim() || loading} style={styles.primaryBtn}>
                  {loading ? "Creating\u2026" : "Create Board"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit board modal */}
        {editingBoard && (
          <div style={styles.overlay} onClick={() => setEditingBoard(null)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.modalTitle}>Edit Board</h2>

              <div style={styles.fieldWrap}>
                <label style={styles.label}>Board Name</label>
                <input
                  value={editingBoard.name}
                  onChange={(e) => setEditingBoard({ ...editingBoard, name: e.target.value })}
                  style={styles.input}
                  autoFocus
                />
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.label}>Description</label>
                <input
                  value={editingBoard.description || ""}
                  onChange={(e) => setEditingBoard({ ...editingBoard, description: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.label}>Icon</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["\ud83d\udccb", "\ud83c\udfaf", "\ud83d\udce2", "\ud83d\udcb0", "\ud83c\udfe0", "\u2699\ufe0f", "\ud83d\ude80", "\ud83d\udcca"].map((e) => (
                    <button
                      key={e}
                      onClick={() => setEditingBoard({ ...editingBoard, emoji: e })}
                      style={{
                        ...styles.emojiBtn,
                        background: editingBoard.emoji === e ? "var(--accent-soft)" : "var(--bg)",
                        border: `1px solid ${editingBoard.emoji === e ? "var(--accent)" : "var(--border)"}`,
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <button onClick={() => setEditingBoard(null)} style={styles.ghostBtn}>Cancel</button>
                <button onClick={handleEditBoard} disabled={!editingBoard.name.trim() || loading} style={styles.primaryBtn}>
                  {loading ? "Saving\u2026" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Settings dropdown ── */
function SettingsDropdown({ board, onEdit, onDelete, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} style={styles.dropdown}>
      <button
        onClick={onEdit}
        style={styles.dropdownItem}
        onMouseEnter={(e) => (e.target.style.background = "var(--surface2)")}
        onMouseLeave={(e) => (e.target.style.background = "transparent")}
      >
        \u270f\ufe0f &nbsp;Edit Board
      </button>
      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
      <button
        onClick={onDelete}
        style={{ ...styles.dropdownItem, color: "#ef4444" }}
        onMouseEnter={(e) => (e.target.style.background = "rgba(239,68,68,0.08)")}
        onMouseLeave={(e) => (e.target.style.background = "transparent")}
      >
        \ud83d\uddd1\ufe0f &nbsp;Delete Board
      </button>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "var(--bg)", padding: "40px 24px" },
  inner: { maxWidth: 900, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
    flexWrap: "wrap",
    gap: 16,
  },
  logo: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  subtitle: { color: "var(--text-dim)", fontSize: 14, marginTop: 4 },
  userArea: { display: "flex", alignItems: "center", gap: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#000",
  },
  logoutBtn: {
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    padding: 0,
    textDecoration: "underline",
  },
  manageUsersBtn: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 16px",
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: 16,
  },
  boardCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "24px 20px",
    textAlign: "left",
    cursor: "pointer",
    transition: "border-color 0.2s, transform 0.15s",
    fontFamily: "'DM Sans', sans-serif",
    color: "var(--text)",
    position: "relative",
    width: "100%",
  },
  boardEmoji: { fontSize: 28, display: "block", marginBottom: 12 },
  boardName: { fontSize: 16, fontWeight: 600, marginBottom: 6 },
  boardDesc: { fontSize: 13, color: "var(--text-dim)", lineHeight: 1.4 },
  roleBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    background: "var(--accent-soft)",
    color: "var(--accent)",
    fontSize: 10,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 6,
    textTransform: "uppercase",
  },
  gearBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 14,
    transition: "background 0.15s",
    zIndex: 2,
  },
  dropdown: {
    position: "absolute",
    bottom: 50,
    right: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "6px 0",
    boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
    zIndex: 10,
    minWidth: 160,
  },
  dropdownItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    padding: "9px 16px",
    fontSize: 13,
    color: "var(--text)",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: 0,
    transition: "background 0.1s",
  },
  createCard: {
    background: "var(--surface)",
    border: "2px dashed var(--border)",
    borderRadius: 14,
    padding: "40px 20px",
    textAlign: "center",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    color: "var(--text)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 150,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    padding: 24,
  },
  modal: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "28px 32px",
    width: "100%",
    maxWidth: 520,
    maxHeight: "85vh",
    overflowY: "auto",
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  },
  modalTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 20,
    color: "var(--accent)",
  },
  fieldWrap: { marginBottom: 14 },
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
    padding: "9px 14px",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  ghostBtn: {
    background: "var(--surface2)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  memberRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    background: "var(--bg)",
    borderRadius: 8,
    border: "1px solid var(--border)",
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    color: "#000",
    flexShrink: 0,
  },
  removeMemberBtn: {
    background: "none",
    border: "none",
    color: "var(--danger, #ef4444)",
    fontSize: 18,
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
};
