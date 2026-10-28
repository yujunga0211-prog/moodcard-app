import { Suspense } from "react";
import { PageLoading } from "../page-loading";
import { redirect } from "next/navigation";
import { currentUserId } from "@/auth";
import { appUsers } from "@/lib/users";
import { consent } from "../actions";
import { cardClass, primaryButtonClass } from "../ui";

export default function ConsentPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ConsentContent />
    </Suspense>
  );
}

async function ConsentContent() {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const user = await appUsers().getUser(userId);
  if (user?.consentedAt) redirect("/");

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <form action={consent} className={`${cardClass} flex flex-col gap-4`}>
        <h1 className="text-xl font-bold tracking-tight">시작하기 전에 알려 드려요</h1>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
          <li>
            <strong>일기 내용은 감정 분석을 위해 AI 서비스(OpenAI)로 전송됩니다.</strong>
          </li>
          <li>일기 본문은 나만 볼 수 있어요. 공유 링크에는 감정과 추천 노래만 보이고 본문은 보이지 않아요.</li>
          <li>노래 가사는 저장하거나 보여 주지 않아요. 제목·가수와 듣기 링크만 보여 줘요.</li>
        </ul>
        <button type="submit" className={`${primaryButtonClass} py-3`}>
          동의하고 시작하기
        </button>
      </form>
    </main>
  );
}
