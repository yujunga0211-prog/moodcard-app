import { neon } from "@neondatabase/serverless";
import type { Sql } from "@/lib/db";

// 테스트 전용 DB 클라이언트. globalSetup이 TEST_DATABASE_URL 존재와 마이그레이션을 보장한다.
export const testSql: Sql = neon(process.env.TEST_DATABASE_URL!);

export async function resetDb() {
  await testSql`TRUNCATE users, songs, diaries, cards, recommendations, analysis_log RESTART IDENTITY CASCADE`;
}
