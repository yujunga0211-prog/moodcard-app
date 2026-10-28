import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testSql } from "@/db/test-db";
import { createDiaries, DAILY_ANALYSIS_LIMIT, MAX_DIARY_LENGTH, type Scope } from "@/lib/diaries";
import type { EmotionAnalyzer } from "@/lib/emotion-analyzer";
import { EMOTION_NAMES, MOOD_GROUPS, type Emotion, type EmotionScores } from "@/lib/emotions";
import { createUsers } from "@/lib/users";

// 2026-11-03 12:00 KST
const NOW = new Date("2026-11-03T03:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function scores(partial: Partial<Record<Emotion, number>>): EmotionScores {
  return Object.fromEntries(EMOTION_NAMES.map((n) => [n, partial[n] ?? 0])) as EmotionScores;
}

function vector(partial: Partial<Record<Emotion, number>>): string {
  const s = scores(partial);
  return `[${EMOTION_NAMES.map((n) => s[n]).join(",")}]`;
}

// 일기 본문에 따라 정해 둔 점수를 돌려주는 가짜 분석기.
function fakeAnalyzer(byText: Record<string, unknown> = {}, fallback: Partial<Record<Emotion, number>> = { 슬픔: 0.9, 그리움: 0.6, 외로움: 0.3 }): EmotionAnalyzer {
  return {
    async analyze(text) {
      if (text in byText) {
        const value = byText[text];
        if (value instanceof Error) throw value;
        return value as EmotionScores | null;
      }
      return scores(fallback);
    },
  };
}

async function addSong(title: string, language: "ko" | "pop", emotions: Partial<Record<Emotion, number>>) {
  await testSql`
    INSERT INTO songs (title, artist, language, emotion_vector)
    VALUES (${title}, ${"가수 " + title}, ${language}, ${vector(emotions)}::vector)`;
}

async function addUser(googleId = "g-1", consent = true) {
  const users = createUsers(testSql);
  const id = await users.upsertGoogleUser({ googleId, email: `${googleId}@example.com`, name: googleId });
  if (consent) await users.giveConsent(id);
  return id;
}

async function write(diaries: ReturnType<typeof createDiaries>, userId: string, text = "오늘은 좀 슬펐다", scope: Scope = "all", now = NOW) {
  return diaries.writeDiary({ userId, text, scope, now });
}

describe("writeDiary", () => {
  beforeEach(async () => {
    await resetDb();
    await addSong("슬픈 노래 1", "ko", { 슬픔: 0.9, 그리움: 0.7 });
    await addSong("슬픈 노래 2", "ko", { 슬픔: 0.8, 외로움: 0.5 });
    await addSong("슬픈 팝송", "pop", { 슬픔: 0.9, 그리움: 0.5 });
    await addSong("신나는 노래", "ko", { 기쁨: 0.9, 즐거움: 0.8 });
    await addSong("신나는 팝송", "pop", { 기쁨: 0.9, 즐거움: 0.8 });
    await addSong("화나는 노래", "ko", { 분노: 0.9, 짜증: 0.7 });
  });

  it("makes a Card with the top 3 Emotions and 3 Songs that fit the diary", async () => {
    const userId = await addUser();
    const result = await write(createDiaries(testSql, fakeAnalyzer()), userId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { card } = result;
    expect(card.date).toBe("2026-11-03");
    expect(card.top.map((t) => t.emotion)).toEqual(["슬픔", "그리움", "외로움"]);
    expect(card.top.reduce((sum, t) => sum + t.percent, 0)).toBe(100);
    expect(card.moodGroup.name).toBe("슬픔·그리움");
    expect(card.songs.map((s) => s.title)).toEqual(["슬픈 노래 1", "슬픈 팝송", "슬픈 노래 2"]);
    expect(card.songs.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(card.songs[0].reason).toBe("슬픔·그리움이 비슷해요");
    expect(card.songs[0].youtubeUrl).toContain("youtube.com/results?search_query=");
    expect(card.songs[0].melonUrl).toContain("melon.com");
  });

  it("recommends only Songs in the chosen scope", async () => {
    const userId = await addUser();
    const diaries = createDiaries(testSql, fakeAnalyzer());

    const pop = await write(diaries, userId, "팝송만", "pop");
    expect(pop.ok && pop.card.songs.every((s) => s.language === "pop")).toBe(true);
    expect(pop.ok && pop.card.songs).toHaveLength(2);

    const ko = await write(diaries, userId, "한국 노래만", "ko");
    expect(ko.ok && ko.card.songs.every((s) => s.language === "ko")).toBe(true);
  });

  it("rewrites the same day's Diary and keeps the Card id", async () => {
    const userId = await addUser();
    const diaries = createDiaries(testSql, fakeAnalyzer({ "다시 생각해 보니 신났다": scores({ 기쁨: 1, 즐거움: 0.5 }) }));

    const first = await write(diaries, userId, "슬펐다");
    const second = await write(diaries, userId, "다시 생각해 보니 신났다");

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.card.id).toBe(first.card.id);
    expect(second.card.top[0].emotion).toBe("기쁨");
    expect(second.card.songs[0].title).toMatch(/신나는/);
    const [{ count }] = await testSql`SELECT count(*)::int AS count FROM diaries`;
    expect(count).toBe(1);
    const day = await diaries.getDay(userId, "2026-11-03");
    expect(day?.text).toBe("다시 생각해 보니 신났다");
  });

  it("splits days at midnight Korean time", async () => {
    const userId = await addUser();
    const diaries = createDiaries(testSql, fakeAnalyzer());

    const late = await write(diaries, userId, "밤 11시 59분", "all", new Date("2026-11-03T14:59:59Z"));
    const midnight = await write(diaries, userId, "자정", "all", new Date("2026-11-03T15:00:00Z"));

    expect(late.ok && late.card.date).toBe("2026-11-03");
    expect(midnight.ok && midnight.card.date).toBe("2026-11-04");
  });

  it("does not repeat Songs recommended in the last 7 days when similar ones exist", async () => {
    await addSong("비슷한 노래 A", "ko", { 슬픔: 0.85, 그리움: 0.6 });
    await addSong("비슷한 노래 B", "ko", { 슬픔: 0.8, 그리움: 0.55 });
    await addSong("비슷한 노래 C", "pop", { 슬픔: 0.8, 외로움: 0.4 });
    const userId = await addUser();
    const diaries = createDiaries(testSql, fakeAnalyzer());

    const yesterday = await write(diaries, userId, "어제", "all", new Date(NOW.getTime() - DAY));
    const today = await write(diaries, userId, "오늘");

    expect(yesterday.ok && today.ok).toBe(true);
    if (!yesterday.ok || !today.ok) return;
    const before = yesterday.card.songs.map((s) => s.title);
    const after = today.card.songs.map((s) => s.title);
    expect(after.some((title) => before.includes(title))).toBe(false);
  });

  it("cleans Emotions the analyzer made up or scored out of range", async () => {
    const userId = await addUser();
    const diaries = createDiaries(testSql, fakeAnalyzer({ 이상한: { 없는감정: 1, 불안: 3, 슬픔: -1 } }));

    const result = await write(diaries, userId, "이상한");

    expect(result.ok && result.card.top).toEqual([{ emotion: "불안", percent: 100 }]);
  });

  it("saves nothing when the analysis fails", async () => {
    const userId = await addUser();
    const diaries = createDiaries(
      testSql,
      fakeAnalyzer({ 영점: scores({}), 오류: new Error("timeout"), 없음: null }),
    );

    for (const text of ["영점", "오류", "없음"]) {
      expect(await write(diaries, userId, text)).toEqual({ ok: false, reason: "analysis_failed" });
    }
    const [{ count }] = await testSql`SELECT count(*)::int AS count FROM diaries`;
    expect(count).toBe(0);
  });

  it("rejects an empty or too long Diary", async () => {
    const userId = await addUser();
    const diaries = createDiaries(testSql, fakeAnalyzer());

    expect(await write(diaries, userId, "   ")).toEqual({ ok: false, reason: "empty" });
    expect(await write(diaries, userId, "가".repeat(MAX_DIARY_LENGTH + 1))).toEqual({ ok: false, reason: "too_long" });
    expect((await write(diaries, userId, "가".repeat(MAX_DIARY_LENGTH))).ok).toBe(true);
  });

  it("requires consent before writing", async () => {
    const userId = await addUser("g-new", false);
    const result = await write(createDiaries(testSql, fakeAnalyzer()), userId);
    expect(result).toEqual({ ok: false, reason: "no_consent" });
  });

  it("stops analysing after the daily limit and starts again the next day", async () => {
    const userId = await addUser();
    const diaries = createDiaries(testSql, fakeAnalyzer());

    for (let i = 0; i < DAILY_ANALYSIS_LIMIT; i++) {
      expect((await write(diaries, userId, `시도 ${i}`)).ok).toBe(true);
    }
    expect(await write(diaries, userId, "한 번 더")).toEqual({ ok: false, reason: "daily_limit" });
    expect((await write(diaries, userId, "다음 날", "all", new Date(NOW.getTime() + DAY))).ok).toBe(true);
  }, 120_000);

  it("reports when there are no Songs to recommend", async () => {
    await testSql`TRUNCATE songs RESTART IDENTITY CASCADE`;
    const userId = await addUser();
    expect(await write(createDiaries(testSql, fakeAnalyzer()), userId)).toEqual({ ok: false, reason: "no_songs" });
  });
});

describe("reading Cards and the calendar", () => {
  beforeEach(async () => {
    await resetDb();
    await addSong("슬픈 노래", "ko", { 슬픔: 0.9 });
    await addSong("신나는 노래", "ko", { 기쁨: 0.9 });
    await addSong("화나는 노래", "ko", { 분노: 0.9 });
  });

  it("shows a shared Card without the Diary text, and nothing for unknown ids", async () => {
    const userId = await addUser();
    const diaries = createDiaries(testSql, fakeAnalyzer());
    const written = await write(diaries, userId, "아무도 보면 안 되는 비밀 일기");
    if (!written.ok) throw new Error("write failed");

    const shared = await diaries.getSharedCard(written.card.id);

    expect(shared).toEqual(written.card);
    expect(JSON.stringify(shared)).not.toContain("비밀 일기");
    expect(await diaries.getSharedCard("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await diaries.getSharedCard("not-a-uuid")).toBeNull();
  });

  it("colors only the days that have a Diary, and only the User's own", async () => {
    const me = await addUser("g-me");
    const other = await addUser("g-other");
    const diaries = createDiaries(
      testSql,
      fakeAnalyzer({ 신남: scores({ 기쁨: 1 }), 화남: scores({ 분노: 1 }) }),
    );
    await write(diaries, me, "신남", "all", new Date("2026-11-01T03:00:00Z"));
    await write(diaries, me, "화남", "all", new Date("2026-11-15T03:00:00Z"));
    await write(diaries, me, "신남", "all", new Date("2026-12-01T03:00:00Z"));
    await write(diaries, other, "화남", "all", new Date("2026-11-02T03:00:00Z"));

    const calendar = await diaries.getCalendar(me, 2026, 11);

    const joy = MOOD_GROUPS.find((g) => g.id === "joy")!;
    const angry = MOOD_GROUPS.find((g) => g.id === "angry")!;
    expect(calendar).toEqual([
      { date: "2026-11-01", emotion: "기쁨", moodGroup: joy.name, color: joy.color },
      { date: "2026-11-15", emotion: "분노", moodGroup: angry.name, color: angry.color },
    ]);
  });

  it("returns a day's Diary only to its owner", async () => {
    const me = await addUser("g-me");
    const other = await addUser("g-other");
    const diaries = createDiaries(testSql, fakeAnalyzer());
    await write(diaries, me, "내 일기");

    expect((await diaries.getDay(me, "2026-11-03"))?.text).toBe("내 일기");
    expect(await diaries.getDay(other, "2026-11-03")).toBeNull();
    expect(await diaries.getDay(me, "2026-11-04")).toBeNull();
  });
});
