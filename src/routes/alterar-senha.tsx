import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { alterarCredenciais, exigirAcesso } from "@/lib/gate.functions";

export const Route = createFileRoute("/alterar-senha")({
  beforeLoad: async () => {
    const { autorizado } = await exigirAcesso();
    if (!autorizado) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Alterar login e senha | Gerador Lotofácil" },
      {
        name: "description",
        content:
          "Atualize o login e a senha de acesso ao gerador de dezenas da Lotofácil depois do primeiro acesso.",
      },
      { property: "og:title", content: "Alterar login e senha | Gerador Lotofácil" },
      {
        property: "og:description",
        content: "Troque suas credenciais de acesso ao painel do gerador da Lotofácil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AlterarSenha,
});

function AlterarSenha() {
  const router = useRouter();
  const alterar = useServerFn(alterarCredenciais);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const novoUsuario = String(form.get("novoUsuario") ?? "").trim();
    const novaSenha = String(form.get("novaSenha") ?? "");
    const confirmar = String(form.get("confirmar") ?? "");
    setOk(false);
    setErro(null);
    if (novoUsuario.length < 3) {
      setErro("O novo login precisa ter ao menos 3 caracteres.");
      return;
    }
    if (novaSenha.length < 6) {
      setErro("A nova senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("A confirmação da nova senha não confere.");
      return;
    }

    setSalvando(true);
    try {
      const res = await alterar({
        data: {
          senhaAtual: String(form.get("senhaAtual") ?? ""),
          novoUsuario,
          novaSenha,
        },
      });
      if (res.ok) {
        setOk(true);
        formEl.reset();
        await router.invalidate();
      } else {
        setErro(res.erro ?? "Não foi possível alterar as credenciais.");
      }
    } catch {
      setErro("Não foi possível alterar as credenciais. Confira os dados e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 outline-none focus:border-primary";

  return (
    <main className="mx-auto w-full max-w-md px-5 py-12">
      <p className="font-display text-sm tracking-[0.35em] text-accent">LOTOFÁCIL · CAIXA</p>
      <h1 className="font-display text-5xl leading-none tracking-wide">Alterar acesso</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Defina um novo login e uma nova senha. Eles passam a valer no próximo acesso e ficam
        guardados de forma cifrada.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="senhaAtual" className="text-xs text-muted-foreground">
            Senha atual
          </label>
          <input
            id="senhaAtual"
            name="senhaAtual"
            type="password"
            autoComplete="current-password"
            required
            className={campo}
          />
        </div>
        <div>
          <label htmlFor="novoUsuario" className="text-xs text-muted-foreground">
            Novo login
          </label>
          <input
            id="novoUsuario"
            name="novoUsuario"
            autoComplete="username"
            minLength={3}
            required
            className={campo}
          />
        </div>
        <div>
          <label htmlFor="novaSenha" className="text-xs text-muted-foreground">
            Nova senha
          </label>
          <input
            id="novaSenha"
            name="novaSenha"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            className={campo}
          />
        </div>
        <div>
          <label htmlFor="confirmar" className="text-xs text-muted-foreground">
            Confirmar nova senha
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            className={campo}
          />
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {ok && (
          <p className="text-sm text-accent">
            Credenciais atualizadas! Use o novo login e senha no próximo acesso.
          </p>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-full bg-primary px-6 py-3 font-display text-xl tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar novo acesso"}
        </button>
        <Link
          to="/"
          className="block rounded-full border border-border px-6 py-3 text-center font-display text-lg tracking-wide text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          Voltar ao painel
        </Link>
      </form>
    </main>
  );
}
