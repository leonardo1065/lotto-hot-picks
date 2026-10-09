import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { exigirAcesso } from "@/lib/gate.functions";
import { listarCartoes, removerCartoesNuvem, type LoteCartoes } from "@/lib/cartoes.functions";
import { buscarConcursos, buscarConcurso, type ConcursoResultado } from "@/lib/lotofacil.functions";

export const Route = createFileRoute("/meus-jogos")({
  beforeLoad: async () => {
    const { autorizado } = await exigirAcesso();
    if (!autorizado) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Meus jogos salvos | Gerador Lotofácil" },
      {
        name: "description",
        content:
          "Espaço para guardar os cartões gerados, ver a data de criação, excluir jogos e conferir com qualquer concurso da Lotofácil.",
      },
      { property: "og:title", content: "Meus jogos salvos | Gerador Lotofácil" },
      {
        property: "og:description",
        content: "Cartões salvos na nuvem com conferência por concurso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeusJogos,
});

function formatarDataHora(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MeusJogos() {
  const remover = useServerFn(removerCartoesNuvem);
  const [concursoAlvo, setConcursoAlvo] = useState("");
  const [conferindoId, setConferindoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: salvos = [], refetch, isFetching } = useQuery({
    queryKey: ["cartoes-salvos"],
    queryFn: () => listarCartoes(),
  });

  const { data: concursos = [] } = useQuery({
    queryKey: ["concursos-lista", 20],
    queryFn: () => buscarConcursos({ data: { quantidade: 20 } }),
  });

  const { data: sorteio, isFetching: buscandoSorteio } = useQuery({
    queryKey: ["concurso-conferencia", concursoAlvo || "latest"],
    queryFn: () =>
      buscarConcurso({ data: { numero: concursoAlvo ? Number(concursoAlvo) : null } }),
    retry: false,
  });

  const loteConferido = useMemo(
    () => salvos.find((l) => l.id === conferindoId) ?? null,
    [salvos, conferindoId],
  );

  const conferencia = useMemo(() => {
    if (!loteConferido || !sorteio) return null;
    const sorteadas = new Set(sorteio.dezenas);
    const linhas = loteConferido.jogos
      .map((jogo, i) => {
        const acertadas = jogo.filter((n) => sorteadas.has(n));
        return { indice: i + 1, jogo: [...jogo].sort((a, b) => a - b), acertadas, acertos: acertadas.length };
      })
      .sort((a, b) => b.acertos - a.acertos);
    return {
      linhas,
      melhor: linhas[0]?.acertos ?? 0,
      premiados: linhas.filter((l) => l.acertos >= 11).length,
    };
  }, [loteConferido, sorteio]);

  const excluir = async (id: string) => {
    if (!window.confirm("Excluir este jogo salvo?")) return;
    setErro(null);
    try {
      await remover({ data: { id } });
      if (conferindoId === id) setConferindoId(null);
      await refetch();
    } catch {
      setErro("Não foi possível excluir este jogo.");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-sm tracking-[0.35em] text-accent">LOTOFÁCIL · CAIXA</p>
            <Link
              to="/"
              className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              Voltar ao gerador
            </Link>
          </div>
          <h1 className="mt-4 font-display text-5xl leading-none tracking-wide sm:text-6xl">
            Meus jogos salvos
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Todos os cartões que você salvou ficam guardados aqui, com data e hora de criação.
            Escolha um concurso e confira qualquer jogo quando quiser, de qualquer dispositivo.
          </p>
        </header>

        <section className="rounded-2xl border border-accent/60 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Concurso para conferência</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-[11px] text-muted-foreground">Escolher concurso</span>
              <select
                value={concursoAlvo}
                onChange={(e) => setConcursoAlvo(e.target.value)}
                className="mt-1 w-56 rounded-xl border border-border bg-secondary px-3 py-2 text-foreground"
              >
                <option value="">Último concurso</option>
                {concursos.map((c: ConcursoResultado) => (
                  <option key={c.concurso} value={String(c.concurso)}>
                    #{c.concurso} · {c.data}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-[11px] text-muted-foreground">Ou digite o número</span>
              <input
                value={concursoAlvo}
                onChange={(e) => setConcursoAlvo(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="ex.: 3200"
                className="mt-1 w-40 rounded-xl border border-border bg-secondary px-3 py-2 text-foreground"
              />
            </label>
          </div>

          {sorteio && (
            <div className="mt-4 rounded-xl border border-border p-3">
              <p className="font-display text-lg tracking-wide">
                Concurso {sorteio.concurso} · {sorteio.data}
              </p>
              <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-8">
                {[...sorteio.dezenas].sort((a, b) => a - b).map((n) => (
                  <div
                    key={n}
                    className="ball-base w-full border border-accent bg-accent text-xl text-accent-foreground"
                  >
                    {String(n).padStart(2, "0")}
                  </div>
                ))}
              </div>
            </div>
          )}
          {buscandoSorteio && (
            <p className="mt-3 text-sm text-muted-foreground">Buscando resultado na Caixa...</p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Jogos guardados</h2>
          {isFetching && <p className="mt-2 text-xs text-muted-foreground">Carregando...</p>}
          {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}

          {salvos.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhum jogo salvo ainda. Gere os cartões no painel e use “Salvar cartões gerados
              agora”.
            </p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {salvos.map((lote: LoteCartoes) => (
                <li key={lote.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-lg tracking-wide">
                        {lote.jogos.length} {lote.jogos.length === 1 ? "cartão" : "cartões"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Salvo em {formatarDataHora(lote.criadoEm)}
                        {lote.concursoTopo ? ` · base até o concurso #${lote.concursoTopo}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setConferindoId(conferindoId === lote.id ? null : lote.id)
                        }
                        className="rounded-full border border-accent px-4 py-1.5 text-xs text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {conferindoId === lote.id ? "Ocultar conferência" : "Conferir este jogo"}
                      </button>
                      <button
                        onClick={() => excluir(lote.id)}
                        className="rounded-full border border-destructive px-4 py-1.5 text-xs text-destructive"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Ver dezenas dos cartões
                    </summary>
                    <ol className="mt-2 space-y-1 font-mono text-xs">
                      {lote.jogos.map((j, i) => (
                        <li key={i}>
                          {i + 1}.{" "}
                          {[...j].sort((a, b) => a - b).map((n) => String(n).padStart(2, "0")).join(" ")}
                        </li>
                      ))}
                    </ol>
                  </details>

                  {conferindoId === lote.id && conferencia && sorteio && (
                    <div className="mt-4 rounded-xl border-2 border-primary p-4">
                      <p className="text-xs text-muted-foreground">
                        Conferindo com o concurso {sorteio.concurso} · {sorteio.data} — melhor
                        cartão: <strong>{conferencia.melhor} acertos</strong> ·{" "}
                        {conferencia.premiados} premiado(s) de 11+ pontos
                      </p>
                      <ol className="mt-3 space-y-2">
                        {conferencia.linhas.map((l, pos) => (
                          <li
                            key={l.indice}
                            className={`rounded-xl border p-3 ${
                              l.acertos >= 11 ? "border-accent bg-accent/10" : "border-border"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">
                                {pos + 1}º · Cartão {l.indice}
                              </span>
                              <span
                                className={
                                  l.acertos >= 11 ? "font-semibold text-accent" : "text-muted-foreground"
                                }
                              >
                                {l.acertos} acertos{l.acertos >= 11 ? " · PREMIADO" : ""}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {l.jogo.map((n) => {
                                const acertou = l.acertadas.includes(n);
                                return (
                                  <span
                                    key={n}
                                    className={`inline-flex size-8 items-center justify-center rounded-full border font-display text-base ${
                                      acertou
                                        ? "border-accent bg-accent text-accent-foreground"
                                        : "border-border bg-secondary text-muted-foreground"
                                    }`}
                                  >
                                    {String(n).padStart(2, "0")}
                                  </span>
                                );
                              })}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
