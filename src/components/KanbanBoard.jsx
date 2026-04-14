import { useState, useEffect, useCallback, useRef } from "react";
import {
  getColumns,
  getCards,
  createCard,
  updateCard as dbUpdateCard,
  deleteCard as dbDeleteCard,
  createColumn,
  getBoardMembers,
  addBoardMember,
  inviteUserByEmail,
  removeBoardMember,
  getPendingInvites,
  subscribeToBoard,
  updateBoard,
  deleteBoard,
  getAllProfiles,
} from "../lib/database";
import { LABELS, PRIORITY } from "../lib/constants";

export default function KanbanBoard({ board, userId, profile, onBack }) {
  const [columns, setColumns] = useState([]);
  const [cards, setCards] = useState([]);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [modal, setModal] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [filterLabel, setFilterLabel] = useState(null);
  const [filterPriority, setFilterPriority] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editMode, setEditMode] = useState(false);
  const dragCounter = useRef({});

  const isAdmin = board.memberRole === "admin" || board.owner_id === userId;

  const loadData = useCallback(async () => {
    try {
      const [cols, cds, mems, invs] = await Promise.all([
        getColumns(board.id),
        getCards(board.id),
        getBoardMembers(board.id),
        isAdmin ? getPendingInvites(board.id) : Promise.resolve([]),
      ]);
      setColumns(cols);
      setCards(cds);
      setMembers(mems);
      setPendingInvites(invs);
    } catch (err) {
      console.error("Failed to load board data:", err);
    }
    setLoading(false);
  }, [board.id, isAdmin]);

  useEffect(() => {
    loadData();
    const channel = subscribeToBoard(board.id, () => loadData());
    return () => { channel.unsubscribe(); };
  }, [board.id, loadData]);

  /* ── Filters ── */
  const filteredCards = useCallback(
    (colId) => {
      let result = cards.filter((c) => c.column_id === colId);
      if (filterLabel) result = result.filter((c) => c.labels?.includes(filterLabel));
      if (filterPriority) result = result.filter((c) => c.priority === filterPriority);
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        result = result.filter(
          (c) => c.title.toLowerCase().includes(s) || (c.description || "").toLowerCase().includes(s)
        );
      }
      return result;
    },
    [cards, filterLabel, filterPriority, searchTerm]
  );

  /* ── Drag & Drop ── */
  const onDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.target.style.opacity = "0.4";
  };
  const onDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDraggedId(null);
    setOverColumn(null);
    dragCounter.current = {};
  };
  const onDragEnterCol = (colId) => {
    dragCounter.current[colId] = (dragCounter.current[colId] || 0) + 1;
    setOverColumn(colId);
  };
  const onDragLeaveCol = (colId) => {
    dragCounter.current[colId] = (dragCounter.current[colId] || 0) - 1;
    if (dragCounter.current[colId] <= 0) {
      dragCounter.current[colId] = 0;
      if (overColumn === colId) setOverColumn(null);
    }
  };
  const onDropCol = async (colId) => {
    if (draggedId == null) return;
    const card = cards.find((c) => c.id === draggedId);
    if (card && card.column_id !== colId) {
      setCards((prev) => prev.map((c) => (c.id === draggedId ? { ...c, column_id: colId } : c)));
      try {
        await dbUpdateCard(draggedId, { column_id: colId });
      } catch (err) {
        console.error("Failed to move card:", err);
        loadData();
      }
    }
    setDraggedId(null);
    setOverColumn(null);
    dragCounter.current = {};
  };

  /* ── Card CRUD ── */
  const handleAddCard = async (colId, cardData) => {
    try {
      const newCard = await createCard(board.id, colId, cardData);
      setCards((p) => [...p, newCard]);
      setAddingTo(null);
    } catch (err) {
      alert("Failed to create card: " + err.message);
    }
  };

  const handleUpdateCard = async (id, updates) => {
    setCards((p) => p.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    try {
      await dbUpdateCard(id, updates);
    } catch (err) {
      console.error("Failed to update:", err);
      loadData();
    }
  };

  const handleDeleteCard = async (id) => {
    setCards((p) => p.filter((c) => c.id !== id));
    setModal(null);
    try {
      await dbDeleteCard(id);
    } catch (err) {
      console.error("Failed to delete:", err);
      loadData();
    }
  };

  const totalCards = cards.length;
  const lastCol = columns[columns.length - 1];
  const doneCount = lastCol ? cards.filter((c) => c.column_id === lastCol.id).length : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
        <p style={{ color: "var(--text-dim)" }}>Loading board…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={backBtnStyle}>← Boards</button>
          <div>
            <h1 style={titleStyle}>
              {board.emoji} {board.name}
            </h1>
            <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 2 }}>
              {doneCount}/{totalCards} complete &nbsp;·&nbsp; {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Search…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={filterInputStyle}
          />
          <select value={filterLabel || ""} onChange={(e) => setFilterLabel(e.target.value || null)} style={filterInputStyle}>
            <option value="">All Labels</option>
            {Object.entries(LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.name}</option>
            ))}
          </select>
          <select value={filterPriority || ""} onChange={(e) => setFilterPriority(e.target.value || null)} style={filterInputStyle}>
            <option value="">All Priorities</option>
            {Object.keys(PRIORITY).map((k) => (
              <option key={k} value={k}>{PRIORITY[k].emoji} {PRIORITY[k].label}</option>
            ))}
          </select>
          {(filterLabel || filterPriority || searchTerm) && (
            <button onClick={() => { setFilterLabel(null); setFilterPriority(null); setSearchTerm(""); }} style={clearFilterStyle}>
              Clear
            </button>
          )}

          {/* Member avatars */}
          <div style={{ display: "flex", marginLeft: 8 }}>
            {members.slice(0, 5).map((m, i) => (
              <div
                key={m.id}
                title={m.full_name}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: m.avatar_color || "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  marginLeft: i > 0 ? -6 : 0,
                  border: "2px solid var(--bg)",
                  zIndex: 5 - i,
                  position: "relative",
                }}
              >
                {m.full_name?.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {isAdmin && (
            <button onClick={() => setShowMembers(true)} style={memberBtnStyle}>
              Manage Team
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowBoardSettings(true)} style={{ ...memberBtnStyle, color: "var(--text-dim)" }}>
              ⚙️ Settings
            </button>
          )}
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div style={{ padding: "0 24px" }}>
        <div style={{ background: "var(--surface2)", borderRadius: 6, height: 5, overflow: "hidden" }}>
          <div
            style={{
              width: `${totalCards ? (doneCount / totalCards) * 100 : 0}%`,
              height: "100%",
              background: "linear-gradient(90deg, var(--accent), #e8b04a)",
              borderRadius: 6,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* ── Board columns ── */}
      <div style={{ display: "flex", gap: 16, padding: "20px 24px", flex: 1, overflowX: "auto", alignItems: "flex-start" }}>
        {columns.map((col) => {
          const items = filteredCards(col.id);
          const isOver = overColumn === col.id && draggedId != null;

          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => onDragEnterCol(col.id)}
              onDragLeave={() => onDragLeaveCol(col.id)}
              onDrop={() => onDropCol(col.id)}
              style={{
                flex: "0 0 290px",
                minWidth: 290,
                background: isOver ? "rgba(212,148,58,0.06)" : "var(--surface)",
                border: `1px solid ${isOver ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 14,
                display: "flex",
                flexDirection: "column",
                maxHeight: "calc(100vh - 200px)",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{col.emoji}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{col.name}</span>
                  <span style={{ background: "var(--surface2)", padding: "2px 8px", borderRadius: 10, fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>
                    {items.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingTo(col.id)}
                  style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
                >
                  +
                </button>
              </div>

              <div style={{ padding: "8px 10px 12px", overflowY: "auto", flex: 1 }}>
                {items.map((c) => (
                  <CardItem
                    key={c.id}
                    card={c}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onClick={() => { setModal(c); setEditMode(false); }}
                  />
                ))}
                {items.length === 0 && (
                  <p style={{ color: "var(--text-dim)", fontSize: 12, textAlign: "center", padding: "24px 8px", opacity: 0.5 }}>
                    {draggedId ? "Drop here" : "No tasks"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modals ── */}
      {addingTo && (
        <AddCardModal
          columnId={addingTo}
          columns={columns}
          members={members}
          onAdd={handleAddCard}
          onClose={() => setAddingTo(null)}
        />
      )}

      {modal && (
        <CardDetailModal
          card={modal}
          columns={columns}
          members={members}
          editMode={editMode}
          setEditMode={setEditMode}
          onUpdate={(updates) => {
            handleUpdateCard(modal.id, updates);
            setModal({ ...modal, ...updates });
          }}
          onDelete={() => handleDeleteCard(modal.id)}
          onClose={() => setModal(null)}
        />
      )}

      {showMembers && isAdmin && (
        <MembersModal
          boardId={board.id}
          members={members}
          pendingInvites={pendingInvites}
          onRefresh={loadData}
          onClose={() => setShowMembers(false)}
        />
      )}

      {showBoardSettings && isAdmin && (
        <BoardSettingsModal
          board={board}
          onUpdate={async (updates) => {
            await updateBoard(board.id, updates);
            Object.assign(board, updates);
            loadData();
          }}
          onDelete={async () => {
            if (!confirm("Delete this board and all its data? This cannot be undone.")) return;
            await deleteBoard(board.id);
            onBack();
          }}
          onClose={() => setShowBoardSettings(false)}
        />
      )}
    </div>
  );
}

/* ─────────────────  CARD ITEM  ───────────────── */
function CardItem({ card: c, onDragStart, onDragEnd, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, c.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--surface2)" : "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "11px 13px",
        marginBottom: 8,
        cursor: "grab",
        transition: "background 0.15s, transform 0.15s, box-shadow 0.15s",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.25)" : "none",
      }}
    >
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 7 }}>
        {(c.labels || []).map((l) => (
          <span
            key={l}
            style={{
              background: (LABELS[l]?.color || "#888") + "22",
              color: LABELS[l]?.color || "#888",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 5,
              textTransform: "uppercase",
            }}
          >
            {LABELS[l]?.name || l}
          </span>
        ))}
      </div>
      <p style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35, marginBottom: 5 }}>
        {PRIORITY[c.priority]?.emoji} &nbsp;{c.title}
      </p>
      {c.description && (
        <p style={{
          color: "var(--text-dim)",
          fontSize: 12,
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {c.description}
        </p>
      )}
      {c.assignee && (
        <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)" }}>👤 {c.assignee}</p>
      )}
    </div>
  );
}

/* ─────────────────  ADD CARD MODAL  ───────────────── */
function AddCardModal({ columnId, columns, members, onAdd, onClose }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [labels, setLabels] = useState([]);
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");

  const toggleLabel = (l) => setLabels((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  const submit = () => {
    if (!title.trim()) return;
    onAdd(columnId, { title: title.trim(), description: desc.trim(), labels, priority, assignee: assignee.trim() });
  };

  const col = columns.find((c) => c.id === columnId);

  return (
    <Overlay onClose={onClose}>
      <h2 style={modalTitleStyle}>New Task → {col?.name}</h2>
      <Field label="Title">
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </Field>
      <Field label="Description">
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Details…" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
      <Field label="Labels">
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Object.entries(LABELS).map(([k, v]) => (
            <button key={k} onClick={() => toggleLabel(k)} style={{
              background: labels.includes(k) ? v.color + "33" : "var(--surface)",
              border: `1px solid ${labels.includes(k) ? v.color : "var(--border)"}`,
              color: labels.includes(k) ? v.color : "var(--text-dim)",
              borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>
              {v.name}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Priority" style={{ flex: 1 }}>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
        </Field>
        <Field label="Assignee" style={{ flex: 1 }}>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={inputStyle}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit} disabled={!title.trim()}>Add Task</Btn>
      </div>
    </Overlay>
  );
}

/* ─────────────────  CARD DETAIL MODAL  ───────────────── */
function CardDetailModal({ card: c, columns, members, editMode, setEditMode, onUpdate, onDelete, onClose }) {
  const [title, setTitle] = useState(c.title);
  const [desc, setDesc] = useState(c.description || "");
  const [labels, setLabels] = useState([...(c.labels || [])]);
  const [priority, setPriority] = useState(c.priority);
  const [assignee, setAssignee] = useState(c.assignee || "");
  const [colId, setColId] = useState(c.column_id);

  useEffect(() => {
    setTitle(c.title);
    setDesc(c.description || "");
    setLabels([...(c.labels || [])]);
    setPriority(c.priority);
    setAssignee(c.assignee || "");
    setColId(c.column_id);
  }, [c]);

  const toggleLabel = (l) => setLabels((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  const save = () => {
    onUpdate({ title, description: desc, labels, priority, assignee, column_id: colId });
    setEditMode(false);
  };

  const currentCol = columns.find((col) => col.id === c.column_id);

  if (editMode) {
    return (
      <Overlay onClose={onClose}>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Description">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <Field label="Labels">
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {Object.entries(LABELS).map(([k, v]) => (
              <button key={k} onClick={() => toggleLabel(k)} style={{
                background: labels.includes(k) ? v.color + "33" : "var(--surface)",
                border: `1px solid ${labels.includes(k) ? v.color : "var(--border)"}`,
                color: labels.includes(k) ? v.color : "var(--text-dim)",
                borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>
                {v.name}
              </button>
            ))}
          </div>
        </Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Priority" style={{ flex: 1 }}>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </Field>
          <Field label="Column" style={{ flex: 1 }}>
            <select value={colId} onChange={(e) => setColId(e.target.value)} style={inputStyle}>
              {columns.map((col) => <option key={col.id} value={col.id}>{col.emoji} {col.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Assignee">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={inputStyle}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => setEditMode(false)}>Cancel</Btn>
          <Btn onClick={save}>Save</Btn>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, lineHeight: 1.3 }}>
        {PRIORITY[c.priority]?.emoji} &nbsp;{c.title}
      </h2>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "10px 0" }}>
        {(c.labels || []).map((l) => (
          <span key={l} style={{ background: (LABELS[l]?.color || "#888") + "22", color: LABELS[l]?.color || "#888", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 5, textTransform: "uppercase" }}>
            {LABELS[l]?.name || l}
          </span>
        ))}
      </div>
      {c.description && <p style={{ color: "var(--text-dim)", fontSize: 13, lineHeight: 1.55, margin: "10px 0 14px" }}>{c.description}</p>}
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-dim)", marginBottom: 18 }}>
        <span>📍 {currentCol?.name}</span>
        {c.assignee && <span>👤 {c.assignee}</span>}
        <span>📅 {new Date(c.created_at).toLocaleDateString()}</span>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="danger" onClick={onDelete}>Delete</Btn>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <Btn onClick={() => setEditMode(true)}>Edit</Btn>
      </div>
    </Overlay>
  );
}

/* ─────────────────  MEMBERS MODAL  ───────────────── */
function MembersModal({ boardId, members, pendingInvites, onRefresh, onClose }) {
  const [allUsers, setAllUsers] = useState([]);
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    getAllProfiles().then(setAllUsers).catch(console.error);
  }, []);

  const memberIds = members.map((m) => m.id);
  const availableUsers = allUsers.filter((u) => !memberIds.includes(u.id));

  const handleAddUser = async (userId) => {
    if (!userId) return;
    setSending(true);
    setMsg("");
    try {
      const user = allUsers.find((u) => u.id === userId);
      await addBoardMember(boardId, userId, role);
      setMsg(`${user?.full_name || "User"} added to the board!`);
      onRefresh();
    } catch (err) {
      setMsg("Error: " + err.message);
    }
    setSending(false);
  };

  const handleInviteEmail = async () => {
    if (!email.trim()) return;
    setSending(true);
    setMsg("");
    try {
      const result = await inviteUserByEmail(email.trim(), boardId, role);
      if (result.status === "added") {
        setMsg(`${email} added to the board!`);
      } else {
        setMsg(`Invite sent! ${email} will see this board when they sign up.`);
      }
      setEmail("");
      onRefresh();
    } catch (err) {
      setMsg("Error: " + err.message);
    }
    setSending(false);
  };

  const handleRemove = async (userId) => {
    if (!confirm("Remove this member?")) return;
    try {
      await removeBoardMember(boardId, userId);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <h2 style={modalTitleStyle}>Manage Team</h2>

      {/* Add from existing users */}
      <Field label="Add Member">
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value=""
            onChange={(e) => handleAddUser(e.target.value)}
            disabled={sending}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="">Select a user to add…</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} — {u.email} ({u.role})
              </option>
            ))}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: 100 }}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {availableUsers.length === 0 && !showEmailFallback && (
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
            All users are already members.{" "}
            <button onClick={() => setShowEmailFallback(true)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>
              Invite by email instead
            </button>
          </p>
        )}
        {availableUsers.length > 0 && (
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
            Don't see the user?{" "}
            <button onClick={() => setShowEmailFallback(!showEmailFallback)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>
              {showEmailFallback ? "Hide email invite" : "Invite by email"}
            </button>
          </p>
        )}
      </Field>

      {/* Email fallback */}
      {showEmailFallback && (
        <Field label="Invite by Email">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@email.com"
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => e.key === "Enter" && handleInviteEmail()}
            />
            <Btn onClick={handleInviteEmail} disabled={sending || !email.trim()}>
              {sending ? "…" : "Invite"}
            </Btn>
          </div>
        </Field>
      )}

      {msg && <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 12 }}>{msg}</p>}

      {/* Current members */}
      <Field label={`Members (${members.length})`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.avatar_color || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                  {m.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{m.full_name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-dim)" }}>{m.email}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>{m.role}</span>
                {m.role !== "admin" && (
                  <button onClick={() => handleRemove(m.id)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 16, cursor: "pointer" }}>×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Field>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <Field label="Pending Invites">
          {pendingInvites.map((inv) => (
            <div key={inv.id} style={{ padding: "6px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 4, fontSize: 12 }}>
              ✉️ {inv.email} <span style={{ color: "var(--text-dim)" }}>({inv.role})</span>
            </div>
          ))}
        </Field>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </div>
    </Overlay>
  );
}

/* ─────────────────  BOARD SETTINGS MODAL  ───────────────── */
function BoardSettingsModal({ board, onUpdate, onDelete, onClose }) {
  const [name, setName] = useState(board.name);
  const [desc, setDesc] = useState(board.description || "");
  const [emoji, setEmoji] = useState(board.emoji);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onUpdate({ name: name.trim(), description: desc.trim(), emoji });
      onClose();
    } catch (err) {
      alert("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await onDelete();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <h2 style={modalTitleStyle}>Board Settings</h2>

      <Field label="Board Name">
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Description">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is this board for?" style={inputStyle} />
      </Field>

      <Field label="Icon">
        <div style={{ display: "flex", gap: 8 }}>
          {["📋", "🎯", "📢", "💰", "🏠", "⚙️", "🚀", "📊"].map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              style={{
                width: 40, height: 40, borderRadius: 8, fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: emoji === e ? "var(--accent-soft)" : "var(--bg)",
                border: `1px solid ${emoji === e ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
        <Field label="Danger Zone">
          <button onClick={handleDelete} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
            🗑️ Delete This Board
          </button>
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
            This will permanently delete the board and all its cards, columns, and members.
          </p>
        </Field>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!name.trim() || saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Btn>
      </div>
    </Overlay>
  );
}

/* ─────────────────  SHARED UI  ───────────────── */
function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 28px", width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant, disabled }) {
  const base = { fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 };
  const v = {
    default: { background: "var(--accent)", color: "#fff" },
    ghost: { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" },
    danger: { background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...(v[variant || "default"]) }}>{children}</button>;
}

/* ── Inline styles ── */
const headerStyle = { padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, background: "linear-gradient(180deg, #15171c 0%, var(--bg) 100%)" };
const titleStyle = { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" };
const backBtnStyle = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", color: "var(--text-dim)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const filterInputStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", color: "var(--text)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none" };
const clearFilterStyle = { background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: 8, padding: "6px 12px", color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const memberBtnStyle = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const inputStyle = { width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 14px", color: "var(--text)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" };
const modalTitleStyle = { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, marginBottom: 18, color: "var(--accent)" };
