import { Suspense } from "react";
import { PageLoading } from "../../page-loading";
import Link from "next/link";
import { notFound } from "next/navigation";
import { appDiaries } from "@/lib/diaries";
import { CardView } from "../../card-view";
import { primaryButtonClass } from "../../ui";

export default function SharedCardPage({ params }: PageProps<"/card/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <SharedCardContent params={params} />
    </Suspense>
  );
}

async function SharedCardContent({ params }: Pick<PageProps<"/card/[id]">, "params">) {
  const { id } = await params;
  const card = await appDiaries().getSharedCard(id);
  if (!card) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <CardView card={card} />
      <Link href="/" className={`${primaryButtonClass} py-3 text-center`}>
        나도 오늘 기분 남겨 보기
      </Link>
    </main>
  );
}
