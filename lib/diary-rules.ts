// 화면(클라이언트)과 서버가 같이 쓰는 Diary 규칙. DB·AI 코드를 import하지 않는다.

export const SCOPES = [
  { id: "ko", label: "한국 노래" },
  { id: "pop", label: "팝송" },
  { id: "all", label: "둘 다" },
] as const;

export type Scope = (typeof SCOPES)[number]["id"];

export function isScope(value: unknown): value is Scope {
  return SCOPES.some((s) => s.id === value);
}

export const MAX_DIARY_LENGTH = 2000;
