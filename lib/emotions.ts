// Emotion 목록(초안). KOTE 감정 43개를 비슷한 것끼리 합쳐 정리했다.
// 이 배열의 순서가 Emotion Vector의 차원 순서다. 최종 목록은 데이터 담당이 확정한다.

export const MOOD_GROUPS = [
  { id: "joy", name: "기쁨·신남", color: "#F6C445" },
  { id: "love", name: "설렘·사랑", color: "#F28DB2" },
  { id: "sad", name: "슬픔·그리움", color: "#5B8DEF" },
  { id: "lonely", name: "외로움", color: "#8E7CC3" },
  { id: "anxious", name: "불안·걱정", color: "#E8925A" },
  { id: "angry", name: "짜증·분노", color: "#E05A5A" },
  { id: "tired", name: "피곤·무기력", color: "#9AA5B1" },
  { id: "relief", name: "후련함·위로", color: "#5DBB8A" },
] as const;

export type MoodGroupId = (typeof MOOD_GROUPS)[number]["id"];

export const EMOTIONS = [
  { name: "기쁨", group: "joy" },
  { name: "즐거움", group: "joy" },
  { name: "행복", group: "joy" },
  { name: "뿌듯함", group: "joy" },
  { name: "신기함", group: "joy" },
  { name: "설렘", group: "love" },
  { name: "기대감", group: "love" },
  { name: "사랑", group: "love" },
  { name: "고마움", group: "love" },
  { name: "슬픔", group: "sad" },
  { name: "그리움", group: "sad" },
  { name: "서러움", group: "sad" },
  { name: "서운함", group: "sad" },
  { name: "실망", group: "sad" },
  { name: "외로움", group: "lonely" },
  { name: "공허함", group: "lonely" },
  { name: "불안", group: "anxious" },
  { name: "두려움", group: "anxious" },
  { name: "당황", group: "anxious" },
  { name: "부담감", group: "anxious" },
  { name: "죄책감", group: "anxious" },
  { name: "짜증", group: "angry" },
  { name: "분노", group: "angry" },
  { name: "억울함", group: "angry" },
  { name: "어이없음", group: "angry" },
  { name: "피곤함", group: "tired" },
  { name: "무기력", group: "tired" },
  { name: "지루함", group: "tired" },
  { name: "절망", group: "tired" },
  { name: "후련함", group: "relief" },
  { name: "편안함", group: "relief" },
  { name: "안심", group: "relief" },
  { name: "감동", group: "relief" },
] as const satisfies readonly { name: string; group: MoodGroupId }[];

export type Emotion = (typeof EMOTIONS)[number]["name"];

export const EMOTION_NAMES: readonly Emotion[] = EMOTIONS.map((e) => e.name);

export type EmotionScores = Record<Emotion, number>;

export type TopEmotion = { emotion: Emotion; percent: number };

// 분석기가 준 값을 정리한다: 목록 밖 Emotion은 버리고 0~1로 자른다. 전부 0이면 null.
export function sanitizeScores(raw: Record<string, unknown>): EmotionScores | null {
  const scores = {} as EmotionScores;
  let any = false;
  for (const name of EMOTION_NAMES) {
    const value = Number(raw[name]);
    const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    scores[name] = clamped;
    if (clamped > 0) any = true;
  }
  return any ? scores : null;
}

// 상위 3개 Emotion을 합 100%가 되는 정수 비율로 만든다. 반올림 오차는 가장 큰 값에서 보정한다.
export function topEmotions(scores: EmotionScores, count = 3): TopEmotion[] {
  const top = EMOTION_NAMES.map((emotion) => ({ emotion, score: scores[emotion] }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
  const total = top.reduce((sum, e) => sum + e.score, 0);
  const result = top.map((e) => ({ emotion: e.emotion, percent: Math.round((e.score / total) * 100) }));
  const diff = 100 - result.reduce((sum, e) => sum + e.percent, 0);
  if (result.length > 0) result[0].percent += diff;
  return result;
}

export function moodGroupOf(emotion: Emotion) {
  const group = EMOTIONS.find((e) => e.name === emotion)!.group;
  return MOOD_GROUPS.find((g) => g.id === group)!;
}
