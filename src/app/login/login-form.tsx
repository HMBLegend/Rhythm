"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

// Minimal email and password login. It sends no email when confirmations are
// off in Supabase, which keeps clear of the free tier's email limit.
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setPending(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    if (!data.session) {
      setMessage("Check your email to confirm your account, then log in.");
      return;
    }
    // The destination page checks access on the server and redirects if needed.
    router.replace(next);
    router.refresh();
  }

  const isSignIn = mode === "sign-in";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl font-medium">
        {isSignIn ? "Log in" : "Create an account"}
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete={isSignIn ? "current-password" : "new-password"}
          minLength={6}
          required
          className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {pending ? "Please wait…" : isSignIn ? "Log in" : "Sign up"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(isSignIn ? "sign-up" : "sign-in");
          setMessage(null);
        }}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        {isSignIn ? "New here? Create an account" : "Have an account? Log in"}
      </button>
    </form>
  );
}
