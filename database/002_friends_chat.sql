-- Username for search
ALTER TABLE users ADD COLUMN username VARCHAR(30) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Global default for message persistence
ALTER TABLE users ADD COLUMN save_messages_default BOOLEAN NOT NULL DEFAULT false;

-- Friend requests (transient — one row per request attempt)
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT no_self_request CHECK (sender_id <> receiver_id),
  CONSTRAINT unique_pending_request UNIQUE (sender_id, receiver_id)
);

-- Friendships (canonical row per pair — always insert with the lexicographically smaller UUID as user_one_id)
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_one_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_two_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ordered_pair CHECK (user_one_id < user_two_id),
  CONSTRAINT unique_friendship UNIQUE (user_one_id, user_two_id)
);

-- Conversations (also canonical pair)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_one_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_two_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ordered_pair_convo CHECK (user_one_id < user_two_id),
  CONSTRAINT unique_conversation UNIQUE (user_one_id, user_two_id)
);

-- Per-user, per-conversation override of save_messages_default
CREATE TABLE IF NOT EXISTS conversation_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  save_messages BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_pref UNIQUE (conversation_id, user_id)
);

-- Messages: a row is only ever written if at least one side wants a copy saved
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  saved_for_sender BOOLEAN NOT NULL DEFAULT false,
  saved_for_receiver BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(40) NOT NULL,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
