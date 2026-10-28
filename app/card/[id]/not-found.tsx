import Link from "next/link";
import { cardClass } from "../../ui";

export default function CardNotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <div className={`${cardClass} text-center`}>
        <p className="text-4xl">🔍</p>
        <h1 className="mt-3 text-lg font-bold">카드를 찾을 수 없어요</h1>
        <p className="mt-1 text-sm text-muted">링크가 잘못되었거나 없어진 카드예요.</p>
        <Link href="/" className="mt-4 inline-block text-accent underline-offset-4 hover:underline">
          무드카드 처음으로
        </Link>
      </div>
    </main>
  );
}
