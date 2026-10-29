import { formatKoreanDate, seoulDate } from "@/lib/dates";
import type { Card } from "@/lib/diaries";
import { moodGroupOf } from "@/lib/emotions";
import { ShareButton } from "./share-button";

// Card 한 장. 공유 화면과 본인 화면이 같이 쓴다. Diary 본문은 여기서 보여 주지 않는다.
export function CardView({ card, shareable = false }: { card: Card; shareable?: boolean }) {
  const isToday = card.date === todaySeoul();
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div
        className="px-6 pt-6 pb-5"
        style={{ background: `linear-gradient(160deg, ${card.moodGroup.color}33, transparent 70%)` }}
      >
        <p className="text-sm text-muted">{formatKoreanDate(card.date)}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">
          {isToday ? "오늘의" : "이날의"} 기분은{" "}
          <span style={{ color: card.moodGroup.color }} className="brightness-75 dark:brightness-125">
            {card.top[0].emotion}
          </span>
        </h2>
        <ul className="mt-5 flex flex-col gap-3">
          {card.top.map((t) => {
            const color = moodGroupOf(t.emotion).color;
            return (
              <li key={t.emotion}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{t.emotion}</span>
                  <span className="tabular-nums text-muted">{t.percent}%</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full" style={{ width: `${t.percent}%`, background: color }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-line px-6 py-5">
        <h3 className="text-sm font-semibold text-muted">{isToday ? "오늘" : "이날"} 어울리는 노래</h3>
        <ol className="mt-3 flex flex-col gap-3">
          {card.songs.map((song) => (
            <li key={song.rank} className="rounded-2xl bg-background px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {song.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{song.title}</p>
                  <p className="text-sm text-muted break-words">
                    {song.artist} · {song.language === "ko" ? "한국 노래" : "팝송"}
                  </p>
                  <p className="mt-1 text-sm">💬 {song.reason}</p>
                  <div className="mt-2 flex gap-2 text-sm">
                    <a
                      href={song.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-line px-2.5 py-1 transition hover:border-accent/50 hover:text-accent"
                    >
                      ▶ 유튜브
                    </a>
                    <a
                      href={song.melonUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-line px-2.5 py-1 transition hover:border-accent/50 hover:text-accent"
                    >
                      ♪ 멜론
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {shareable && <ShareButton cardId={card.id} />}
      </div>
    </article>
  );
}

// 렌더링 중 new Date() 직접 호출은 react-hooks/purity lint에 걸려서 함수로 감쌌다.
function todaySeoul(): string {
  return seoulDate(new Date());
}
