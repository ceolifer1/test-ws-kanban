import { supabase } from "./supabase";

/* ─────────────────  AUTH  ───────────────── */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/* ─────────────────  USER MANAGEMENT (RPC)  ───────────────── */
export async function getAllUsers() {
  const { data, error } = await supabase.rpc("get_all_users");
  if (error) throw error;
  return data;
}

export async function createAppUser(email, password, fullName, role = "user") {
  const { data, error } = await supabase.rpc("create_app_user", {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
    p_role: role,
  });
  if (error) throw error;
  return data;
}

export async function updateUserRole(userId, newRole) {
  const { error } = await supabase.rpc("update_user_role", {
    p_user_id: userId,
    p_new_role: newRole,
  });
  if (error) throw error;
}

export async function deleteAppUser(userId) {
  const { error } = await supabase.rpc("delete_app_user", {
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function resetUserPassword(userId, newPassword) {
  const { error } = await supabase.rpc("reset_user_password", {
    p_user_id: userId,
    p_new_password: newPassword,
  });
  if (error) throw error;
}

export async function updateUserInfo(userId, fullName, email) {
  const { error } = await supabase.rpc("update_user_info", {
    p_user_id: userId,
    p_full_name: fullName || null,
    p_email: email || null,
  });
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

/* ─────────────────  PROFILE  ───────────────── */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ─────────────────  BOARDS  ───────────────── */
export async function getBoards(userId) {
  // Step 1: Get board memberships
  const { data: memberships, error: memErr } = await supabase
    .from("board_members")
    .select("board_id, role")
    .eq("user_id", userId);
  if (memErr) throw memErr;
  if (!memberships || memberships.length === 0) return [];

  // Step 2: Fetch the actual boards
  const boardIds = memberships.map((m) => m.board_id);
  const { data: boards, error: boardErr } = await supabase
    .from("boards")
    .select("id, name, description, emoji, created_at, owner_id")
    .in("id", boardIds);
  if (boardErr) throw boardErr;

  // Step 3: Merge
  const boardMap = Object.fromEntries((boards || []).map((b) => [b.id, b]));
  return memberships
    .filter((m) => boardMap[m.board_id])
    .map((m) => ({ ...boardMap[m.board_id], memberRole: m.role }));
}

export async function createBoard(name, description, emoji, ownerId) {
  const { data, error } = await supabase
    .from("boards")
    .insert({ name, description, emoji, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;

  // Add owner as admin member
  await supabase
    .from("board_members")
    .insert({ board_id: data.id, user_id: ownerId, role: "admin" });

  return data;
}

export async function updateBoard(boardId, updates) {
  const { data, error } = await supabase
    .from("boards")
    .update(updates)
    .eq("id", boardId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBoard(boardId) {
  // Delete related data first (cards, columns, members, invites)
  await supabase.from("cards").delete().eq("board_id", boardId);
  await supabase.from("columns").delete().eq("board_id", boardId);
  await supabase.from("board_members").delete().eq("board_id", boardId);
  await supabase.from("invites").delete().eq("board_id", boardId);
  const { error } = await supabase.from("boards").delete().eq("id", boardId);
  if (error) throw error;
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_color, role")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ─────────────────  BOARD MEMBERS  ───────────────── */
export async function getBoardMembers(boardId) {
  const { data, error } = await supabase
    .from("board_members")
    .select("user_id, role, profiles(id, full_name, email, avatar_color)")
    .eq("board_id", boardId);
  if (error) throw error;
  return data.map((bm) => ({ ...bm.profiles, role: bm.role }));
}

export async function addBoardMember(boardId, userId, role = "member") {
  const { error } = await supabase
    .from("board_members")
    .insert({ board_id: boardId, user_id: userId, role });
  if (error) throw error;
}

export async function removeBoardMember(boardId, userId) {
  const { error } = await supabase
    .from("board_members")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", userId);
  if (error) throw error;
}

/* ─────────────────  COLUMNS  ───────────────── */
export async function getColumns(boardId) {
  const { data, error } = await supabase
    .from("columns")
    .select("*")
    .eq("board_id", boardId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createColumn(boardId, name, emoji, position) {
  const { data, error } = await supabase
    .from("columns")
    .insert({ board_id: boardId, name, emoji, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ─────────────────  CARDS  ───────────────── */
export async function getCards(boardId) {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("board_id", boardId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCard(boardId, columnId, card) {
  const { data, error } = await supabase
    .from("cards")
    .insert({
      board_id: boardId,
      column_id: columnId,
      title: card.title,
      description: card.description || "",
      labels: card.labels || [],
      priority: card.priority || "medium",
      assignee: card.assignee || "",
      position: card.position || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCard(cardId, updates) {
  const { data, error } = await supabase
    .from("cards")
    .update(updates)
    .eq("id", cardId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCard(cardId) {
  const { error } = await supabase.from("cards").delete().eq("id", cardId);
  if (error) throw error;
}

/* ─────────────────  INVITES  ───────────────── */
export async function inviteUserByEmail(email, boardId, role = "member") {
  // Check if user already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    // Add them directly
    await addBoardMember(boardId, existingProfile.id, role);
    return { status: "added", userId: existingProfile.id };
  }

  // Store pending invite
  const { data, error } = await supabase
    .from("invites")
    .insert({ email, board_id: boardId, role })
    .select()
    .single();
  if (error) throw error;
  return { status: "invited", invite: data };
}

export async function getPendingInvites(boardId) {
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("board_id", boardId)
    .eq("accepted", false);
  if (error) throw error;
  return data;
}

export async function acceptInvitesForEmail(email, userId) {
  const { data: invites } = await supabase
    .from("invites")
    .select("*")
    .eq("email", email)
    .eq("accepted", false);

  if (invites && invites.length > 0) {
    for (const inv of invites) {
      await addBoardMember(inv.board_id, userId, inv.role);
      await supabase
        .from("invites")
        .update({ accepted: true })
        .eq("id", inv.id);
    }
  }
  return invites || [];
}

/* ─────────────────  REALTIME  ───────────────── */
export function subscribeToBoard(boardId, onCardChange) {
  return supabase
    .channel(`board-${boardId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` },
      (payload) => onCardChange(payload)
    )
    .subscribe();
}
