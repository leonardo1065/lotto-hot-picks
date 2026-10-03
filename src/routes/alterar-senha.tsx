import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  alterarCredenciais,
  exigirAcesso,
  gerarCodigoRecuperacao,
  statusCodigoRecuperacao,
} from "@/lib/gate.functions";

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
      <CodigoSecreto />
    </main>
  );
}

function CodigoSecreto() {
  const gerar = useServerFn(gerarCodigoRecuperacao);
  const status = useServerFn(statusCodigoRecuperacao);
  const [existe, setExiste] = useState<boolean | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    status().then((r) => setExiste(r.existe)).catch(() => setExiste(null));
  }, [status]);

  async function onGerar() {
    if (existe && !window.confirm("Gerar um novo código? O código antigo deixará de funcionar.")) return;
    setErro(null);
    try {
      const r = await gerar();
      if (r.ok) {
        setCodigo(r.codigo);
        setExiste(true);
      } else setErro(r.erro);
    } catch {
      setErro("Não foi possível gerar o código.");
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-border p-4">
      <h2 className="font-display text-2xl tracking-wide">Código secreto de recuperação</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Se esquecer o login ou a senha, use este código na tela de entrada em "Esqueci meu login ou
        senha". Ele aparece só uma vez: anote e guarde em lugar seguro.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {existe === null ? "" : existe ? "Você já tem um código ativo." : "Nenhum código gerado ainda."}
      </p>
      {codigo && (
        <p className="mt-3 select-all rounded-xl border border-accent bg-secondary p-3 text-center font-mono text-xl tracking-widest text-accent">
          {codigo}
        </p>
      )}
      {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      <button
        type="button"
        onClick={onGerar}
        className="mt-3 w-full rounded-full border border-accent px-6 py-3 font-display text-lg tracking-wide"
      >
        {existe ? "Gerar novo código" : "Gerar código secreto"}
      </button>
    </section>
  );
}
