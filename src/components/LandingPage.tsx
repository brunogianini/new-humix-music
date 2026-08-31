import Link from "next/link";
import {
  BarChart3,
  Disc3,
  Heart,
  ListMusic,
  NotebookText,
  Search,
  Settings,
  Star,
  Trophy,
  Users,
} from "lucide-react";

const FEATURES: { icon: typeof Search; title: string; description: string }[] = [
  {
    icon: Search,
    title: "Buscar álbuns",
    description: "Pesquise álbuns reais por título ou artista, direto do catálogo do Spotify.",
  },
  {
    icon: NotebookText,
    title: "Diário de escutas",
    description:
      "Registre cada escuta com nota (em meia-estrela), resenha e data — com suporte a reescutas.",
  },
  {
    icon: Heart,
    title: "Curtir e Quero ouvir",
    description: "Marque rapidamente os álbuns que você curte ou quer ouvir depois.",
  },
  {
    icon: ListMusic,
    title: "Listas personalizadas",
    description: "Crie listas e organize álbuns do seu jeito — favoritos, por gênero, o que for.",
  },
  {
    icon: Star,
    title: "Nota da comunidade",
    description:
      "Cada álbum reúne a nota de todos os usuários da plataforma, além da sua nota pessoal.",
  },
  {
    icon: BarChart3,
    title: "Estatísticas",
    description:
      "Acompanhe suas escutas, artistas mais ouvidos, distribuição de notas e os destaques da comunidade.",
  },
  {
    icon: Trophy,
    title: "Amigos e recomendações",
    description:
      "Siga outros usuários, recomende álbuns com prazo e acumule pontos — quem não ouvir a tempo leva uma \"vergonha\".",
  },
  {
    icon: Settings,
    title: "Importe do Spotify",
    description: "Conecte sua conta e traga álbuns salvos e artistas seguidos para sua biblioteca.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-8">
        <div className="flex items-center gap-2 text-accent">
          <Disc3 size={26} />
          <span className="text-base font-semibold tracking-tight text-neutral-50">
            Humix Music
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-neutral-300 transition hover:text-neutral-100"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-300"
          >
            Cadastre-se
          </Link>
        </div>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col items-center px-5 py-16 text-center md:py-24">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-50 md:text-5xl">
          Um Letterboxd para álbuns
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base text-neutral-400 md:text-lg">
          Avalie, resenhe e registre um diário das suas escutas. Organize listas, acompanhe
          estatísticas e descubra a nota da comunidade — feito para quem leva música a sério.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/register"
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-neutral-300"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/login"
            className="rounded-full px-6 py-2.5 text-sm font-medium text-neutral-300 ring-1 ring-white/10 transition hover:bg-neutral-900 hover:text-neutral-100"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 md:px-8 md:pb-28">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-lg bg-neutral-900 p-5 ring-1 ring-white/10"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-neutral-800 text-accent">
                <Icon size={18} />
              </div>
              <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
              <p className="text-sm leading-relaxed text-neutral-400">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-5 py-16 text-center">
          <Users size={28} className="text-accent" />
          <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
            Sua biblioteca, com seus amigos
          </h2>
          <p className="max-w-lg text-sm text-neutral-400 md:text-base">
            Cada conta tem sua própria biblioteca, diário e listas — e a nota de cada álbum
            combina a sua opinião com a de toda a comunidade.
          </p>
          <Link
            href="/register"
            className="mt-2 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-neutral-300"
          >
            Começar agora
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-center text-xs text-neutral-600 md:px-8">
        Humix Music
      </footer>
    </div>
  );
}
