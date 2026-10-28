import { getSql, type Sql } from "@/lib/db";
import { MAX_DIARY_LENGTH, type Scope } from "@/lib/diary-rules";
import { addDays, monthRange, seoulDate } from "@/lib/dates";
import { getEmotionAnalyzer, type EmotionAnalyzer } from "@/lib/emotion-analyzer";
import { moodGroupOf, sanitizeScores, topEmotions, type EmotionScores, type TopEmotion } from "@/lib/emotions";
import {
  fromVectorLiteral,
  listenLinks,
  rankSongs,
  recommendationReason,
  toVectorLiteral,
} from "@/lib/recommend";

export { isScope, MAX_DIARY_LENGTH, SCOPES, type Scope } from "@/lib/diary-rules";
export const DAILY_ANALYSIS_LIMIT = 10;
const RECENT_DAYS = 7;
const CANDIDATE_COUNT = 20;

export type CardSong = {
  rank: number;
  title: string;
  artist: string;
  language: "ko" | "pop";
  reason: string;
  youtubeUrl: string;
  melonUrl: string;
};

// 공유 링크로도 보이는 Card. Diary 본문은 담지 않는다.
export type Card = {
  id: string;
  date: string;
  top: TopEmotion[];
  moodGroup: { name: string; color: string };
  songs: CardSong[];
};

export type Day = { date: string; text: string; scope: Scope; card: Card };

export type CalendarDay = { date: string; emotion: string; moodGroup: string; color: string };

export type WriteFailure = "empty" | "too_long" | "no_consent" | "daily_limit" | "analysis_failed" | "no_songs";

export type WriteResult = { ok: true; card: Card } | { ok: false; reason: WriteFailure };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDiaries(sql: Sql, analyzer: EmotionAnalyzer) {
  async function analyze(text: string): Promise<EmotionScores | null> {
    try {
      const raw = await analyzer.analyze(text);
      return raw ? sanitizeScores(raw as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  async function loadCard(where: { cardId: string } | { userId: string; date: string }): Promise<Card | null> {
    const rows =
      "cardId" in where
        ? await sql`
            SELECT c.id, d.date::text AS date, d.emotion_vector::text AS vector
            FROM cards c JOIN diaries d ON d.id = c.diary_id
            WHERE c.id = ${where.cardId}`
        : await sql`
            SELECT c.id, d.date::text AS date, d.emotion_vector::text AS vector
            FROM cards c JOIN diaries d ON d.id = c.diary_id
            WHERE d.user_id = ${where.userId} AND d.date = ${where.date}`;
    if (rows.length === 0) return null;
    const { id, date, vector } = rows[0];
    const songs = await sql`
      SELECT r.rank, r.reason, s.title, s.artist, s.language
      FROM recommendations r JOIN songs s ON s.id = r.song_id
      WHERE r.card_id = ${id}
      ORDER BY r.rank`;
    const top = topEmotions(fromVectorLiteral(vector));
    const group = moodGroupOf(top[0].emotion);
    return {
      id,
      date,
      top,
      moodGroup: { name: group.name, color: group.color },
      songs: songs.map((s) => ({
        rank: s.rank,
        title: s.title,
        artist: s.artist,
        language: s.language,
        reason: s.reason,
        ...listenLinks(s.title, s.artist),
      })),
    };
  }

  return {
    // Diary를 쓰거나(같은 날이면 고쳐 쓰고) 분석·추천해서 그날 Card를 돌려준다.
    async writeDiary(input: { userId: string; text: string; scope: Scope; now: Date }): Promise<WriteResult> {
      const text = input.text.trim();
      if (text.length === 0) return { ok: false, reason: "empty" };
      if (text.length > MAX_DIARY_LENGTH) return { ok: false, reason: "too_long" };

      const date = seoulDate(input.now);
      const users = await sql`
        SELECT consented_at,
               (SELECT count(*)::int FROM analysis_log WHERE user_id = u.id AND date = ${date}) AS analyses
        FROM users u WHERE id = ${input.userId}`;
      if (users.length === 0 || !users[0].consented_at) return { ok: false, reason: "no_consent" };
      if (users[0].analyses >= DAILY_ANALYSIS_LIMIT) return { ok: false, reason: "daily_limit" };
      await sql`INSERT INTO analysis_log (user_id, date) VALUES (${input.userId}, ${date})`;

      const scores = await analyze(text);
      if (!scores) return { ok: false, reason: "analysis_failed" };
      const vector = toVectorLiteral(scores);

      const candidates = await sql`
        SELECT id, emotion_vector::text AS vector, 1 - (emotion_vector <=> ${vector}::vector) AS similarity
        FROM songs
        WHERE ${input.scope} = 'all' OR language = ${input.scope}
        ORDER BY emotion_vector <=> ${vector}::vector, id
        LIMIT ${CANDIDATE_COUNT}`;
      if (candidates.length === 0) return { ok: false, reason: "no_songs" };

      const recent = await sql`
        SELECT DISTINCT r.song_id
        FROM recommendations r
        JOIN cards c ON c.id = r.card_id
        JOIN diaries d ON d.id = c.diary_id
        WHERE d.user_id = ${input.userId} AND d.date >= ${addDays(date, -RECENT_DAYS)} AND d.date < ${date}`;
      const picked = rankSongs(
        candidates.map((c) => ({ id: c.id as number, similarity: Number(c.similarity), vector: c.vector as string })),
        new Set(recent.map((r) => r.song_id as number)),
      );
      const reasons = picked.map((song) => recommendationReason(scores, fromVectorLiteral(song.vector)));

      // Card id는 처음 만들 때 정해지고, 같은 날 다시 써도 바뀌지 않는다.
      await sql.transaction([
        sql`
          WITH d AS (
            INSERT INTO diaries (user_id, date, text, scope, emotion_vector)
            VALUES (${input.userId}, ${date}, ${text}, ${input.scope}, ${vector}::vector)
            ON CONFLICT (user_id, date) DO UPDATE
              SET text = excluded.text, scope = excluded.scope,
                  emotion_vector = excluded.emotion_vector, analyzed_at = now()
            RETURNING id
          )
          INSERT INTO cards (diary_id) SELECT id FROM d ON CONFLICT (diary_id) DO NOTHING`,
        sql`
          DELETE FROM recommendations
          WHERE card_id = (SELECT c.id FROM cards c JOIN diaries d ON d.id = c.diary_id
                           WHERE d.user_id = ${input.userId} AND d.date = ${date})`,
        sql`
          INSERT INTO recommendations (card_id, rank, song_id, reason)
          SELECT c.id, r.rank, r.song_id, r.reason
          FROM cards c JOIN diaries d ON d.id = c.diary_id,
               unnest(${picked.map((_, i) => i + 1)}::smallint[], ${picked.map((s) => s.id)}::int[],
                      ${reasons}::text[]) AS r(rank, song_id, reason)
          WHERE d.user_id = ${input.userId} AND d.date = ${date}`,
        sql`UPDATE users SET last_scope = ${input.scope} WHERE id = ${input.userId}`,
      ]);

      const card = await loadCard({ userId: input.userId, date });
      return { ok: true, card: card! };
    },

    // 본인의 특정 날짜 Diary와 Card. 없으면 null.
    async getDay(userId: string, date: string): Promise<Day | null> {
      const rows = await sql`SELECT text, scope FROM diaries WHERE user_id = ${userId} AND date = ${date}`;
      if (rows.length === 0) return null;
      const card = await loadCard({ userId, date });
      if (!card) return null;
      return { date, text: rows[0].text, scope: rows[0].scope, card };
    },

    // 한 달 동안 Diary가 있는 날의 대표 Emotion과 Mood Group 색.
    async getCalendar(userId: string, year: number, month: number): Promise<CalendarDay[]> {
      const { start, end } = monthRange(year, month);
      const rows = await sql`
        SELECT date::text AS date, emotion_vector::text AS vector
        FROM diaries
        WHERE user_id = ${userId} AND date >= ${start} AND date < ${end}
        ORDER BY date`;
      return rows.map((row) => {
        const [top] = topEmotions(fromVectorLiteral(row.vector), 1);
        const group = moodGroupOf(top.emotion);
        return { date: row.date, emotion: top.emotion, moodGroup: group.name, color: group.color };
      });
    },

    // 로그인 없이 보는 공유 Card.
    async getSharedCard(cardId: string): Promise<Card | null> {
      if (!UUID.test(cardId)) return null;
      return loadCard({ cardId });
    },
  };
}

export type Diaries = ReturnType<typeof createDiaries>;

export function appDiaries(): Diaries {
  return createDiaries(getSql(), getEmotionAnalyzer());
}
