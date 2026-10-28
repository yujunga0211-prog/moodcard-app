import OpenAI from "openai";
import { EMOTION_NAMES, sanitizeScores, type Emotion, type EmotionScores } from "@/lib/emotions";

// Diary 본문(또는 노래 설명)을 받아 Emotion별 0~1 점수를 돌려준다. 실패하면 null.
export interface EmotionAnalyzer {
  analyze(text: string): Promise<EmotionScores | null>;
}

const SYSTEM_PROMPT = `너는 한국어 감정 분석기다. 사용자가 쓴 일기를 읽고, 주어진 감정 목록의 각 감정이 글에 얼마나 드러나는지 0~1 사이 점수로 매긴다.
- 드러나지 않는 감정은 0으로 둔다. 보통 2~5개 감정만 0보다 크다.
- 가장 강한 감정일수록 1에 가깝게 준다.
- 목록에 없는 감정은 만들지 않는다.`;

// 노래는 가사를 저장하지 않으므로 제목·가수만 주고, 모델이 아는 가사와 분위기로 감정을 매기게 한다.
export const SONG_PROMPT = `너는 노래 감정 분석기다. 노래 제목과 가수를 받으면, 그 노래의 가사와 분위기가 듣는 사람에게 전하는 감정을 주어진 감정 목록의 각 감정마다 0~1 사이 점수로 매긴다.
- 드러나지 않는 감정은 0으로 둔다. 보통 2~5개 감정만 0보다 크다.
- 잘 모르는 노래면 제목과 가수의 대표적인 분위기로 추정한다.
- 목록에 없는 감정은 만들지 않는다.`;

const SCHEMA = {
  type: "object",
  properties: Object.fromEntries(EMOTION_NAMES.map((name) => [name, { type: "number" }])),
  required: [...EMOTION_NAMES],
  additionalProperties: false,
};

export function createOpenAIAnalyzer(options: { client: OpenAI; model: string; systemPrompt?: string }): EmotionAnalyzer {
  const { client, model, systemPrompt = SYSTEM_PROMPT } = options;

  async function callOnce(text: string): Promise<EmotionScores | null> {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "emotion_scores", schema: SCHEMA, strict: true },
      },
    });
    const content = completion.choices[0]?.message.content;
    if (!content) return null;
    return sanitizeScores(JSON.parse(content));
  }

  return {
    async analyze(text) {
      // 오류·형식 위반이면 한 번 다시 시도한다.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const scores = await callOnce(text);
          if (scores) return scores;
        } catch (error) {
          if (attempt === 1) throw error;
        }
      }
      return null;
    },
  };
}

// OPENAI_API_KEY가 없는 개발·테스트 환경용. 같은 글이면 항상 같은 결과를 준다.
const KEYWORDS: Partial<Record<Emotion, string[]>> = {
  기쁨: ["기뻐", "기쁘", "좋았", "좋아"],
  즐거움: ["재밌", "재미있", "신나", "신났"],
  행복: ["행복"],
  뿌듯함: ["뿌듯", "해냈"],
  설렘: ["설레", "두근"],
  기대감: ["기대"],
  사랑: ["사랑", "좋아해"],
  고마움: ["고마", "감사"],
  슬픔: ["슬퍼", "슬프", "울었", "눈물"],
  그리움: ["그리", "보고 싶", "보고싶"],
  서운함: ["서운"],
  실망: ["실망"],
  외로움: ["외로", "혼자"],
  공허함: ["허전", "공허"],
  불안: ["불안", "걱정", "무서"],
  두려움: ["두려", "겁나"],
  부담감: ["부담", "압박"],
  짜증: ["짜증", "귀찮"],
  분노: ["화나", "화가", "열받"],
  억울함: ["억울"],
  피곤함: ["피곤", "졸려", "지쳤", "힘들"],
  무기력: ["무기력", "아무것도 하기 싫"],
  지루함: ["지루", "심심"],
  후련함: ["후련", "끝났", "시원"],
  편안함: ["편안", "여유"],
  안심: ["다행", "안심"],
  감동: ["감동"],
};

export const fakeAnalyzer: EmotionAnalyzer = {
  async analyze(text) {
    const raw: Record<string, number> = {};
    for (const [emotion, words] of Object.entries(KEYWORDS)) {
      const hits = words!.filter((w) => text.includes(w)).length;
      if (hits > 0) raw[emotion] = Math.min(1, 0.4 + 0.3 * hits);
    }
    return sanitizeScores(Object.keys(raw).length > 0 ? raw : { 편안함: 0.3 });
  },
};

export function getEmotionAnalyzer(): EmotionAnalyzer {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    return fakeAnalyzer;
  }
  return createOpenAIAnalyzer({
    client: new OpenAI({ apiKey }),
    model: process.env.OPENAI_MODEL ?? DEFAULT_TEXT_MODEL,
  });
}

export const DEFAULT_TEXT_MODEL = "gpt-5.4-mini";
