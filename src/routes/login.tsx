import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { entrar, recuperarComCodigo } from "@/lib/gate.functions";

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
        por enquanto obrigado vou atualizar os outros projetos
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
      <Recuperar />
    </main>
  );
}

function Recuperar() {
  const router = useRouter();
  const recuperar = useServerFn(recuperarComCodigo);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo =
    "mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 outline-none focus:border-primary";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const novaSenha = String(f.get("novaSenha") ?? "");
    if (novaSenha !== String(f.get("confirmar") ?? "")) {
      setErro("A confirmação da nova senha não confere.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const res = await recuperar({
        data: {
          codigo: String(f.get("codigo") ?? ""),
          novoUsuario: String(f.get("novoUsuario") ?? ""),
          novaSenha,
        },
      });
      if (res.ok) await router.navigate({ to: "/" });
      else setErro(res.erro ?? "Não foi possível recuperar o acesso.");
    } catch {
      setErro("Não foi possível recuperar o acesso. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-6 text-sm text-muted-foreground underline"
      >
        Esqueci meu login ou senha
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-border p-4">
      <p className="font-display text-2xl tracking-wide">Recuperar com código secreto</p>
      <p className="text-xs text-muted-foreground">
        Digite o código secreto que você gerou e guardou na tela "Alterar acesso". Ele só vale uma vez.
      </p>
      <input name="codigo" placeholder="XXXX-XXXX-XXXX-XXXX" required className={campo} />
      <input name="novoUsuario" placeholder="Novo login" minLength={3} required className={campo} />
      <input name="novaSenha" type="password" placeholder="Nova senha" minLength={6} required className={campo} />
      <input name="confirmar" type="password" placeholder="Confirmar nova senha" minLength={6} required className={campo} />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-full bg-primary px-6 py-3 font-display text-xl tracking-wide text-primary-foreground disabled:opacity-60"
      >
        {enviando ? "Recuperando..." : "Redefinir acesso"}
      </button>
      <button type="button" onClick={() => setAberto(false)} className="text-sm text-muted-foreground underline">
        Cancelar
      </button>
    </form>
  );
}
