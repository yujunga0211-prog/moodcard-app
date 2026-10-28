"use client";

import { useState, useTransition } from "react";
import { MAX_DIARY_LENGTH, SCOPES, type Scope } from "@/lib/diary-rules";
import { writeDiary } from "./actions";
import { cardClass, inputClass, primaryButtonClass } from "./ui";

export function DiaryForm({
  initialText,
  initialScope,
  rewriting,
}: {
  initialText: string;
  initialScope: Scope;
  rewriting: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tooLong = text.length > MAX_DIARY_LENGTH;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await writeDiary({ text, scope });
      setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className={`${cardClass} flex flex-col gap-4`}>
      <div>
        <label htmlFor="diary" className="text-lg font-bold tracking-tight">
          오늘 하루는 어땠나요?
        </label>
        <p className="mt-1 text-sm text-muted">
          {rewriting
            ? "오늘 쓴 일기를 고쳐 쓰면 다시 분석해요. 공유 링크는 그대로예요."
            : "편하게 적어 주세요. 일기는 나만 볼 수 있어요."}
        </p>
      </div>
      <textarea
        id="diary"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="시험은 끝났는데 결과가 무서워서 신나지도 우울하지도 않은 하루였다…"
        aria-invalid={tooLong}
        disabled={pending}
        className={`${inputClass} resize-y leading-relaxed`}
      />
      <p
        className={`-mt-2 text-right text-xs tabular-nums ${tooLong ? "text-red-600 dark:text-red-400" : "text-muted"}`}
      >
        {text.length.toLocaleString()} / {MAX_DIARY_LENGTH.toLocaleString()}
      </p>

      <fieldset>
        <legend className="text-sm font-semibold">추천받을 노래</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SCOPES.map((s) => (
            <label
              key={s.id}
              className="cursor-pointer rounded-xl border border-line px-3 py-2 text-center text-sm transition hover:border-accent/50 has-checked:border-accent has-checked:bg-accent-soft has-checked:font-semibold has-checked:text-accent"
            >
              <input
                type="radio"
                name="scope"
                value={s.id}
                checked={scope === s.id}
                onChange={() => setScope(s.id)}
                disabled={pending}
                className="sr-only"
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || tooLong} className={`${primaryButtonClass} w-full py-3`}>
        {pending ? "AI가 기분을 읽는 중…" : rewriting ? "다시 분석하기" : "기분 분석하고 노래 추천받기"}
      </button>
    </form>
  );
}
