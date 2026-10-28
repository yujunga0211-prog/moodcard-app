import { getSql, type Sql } from "@/lib/db";
import type { Scope } from "@/lib/diaries";

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  consentedAt: Date | null;
  lastScope: Scope;
};

export function createUsers(sql: Sql) {
  return {
    // 로그인할 때 구글 계정 고유 id 기준으로 User를 만들거나 이메일·이름을 갱신한다.
    async upsertGoogleUser(input: { googleId: string; email: string | null; name: string | null }): Promise<string> {
      const rows = await sql`
        INSERT INTO users (google_id, email, name)
        VALUES (${input.googleId}, ${input.email}, ${input.name})
        ON CONFLICT (google_id) DO UPDATE SET email = excluded.email, name = excluded.name
        RETURNING id`;
      return rows[0].id as string;
    },

    async getUser(id: string): Promise<User | null> {
      const rows = await sql`
        SELECT id, name, email, consented_at, last_scope FROM users WHERE id = ${id}`;
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        consentedAt: row.consented_at ? new Date(row.consented_at) : null,
        lastScope: row.last_scope,
      };
    },

    async giveConsent(id: string): Promise<void> {
      await sql`UPDATE users SET consented_at = now() WHERE id = ${id} AND consented_at IS NULL`;
    },
  };
}

export type Users = ReturnType<typeof createUsers>;

export function appUsers(): Users {
  return createUsers(getSql());
}
