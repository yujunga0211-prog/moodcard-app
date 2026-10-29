"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserId, devLoginEnabled, signIn, signOut } from "@/auth";
import { appDiaries, isScope, MAX_DIARY_LENGTH, type WriteFailure } from "@/lib/diaries";
import { appUsers } from "@/lib/users";

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function loginForDev(formData: FormData) {
  if (!devLoginEnabled) return;
  await signIn("dev", { name: String(formData.get("name") ?? ""), redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export async function consent() {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  await appUsers().giveConsent(userId);
  redirect("/");
}

const MESSAGES: Record<WriteFailure, string> = {
  empty: "일기를 한 글자 이상 써 주세요.",
  too_long: `일기는 ${MAX_DIARY_LENGTH.toLocaleString()}자까지 쓸 수 있어요.`,
  no_consent: "먼저 AI 전송 안내에 동의해 주세요.",
  invalid_date: "오늘이나 지난 날짜의 일기만 쓸 수 있어요.",
  daily_limit: "오늘은 더 분석할 수 없어요. 내일 다시 써 주세요.",
  analysis_failed: "분석에 실패했어요. 다시 시도해 주세요.",
  no_songs: "추천할 노래가 아직 없어요. 다른 노래 범위를 골라 보세요.",
};

export async function writeDiary(input: {
  text: string;
  scope: string;
  date?: string;
}): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  if (!isScope(input.scope)) return { error: "추천받을 노래 범위를 골라 주세요." };

  const result = await appDiaries().writeDiary({
    userId,
    text: input.text,
    scope: input.scope,
    date: input.date,
    now: new Date(),
  });
  if (!result.ok) {
    if (result.reason === "no_consent") redirect("/consent");
    return { error: MESSAGES[result.reason] };
  }
  revalidatePath("/");
  revalidatePath("/calendar");
  return { error: null };
}
