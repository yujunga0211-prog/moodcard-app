// 로그인 정보·DB를 읽는 부분이 도착하기 전에 보이는 자리 표시.
export function PageLoading() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8" aria-busy>
      <div className="h-64 animate-pulse rounded-2xl bg-line/60" />
      <div className="h-40 animate-pulse rounded-2xl bg-line/40" />
    </main>
  );
}
