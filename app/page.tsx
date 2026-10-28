import { Suspense } from "react";
import { PageLoading } from "./page-loading";
import { redirect } from "next/navigation";
import { currentUserId, devLoginEnabled, googleLoginEnabled } from "@/auth";
import { seoulDate } from "@/lib/dates";
import { appDiaries } from "@/lib/diaries";
import { appUsers } from "@/lib/users";
import { loginForDev, loginWithGoogle } from "./actions";
import { CardView } from "./card-view";
import { DiaryForm } from "./diary-form";
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";

export default function Home() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const userId = await currentUserId();
  const user = userId ? await appUsers().getUser(userId) : null;
  if (!user) return <Landing />;
  if (!user.consentedAt) redirect("/consent");

  const day = await appDiaries().getDay(user.id, today());
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <DiaryForm initialText={day?.text ?? ""} initialScope={day?.scope ?? user.lastScope} rewriting={Boolean(day)} />
      {day && <CardView card={day.card} shareable />}
    </main>
  );
}

// 요청 시각의 한국 날짜. 렌더링 중 new Date() 직접 호출은 react-hooks/purity lint에 걸려서 함수로 감쌌다.
function today(): string {
  return seoulDate(new Date());
}

const STEPS = [
  ["✍️", "오늘의 일기를 써요"],
  ["🧠", "AI가 감정을 세세하게 읽어요"],
  ["🎧", "가사 감정이 비슷한 노래 3곡을 추천받아요"],
  ["📅", "감정 색으로 칠해진 캘린더에 쌓여요"],
  ["🔗", "링크로 친구에게 오늘 기분을 보내요"],
];

function Landing() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <section className="text-center">
        <p className="text-sm font-semibold text-accent">AI 기분 일기장</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          오늘의 기분을
          <br />
          노래로 남겨요
        </h1>
        <p className="mt-3 text-muted">일기 한 편이면 AI가 기분을 읽고, 지금 듣기 좋은 노래를 골라 줘요.</p>
      </section>
      <ol className={`${cardClass} flex flex-col gap-3`}>
        {STEPS.map(([icon, text]) => (
          <li key={text} className="flex items-center gap-3">
            <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-accent-soft text-lg">
              {icon}
            </span>
            {text}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-3">
        {googleLoginEnabled && (
          <form action={loginWithGoogle}>
            <button type="submit" className={`${primaryButtonClass} w-full py-3`}>
              구글 계정으로 시작하기
            </button>
          </form>
        )}
        {devLoginEnabled && (
          <form action={loginForDev} className={`${cardClass} flex flex-col gap-2 border-dashed`}>
            <p className="text-sm text-muted">개발용 로그인 (로컬에서만 보여요)</p>
            <div className="flex gap-2">
              <input name="name" placeholder="이름" defaultValue="테스터" className={`${inputClass} min-w-0 flex-1`} />
              <button type="submit" className={secondaryButtonClass}>
                로그인
              </button>
            </div>
          </form>
        )}
        {!googleLoginEnabled && !devLoginEnabled && (
          <p className="text-center text-sm text-muted">로그인 설정을 준비하고 있어요. 잠시 후 다시 와 주세요.</p>
        )}
      </div>
    </main>
  );
}
