import { EMOTION_NAMES, type EmotionScores } from "@/lib/emotions";

// 노래 추천 점수 공식 v1: score = cos(diary, song) − δ · recent(user, song)
// SP3에서 사용자 취향(β)·기분 흐름(γ) 항을 이 함수에 더한다.
export const RECENT_PENALTY = 0.2;

export type Candidate = { id: number; similarity: number };

export function rankSongs<T extends Candidate>(candidates: T[], recentSongIds: Set<number>, count = 3): T[] {
  return candidates
    .map((song) => ({ song, score: song.similarity - (recentSongIds.has(song.id) ? RECENT_PENALTY : 0) }))
    .sort((a, b) => b.score - a.score || a.song.id - b.song.id)
    .slice(0, count)
    .map((s) => s.song);
}

export function toVectorLiteral(scores: EmotionScores): string {
  return `[${EMOTION_NAMES.map((name) => scores[name]).join(",")}]`;
}

export function fromVectorLiteral(literal: string): EmotionScores {
  const values = literal.replace(/[[\]]/g, "").split(",").map(Number);
  return Object.fromEntries(EMOTION_NAMES.map((name, i) => [name, values[i] ?? 0])) as EmotionScores;
}

// Diary와 Song 양쪽에서 함께 높은 Emotion 2개로 추천 이유를 만든다. 예: "서운함·그리움이 비슷해요"
export function recommendationReason(diary: EmotionScores, song: EmotionScores): string {
  const shared = EMOTION_NAMES.map((name) => ({ name, weight: diary[name] * song[name] }))
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((e) => e.name);
  if (shared.length === 0) return "오늘 기분과 분위기가 어울려요";
  const last = shared[shared.length - 1];
  return `${shared.join("·")}${hasFinalConsonant(last) ? "이" : "가"} 비슷해요`;
}

function hasFinalConsonant(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

export function listenLinks(title: string, artist: string) {
  const query = encodeURIComponent(`${title} ${artist}`);
  return {
    youtubeUrl: `https://www.youtube.com/results?search_query=${query}`,
    melonUrl: `https://www.melon.com/search/total/index.htm?q=${query}`,
  };
}
