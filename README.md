# Humix Music

Um "Letterboxd para álbuns", multi-usuário: crie sua conta, busque álbuns,
avalie, escreva resenhas, registre um diário de escutas (com suporte a
reescutas), organize listas e acompanhe suas estatísticas — inclusive a nota
da comunidade, formada pela nota de todos os usuários da plataforma.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Prisma** + **SQLite** (arquivo local `prisma/dev.db`, sem Docker/servidor externo)
- Busca de álbuns via **Spotify** (Client Credentials, sem login do usuário)
- Autenticação própria: sessão em cookie httpOnly assinado (`jose`/JWT) + senha
  com hash `scrypt` — sem lib externa de auth
- Importação opcional de biblioteca via Spotify (OAuth Authorization Code,
  configurável na tela de Configurações)

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) e crie uma conta.

Variáveis de ambiente em `.env`: `DATABASE_URL`, `SPOTIFY_CLIENT_ID` /
`SPOTIFY_CLIENT_SECRET` (busca de álbuns), `SESSION_SECRET` (assina os
cookies de sessão) e `SPOTIFY_REDIRECT_URI` (para conectar a conta do
Spotify em Configurações — precisa estar cadastrada exatamente igual no
Spotify Developer Dashboard do app).

O banco SQLite já vem criado e migrado (`prisma/dev.db`). Se precisar recriar
do zero:

```bash
npx prisma migrate reset
```

## Funcionalidades

- **Contas**: cadastro/login por email e senha; cada usuário tem sua própria
  biblioteca, diário e listas.
- **Buscar**: pesquise álbuns reais por título/artista (Spotify).
- **Diário**: registre escutas com nota (meia-estrela), resenha, data e
  marcação de reescuta; edite ou remova qualquer registro.
- **Curtir / Quero ouvir**: marcação rápida em qualquer álbum.
- **Listas**: crie listas personalizadas e organize álbuns nelas.
- **Notas compartilhadas**: cada álbum tem uma nota da comunidade (pool de
  todos os usuários) além da nota pessoal de quem está logado.
- **Perfil**: estatísticas pessoais (escutas, álbuns/artistas distintos, nota
  média, distribuição de notas, artistas mais ouvidos) e estatísticas da
  comunidade (melhor álbum por ano, seu álbum favorito, banda mais bem
  avaliada, mais ouvido/mais bem avaliado na plataforma).
- **Configurações**: conecte sua conta do Spotify e importe álbuns salvos e
  artistas seguidos direto para a sua biblioteca. Tidal ainda não é suportado
  — a API deles exige um acordo comercial para acesso a bibliotecas pessoais.

## Estrutura

- `src/app/api/*` — rotas de API (Next.js Route Handlers) sobre o Prisma,
  todas protegidas por sessão e escopadas por usuário.
- `src/app/(auth)/actions.ts`, `src/app/login/`, `src/app/register/` —
  cadastro/login (Server Actions) e `src/proxy.ts` — redireciona visitantes
  não autenticados (convenção `proxy.js` do Next 16, sucessora do antigo
  `middleware.js`).
- `src/lib/session.ts`, `src/lib/dal.ts`, `src/lib/apiAuth.ts`,
  `src/lib/password.ts` — sessão JWT em cookie, hash de senha, guardas de
  autenticação para Server Components e Route Handlers.
- `src/lib/albumAggregate.ts` — nota pessoal vs. nota da comunidade por álbum.
- `src/context/LibraryContext.tsx` — estado global do app (albums, diário,
  listas, stats) e todas as ações de mutação.
- `src/context/AuthContext.tsx` — usuário logado, disponível em toda a UI.
- `src/components/` — UI (single-page app, navegação por abas em memória).
- `prisma/schema.prisma` — modelo de dados (`User`, `ExternalAccount`, e as
  entidades de biblioteca, todas ligadas a um usuário exceto `Album`, que é
  compartilhado entre todos).
