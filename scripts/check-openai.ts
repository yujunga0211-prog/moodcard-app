// OpenAI API 키가 무드카드에 필요한 기능(감정 분석, 짤 이미지)에 쓸 수 있는지 확인한다.
//   npm run check:openai           → 키 확인, 쓸 수 있는 모델 조회, 일기 감정 분석 3번
//   npm run check:openai -- --image → 위 확인 + 짤 이미지 1장 생성(저화질, 약 몇 원)
import { mkdirSync, writeFileSync } from "node:fs";
import OpenAI from "openai";
import { createOpenAIAnalyzer } from "@/lib/emotion-analyzer";
import { moodGroupOf, topEmotions } from "@/lib/emotions";

const TEXT_MODEL_PREFERENCE = ["gpt-5.4-mini", "gpt-5.4-nano", "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"];
const IMAGE_MODEL_PREFERENCE = ["gpt-image-1-mini", "gpt-image-2.5-flare", "gpt-image-2", "gpt-image-1.5"];

const SAMPLE_DIARIES = [
  "시험은 끝났는데 결과가 너무 무서워. 후련하면서도 불안하고, 그냥 피곤해서 아무것도 하기 싫다.",
  "오랜만에 친구들이랑 바다에 갔다. 하루 종일 웃고 떠들어서 너무 행복했고 사진도 잔뜩 찍었다.",
  "팀플에서 나만 일한 것 같아서 억울하고 짜증났다. 다들 연락도 안 받고 정말 어이가 없다.",
];

function pick(available: Set<string>, preference: string[], override?: string) {
  if (override) return available.has(override) ? override : null;
  return preference.find((m) => available.has(m)) ?? null;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY가 없습니다. 프로젝트 폴더의 .env.local 파일에 OPENAI_API_KEY=... 를 넣어 주세요.");
    process.exit(1);
  }
  const client = new OpenAI({ apiKey });

  // 1. 키가 유효한지, 어떤 모델을 쓸 수 있는지
  let available: Set<string>;
  try {
    const models = [];
    for await (const model of client.models.list()) models.push(model.id);
    available = new Set(models);
    console.log(`✅ 키가 유효합니다. 쓸 수 있는 모델 ${models.length}개`);
  } catch (error) {
    console.error("❌ 키로 모델 목록을 가져오지 못했습니다:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const textModel = pick(available, TEXT_MODEL_PREFERENCE, process.env.OPENAI_MODEL);
  const imageModel = pick(available, IMAGE_MODEL_PREFERENCE, process.env.OPENAI_IMAGE_MODEL);
  console.log(`   감정 분석 모델: ${textModel ?? "❌ 후보 중 쓸 수 있는 모델 없음"}`);
  console.log(`   짤 이미지 모델: ${imageModel ?? "❌ 후보 중 쓸 수 있는 모델 없음"}`);
  if (!textModel) {
    const gpt = [...available].filter((m) => m.startsWith("gpt")).sort();
    console.log("   이 키로 쓸 수 있는 gpt 모델:", gpt.join(", ") || "(없음)");
    process.exit(1);
  }

  // 2. 감정 분석
  console.log("\n── 감정 분석 테스트 ──");
  const analyzer = createOpenAIAnalyzer({ client, model: textModel });
  for (const diary of SAMPLE_DIARIES) {
    const started = Date.now();
    try {
      const scores = await analyzer.analyze(diary);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (!scores) {
        console.log(`❌ "${diary.slice(0, 20)}…" → 분석 결과가 비어 있음`);
        continue;
      }
      const top = topEmotions(scores);
      const summary = top.map((t) => `${t.emotion} ${t.percent}%`).join(" · ");
      console.log(`✅ "${diary.slice(0, 24)}…"\n   → ${summary}  (대표 색: ${moodGroupOf(top[0].emotion).name}, ${seconds}초)`);
    } catch (error) {
      console.log(`❌ "${diary.slice(0, 20)}…" → 오류:`, error instanceof Error ? error.message : error);
    }
  }

  // 3. 짤 이미지 (선택)
  if (!process.argv.includes("--image")) {
    console.log("\n짤 이미지 생성까지 확인하려면: npm run check:openai -- --image");
    return;
  }
  if (!imageModel) {
    console.log("\n❌ 이미지 모델을 쓸 수 없어서 짤 생성은 확인하지 못했습니다.");
    return;
  }
  console.log("\n── 짤 이미지 테스트 ──");
  try {
    const image = await client.images.generate({
      model: imageModel,
      prompt:
        "A cute round white cat character sitting at a desk with a finished exam paper, looking relieved but slightly nervous, simple flat illustration, pastel background, meme style, no text",
      size: "1024x1024",
      quality: "low",
      n: 1,
    });
    const b64 = image.data?.[0]?.b64_json;
    if (!b64) throw new Error("이미지 데이터가 비어 있음");
    mkdirSync("tmp", { recursive: true });
    writeFileSync("tmp/check-image.png", Buffer.from(b64, "base64"));
    console.log("✅ 짤 이미지 생성 성공 → tmp/check-image.png");
  } catch (error) {
    console.log("❌ 짤 이미지 생성 실패:", error instanceof Error ? error.message : error);
  }
}

main();
