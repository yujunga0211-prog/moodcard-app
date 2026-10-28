"use client";

import { useState } from "react";
import { secondaryButtonClass } from "./ui";

export function ShareButton({ cardId }: { cardId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/card/${cardId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("이 링크를 복사해 주세요", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-muted">공유 링크에는 일기 본문이 보이지 않아요.</p>
      <button type="button" onClick={copy} className={`${secondaryButtonClass} shrink-0 whitespace-nowrap`}>
        {copied ? "✓ 복사했어요" : "🔗 공유 링크 복사"}
      </button>
    </div>
  );
}
