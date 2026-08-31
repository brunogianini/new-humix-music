"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/(auth)/actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs font-medium text-neutral-400">
          Nome
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          className="rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-neutral-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
        />
        {state?.errors?.email && <p className="text-sm text-red-400">{state.errors.email[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-neutral-400">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
        />
        <p className="text-xs text-neutral-500">Pelo menos 8 caracteres.</p>
        {state?.errors?.password && (
          <p className="text-sm text-red-400">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-300 disabled:opacity-50"
      >
        {pending ? "Criando conta…" : "Cadastrar"}
      </button>

      <p className="text-center text-sm text-neutral-500">
        Já tem conta?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
