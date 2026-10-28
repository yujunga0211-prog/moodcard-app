import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // .env.local 등에서 TEST_DATABASE_URL을 읽어 globalSetup과 테스트 모두에서 쓰게 한다.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) process.env[key] ??= value;

  return {
    resolve: { tsconfigPaths: true },
    test: {
      environment: "node",
      globalSetup: ["./db/test-global-setup.ts"],
      // 모든 테스트 파일이 같은 테스트 DB를 비우고 쓰므로 순차 실행한다.
      fileParallelism: false,
      testTimeout: 20_000,
      hookTimeout: 60_000,
    },
  };
});
