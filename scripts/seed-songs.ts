// 노래 목록 CSV(data/songs.csv)를 읽어 Song을 DB에 넣는다. 같은 (제목, 가수)는 갱신한다.
//   npm run seed:songs                 → DATABASE_URL에 넣기
//   npm run seed:songs -- --test       → TEST_DATABASE_URL에 넣기
// 확인(O/X) 칸이 X인 곡은 건너뛴다. 가사는 저장하지 않고 Emotion Vector만 저장한다.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";
import { createOpenAIAnalyzer, DEFAULT_TEXT_MODEL, SONG_PROMPT } from "@/lib/emotion-analyzer";
import { EMOTIONS, EMOTION_NAMES, MOOD_GROUPS, type EmotionScores } from "@/lib/emotions";
import { toVectorLiteral } from "@/lib/recommend";

type SongRow = { title: string; artist: string; language: "ko" | "pop"; groupId: string };

const NEWLINE = String.fromCharCode(10);
const CARRIAGE_RETURN = String.fromCharCode(13);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

// 따옴표로 감싼 칸(쉼표 포함)을 처리하는 최소한의 CSV 파서.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === NEWLINE || ch === CARRIAGE_RETURN) {
      if (ch === CARRIAGE_RETURN && text[i + 1] === NEWLINE) i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field || row.length) endRow();
  return rows.filter((r) => r.some((f) => f.trim()));
}

function readSongs(path: string): SongRow[] {
  let text = readFileSync(path, "utf8");
  if (text.startsWith(BYTE_ORDER_MARK)) text = text.slice(1);
  const [header, ...rows] = parseCsv(text);
  const col = (name: string) => header.findIndex((h) => h.startsWith(name));
  const [group, title, artist, language, checked] = ["감정 묶음", "제목", "가수", "언어", "확인"].map(col);
  return rows
    .filter((r) => r[checked]?.trim().toUpperCase() !== "X")
    .map((r) => {
      const groupId = MOOD_GROUPS.find((g) => g.name === r[group].trim())?.id;
      if (!groupId) throw new Error(`알 수 없는 감정 묶음: ${r[group]} (${r[title]})`);
      return {
        title: r[title].trim(),
        artist: r[artist].trim(),
        language: r[language].trim() === "팝송" ? "pop" : "ko",
        groupId,
      };
    });
}

// 사람이 정한 감정 묶음으로 만든 기본 벡터. LLM 결과와 섞어서 묶음에서 크게 벗어나지 않게 한다.
function groupVector(groupId: string): EmotionScores {
  return Object.fromEntries(
    EMOTION_NAMES.map((name) => [name, EMOTIONS.find((e) => e.name === name)!.group === groupId ? 0.6 : 0]),
  ) as EmotionScores;
}

function blend(llm: EmotionScores | null, base: EmotionScores): EmotionScores {
  if (!llm) return base;
  return Object.fromEntries(EMOTION_NAMES.map((n) => [n, 0.7 * llm[n] + 0.3 * base[n]])) as EmotionScores;
}

async function main() {
  const url = process.argv.includes("--test") ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error("DB 주소가 없습니다.");
  const sql = neon(url);
  const songs = readSongs("data/songs.csv");
  const apiKey = process.env.OPENAI_API_KEY;
  const analyzer = apiKey
    ? createOpenAIAnalyzer({
        client: new OpenAI({ apiKey }),
        model: process.env.OPENAI_MODEL || DEFAULT_TEXT_MODEL,
        systemPrompt: SONG_PROMPT,
      })
    : null;
  console.log(`노래 ${songs.length}곡을 넣습니다. ${analyzer ? "(LLM으로 감정 분석)" : "(키 없음: 감정 묶음 기본 벡터)"}`);

  let done = 0;
  const queue = [...songs];
  async function worker() {
    for (let song = queue.shift(); song; song = queue.shift()) {
      let llm: EmotionScores | null = null;
      try {
        llm = analyzer ? await analyzer.analyze(`노래: ${song.title} - ${song.artist}`) : null;
      } catch (error) {
        console.warn(`  ⚠ ${song.title}: 분석 실패, 기본 벡터 사용 (${error instanceof Error ? error.message : error})`);
      }
      const vector = toVectorLiteral(blend(llm, groupVector(song.groupId)));
      await sql`
        INSERT INTO songs (title, artist, language, emotion_vector)
        VALUES (${song.title}, ${song.artist}, ${song.language}, ${vector}::vector)
        ON CONFLICT (title, artist) DO UPDATE SET language = excluded.language, emotion_vector = excluded.emotion_vector`;
      done++;
      if (done % 25 === 0 || done === songs.length) console.log(`  ${done}/${songs.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM songs`;
  console.log(`완료. DB의 노래 수: ${count}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
