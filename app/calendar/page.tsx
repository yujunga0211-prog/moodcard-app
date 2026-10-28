import { Suspense } from "react";
import { PageLoading } from "../page-loading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/auth";
import { formatKoreanDate, isDateString, seoulDate } from "@/lib/dates";
import { appDiaries } from "@/lib/diaries";
import { MOOD_GROUPS } from "@/lib/emotions";
import { CardView } from "../card-view";
import { cardClass } from "../ui";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <CalendarContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CalendarContent({ searchParams }: Pick<PageProps<"/calendar">, "searchParams">) {
  const userId = await currentUserId();
  if (!userId) redirect("/");

  const params = await searchParams;
  const today = todaySeoul();
  const selected = typeof params.date === "string" && isDateString(params.date) ? params.date : null;
  const { year, month } = parseMonth(params.month, selected ?? today);

  const diaries = appDiaries();
  const [days, day] = await Promise.all([
    diaries.getCalendar(userId, year, month),
    selected ? diaries.getDay(userId, selected) : null,
  ]);
  const byDate = new Map(days.map((d) => [d.date, d]));

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ];
  const monthParam = (offset: number) => {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <Link
            href={`/calendar?month=${monthParam(-1)}`}
            className="rounded-lg px-3 py-1 text-muted hover:text-accent"
            aria-label="이전 달"
          >
            ←
          </Link>
          <h1 className="text-lg font-bold tracking-tight">
            {year}년 {month}월
          </h1>
          <Link
            href={`/calendar?month=${monthParam(1)}`}
            className="rounded-lg px-3 py-1 text-muted hover:text-accent"
            aria-label="다음 달"
          >
            →
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-xs font-medium text-muted">
              {w}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />;
            const entry = byDate.get(date);
            const isSelected = date === selected;
            const isToday = date === today;
            return (
              <Link
                key={date}
                href={`/calendar?month=${year}-${pad(month)}&date=${date}`}
                title={entry ? `${entry.emotion} (${entry.moodGroup})` : undefined}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition hover:ring-2 hover:ring-accent/40 ${
                  isSelected ? "ring-2 ring-accent" : ""
                } ${entry ? "font-semibold text-[#1c1a23]" : isToday ? "bg-accent-soft font-semibold text-accent" : "text-muted"}`}
                style={entry ? { background: entry.color } : undefined}
              >
                {Number(date.slice(8))}
              </Link>
            );
          })}
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          {MOOD_GROUPS.map((g) => (
            <li key={g.id} className="flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ background: g.color }} />
              {g.name}
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="flex flex-col gap-4">
          <h2 className="font-bold">{formatKoreanDate(selected)}</h2>
          {day ? (
            <>
              <div className={`${cardClass} whitespace-pre-wrap leading-relaxed`}>{day.text}</div>
              <CardView card={day.card} shareable />
            </>
          ) : (
            <p className={`${cardClass} text-center text-sm text-muted`}>이날은 쓴 일기가 없어요.</p>
          )}
        </section>
      )}
    </main>
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseMonth(value: string | string[] | undefined, fallbackDate: string) {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12)
    return { year: Number(match[1]), month: Number(match[2]) };
  return { year: Number(fallbackDate.slice(0, 4)), month: Number(fallbackDate.slice(5, 7)) };
}

// 렌더링 중 new Date() 직접 호출은 react-hooks/purity lint에 걸려서 함수로 감쌌다.
function todaySeoul(): string {
  return seoulDate(new Date());
}
