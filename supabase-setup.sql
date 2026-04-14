-- ============================================================
-- FINDMYSEC8 KANBAN — SUPABASE DATABASE SETUP
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. PROFILES (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_color TEXT DEFAULT '#d4943a',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  colors TEXT[] := ARRAY['#f59e0b','#8b5cf6','#06b6d4','#ef4444','#ec4899','#22c55e','#f97316','#3b82f6','#a855f7','#14b8a6'];
  random_color TEXT;
BEGIN
  random_color := colors[1 + floor(random() * 10)::int];
  INSERT INTO profiles (id, email, full_name, avatar_color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    random_color
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- 2. BOARDS
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  emoji TEXT DEFAULT '📋',
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can read their boards"
  ON boards FOR SELECT TO authenticated
  USING (id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create boards"
  ON boards FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Board owners can update"
  ON boards FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Board owners can delete"
  ON boards FOR DELETE TO authenticated
  USING (owner_id = auth.uid());


-- 3. BOARD MEMBERS (access control)
CREATE TABLE IF NOT EXISTS board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, user_id)
);

ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see fellow board members"
  ON board_members FOR SELECT TO authenticated
  USING (board_id IN (SELECT board_id FROM board_members bm WHERE bm.user_id = auth.uid()));

CREATE POLICY "Board admins can add members"
  ON board_members FOR INSERT TO authenticated
  WITH CHECK (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR board_id IN (
      SELECT id FROM boards WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Board admins can remove members"
  ON board_members FOR DELETE TO authenticated
  USING (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- 4. COLUMNS
CREATE TABLE IF NOT EXISTS columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📋',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can read columns"
  ON columns FOR SELECT TO authenticated
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board admins can create columns"
  ON columns FOR INSERT TO authenticated
  WITH CHECK (board_id IN (
    SELECT board_id FROM board_members WHERE user_id = auth.uid() AND role IN ('admin')
  ) OR board_id IN (SELECT id FROM boards WHERE owner_id = auth.uid()));

CREATE POLICY "Board admins can update columns"
  ON columns FOR UPDATE TO authenticated
  USING (board_id IN (
    SELECT board_id FROM board_members WHERE user_id = auth.uid() AND role IN ('admin')
  ) OR board_id IN (SELECT id FROM boards WHERE owner_id = auth.uid()));


-- 5. CARDS
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  column_id UUID REFERENCES columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  labels TEXT[] DEFAULT '{}',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  assignee TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can read cards"
  ON cards FOR SELECT TO authenticated
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can create cards"
  ON cards FOR INSERT TO authenticated
  WITH CHECK (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can update cards"
  ON cards FOR UPDATE TO authenticated
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY "Board members can delete cards"
  ON cards FOR DELETE TO authenticated
  USING (board_id IN (
    SELECT board_id FROM board_members WHERE user_id = auth.uid() AND role IN ('admin', 'member')
  ));


-- 6. INVITES (pending email invites)
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board admins can manage invites"
  ON invites FOR ALL TO authenticated
  USING (
    board_id IN (
      SELECT board_id FROM board_members WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR board_id IN (SELECT id FROM boards WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can read their own invites"
  ON invites FOR SELECT TO authenticated
  USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));


-- 7. ENABLE REALTIME for cards table
ALTER PUBLICATION supabase_realtime ADD TABLE cards;

-- ============================================================
-- DONE! Your database is ready.
-- ============================================================
