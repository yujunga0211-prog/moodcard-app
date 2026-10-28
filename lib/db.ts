import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

let appSql: Sql | undefined;

// 앱이 쓰는 DB 클라이언트. 첫 사용 시 DATABASE_URL로 만든다(빌드 시점에 env가 없어도 import는 가능).
export function getSql(): Sql {
  if (!appSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    appSql = neon(url);
  }
  return appSql;
}
