import { Disc3 } from "lucide-react";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-accent">
          <Disc3 size={28} />
          <span className="text-lg font-semibold tracking-tight text-neutral-50">
            Vinyl Diary
          </span>
        </div>
        <div className="rounded-lg bg-neutral-900 p-6 ring-1 ring-white/10">
          <h1 className="mb-5 text-lg font-semibold text-neutral-100">Criar conta</h1>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
