CREATE EXTENSION IF NOT EXISTS vector;

-- Emotion Vector의 차원(33)은 lib/emotions.ts의 EMOTIONS 개수와 같아야 한다.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id text NOT NULL UNIQUE,
  email text,
  name text,
  consented_at timestamptz,
  last_scope text NOT NULL DEFAULT 'all' CHECK (last_scope IN ('ko', 'pop', 'all')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE songs (
  id serial PRIMARY KEY,
  title text NOT NULL,
  artist text NOT NULL,
  language text NOT NULL CHECK (language IN ('ko', 'pop')),
  emotion_vector vector(33) NOT NULL,
  UNIQUE (title, artist)
);

CREATE TABLE diaries (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date date NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  scope text NOT NULL CHECK (scope IN ('ko', 'pop', 'all')),
  emotion_vector vector(33) NOT NULL,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id integer NOT NULL UNIQUE REFERENCES diaries (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recommendations (
  card_id uuid NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
  song_id integer NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  reason text NOT NULL,
  PRIMARY KEY (card_id, rank)
);

-- 하루 분석 한도(User당 한국 날짜 기준) 계산용. 실패한 시도도 센다.
CREATE TABLE analysis_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analysis_log_user_date ON analysis_log (user_id, date);
