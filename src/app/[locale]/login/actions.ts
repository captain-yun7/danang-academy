"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function signInWithCredentials(input: {
  email: string;
  password: string;
  callbackUrl?: string;
}): Promise<{ error?: string } | void> {
  try {
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirectTo: input.callbackUrl ?? "/admin",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.type };
    }
    throw err;
  }
}

export async function signOutAction() {
  const { signOut } = await import("@/auth");
  await signOut({ redirectTo: "/login" });
}
