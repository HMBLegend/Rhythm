import { guardPage } from "@/lib/auth/guard";
import { safeNext } from "@/lib/auth/routing";
import { LoginForm } from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  await guardPage("/login");
  const { next, "logged-out": loggedOut } = await props.searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Rhythm</h1>
      {loggedOut && (
        <p
          role="status"
          className="rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800"
        >
          You&apos;ve been logged out.
        </p>
      )}
      <LoginForm next={safeNext(typeof next === "string" ? next : null)} />
    </main>
  );
}
