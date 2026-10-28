import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { currentUserId } from "@/auth";
import { logout } from "./actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "무드카드",
  description: "오늘의 기분을 노래와 짤로 남기는 AI 기분 일기장",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-lg bg-accent text-base text-on-accent"
              >
                ♪
              </span>
              무드카드
            </Link>
            <Suspense fallback={null}>
              <Nav />
            </Suspense>
          </div>
        </header>
        {children}
        <footer className="mt-auto border-t border-line py-6 text-center text-sm text-muted">
          무드카드 · 유정아 · 윤채원
        </footer>
      </body>
    </html>
  );
}

// 로그인 정보(쿠키)를 읽으므로 Suspense 안에서 따로 그린다.
async function Nav() {
  if (!(await currentUserId())) return null;
  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/" className="text-muted transition hover:text-accent">
        오늘
      </Link>
      <Link href="/calendar" className="text-muted transition hover:text-accent">
        캘린더
      </Link>
      <form action={logout}>
        <button type="submit" className="text-muted transition hover:text-accent">
          로그아웃
        </button>
      </form>
    </nav>
  );
}
