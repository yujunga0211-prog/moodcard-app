import { migrate } from "./migrate.mjs";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. 테스트는 테이블을 비우므로 개발 DB가 아닌 Neon 테스트 브랜치를 가리켜야 한다.",
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL.");
  }
  await migrate(url);
}
