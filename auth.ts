import { connection } from "next/server";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { appUsers } from "@/lib/users";

// 구글 OAuth 키가 없는 개발 환경에서 흐름을 확인하기 위한 로그인. production에서는 절대 켜지지 않는다.
export const devLoginEnabled = process.env.NODE_ENV !== "production";
export const googleLoginEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const devLogin = Credentials({
  id: "dev",
  name: "개발용 로그인",
  credentials: { name: { label: "이름" } },
  authorize: async (credentials) => {
    const name = String(credentials?.name || "테스터").slice(0, 20);
    return { id: `dev:${name}`, name, email: null };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [...(googleLoginEnabled ? [Google] : []), ...(devLoginEnabled ? [devLogin] : [])],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    // 로그인 순간에만 account가 있다. 그때 우리 users 테이블의 User id를 토큰에 넣는다.
    async jwt({ token, account, user }) {
      if (account) {
        const googleId = account.provider === "google" ? account.providerAccountId : String(user.id);
        token.userId = await appUsers().upsertGoogleUser({
          googleId,
          email: user.email ?? null,
          name: user.name ?? null,
        });
      }
      return token;
    },
    session({ session, token }) {
      (session.user as { id?: string }).id = token.userId as string;
      return session;
    },
  },
});

// 로그인한 User의 id. 로그인하지 않았으면 null.
export async function currentUserId(): Promise<string | null> {
  // 세션 읽기는 요청마다 달라서 미리 렌더링할 수 없다. Auth.js가 쿠키를 읽기 전에 crypto를 쓰기 때문에 먼저 표시한다.
  await connection();
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}
