import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { entrar } from "@/lib/gate.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso restrito | Gerador Lotofácil" },
      {
        name: "description",
        content:
          "Entre com login e senha para acessar o gerador de dezenas da Lotofácil e a simulação de apostas.",
      },
      { property: "og:title", content: "Acesso restrito | Gerador Lotofácil" },
      {
        property: "og:description",
        content: "Área protegida do gerador de dezenas da Lotofácil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const router = useRouter();
  const login = useServerFn(entrar);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setCarregando(true);
    setErro(null);
    try {
      const { ok } = await login({
        data: {
          usuario: String(form.get("usuario") ?? ""),
          senha: String(form.get("senha") ?? ""),
        },
      });
      if (ok) await router.navigate({ to: "/" });
      else setErro("Login ou senha incorretos.");
    } catch {
      setErro("Não foi possível validar o acesso. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <p className="font-display text-sm tracking-[0.35em] text-accent">LOTOFÁCIL · CAIXA</p>
      <h1 className="font-display text-5xl leading-none tracking-wide">Acesso restrito</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        pode aplicar com opçao se caso esquecer senha e loguim , informe o email pra recuperalçao de senha e usuario
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="usuario" className="text-xs text-muted-foreground">
            Login
          </label>
          <input
            id="usuario"
            name="usuario"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="senha" className="text-xs text-muted-foreground">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 outline-none focus:border-primary"
          />
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-full bg-primary px-6 py-3 font-display text-xl tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
