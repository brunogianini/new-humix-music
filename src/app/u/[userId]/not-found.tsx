import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="rounded-lg bg-neutral-900 p-8 text-center text-neutral-500 ring-1 ring-white/10">
        <p className="text-neutral-200">Usuário não encontrado.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-accent-soft hover:underline">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
