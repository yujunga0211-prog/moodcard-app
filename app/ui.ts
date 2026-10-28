// 화면 공통 스타일. 색은 globals.css의 토큰(surface, line, muted, accent)만 쓴다.
export const cardClass = "rounded-2xl border border-line bg-surface p-6 shadow-sm";

export const inputClass =
  "rounded-xl border border-line bg-background px-3.5 py-2.5 outline-none transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/15 aria-invalid:border-red-500";

export const primaryButtonClass =
  "rounded-xl bg-accent px-5 py-2.5 font-semibold text-on-accent shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

export const secondaryButtonClass =
  "rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent/50 hover:text-accent";
