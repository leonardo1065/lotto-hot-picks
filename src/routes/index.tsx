import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { buscarConcursos, type ConcursoResultado } from "@/lib/lotofacil.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerador Lotofácil 15 Dezenas | Painel de 25" },
      {
        name: "description",
        content:
          "Gere 15 dezenas da Lotofácil a partir das mais sorteadas nos últimos concursos da Caixa, com painel fixo de 01 a 25.",
      },
      { property: "og:title", content: "Gerador Lotofácil 15 Dezenas" },
      {
        property: "og:description",
        content:
          "Painel de 25 dezenas, frequência real dos últimos concursos da Caixa e geração automática de 15 dezenas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TODAS = Array.from({ length: 25 }, (_, i) => i + 1);
const OPCOES = [10, 20, 30, 50, 100];

function Index() {
  const buscar = useServerFn(buscarConcursos);
  const [quantidade, setQuantidade] = useState(20);
  const [ativas, setAtivas] = useState<number[]>(TODAS);
  const [concursos, setConcursos] = useState<ConcursoResultado[]>([]);
  const [geradas, setGeradas] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const frequencias = useMemo(() => {
    const mapa = new Map<number, number>(TODAS.map((n) => [n, 0]));
    for (const c of concursos) {
      for (const d of c.dezenas) mapa.set(d, (mapa.get(d) ?? 0) + 1);
    }
    return mapa;
  }, [concursos]);

  const maxFreq = Math.max(1, ...Array.from(frequencias.values()));

  const alternar = (n: number) =>
    setAtivas((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)));

  const gerar = async () => {
    setErro(null);
    if (ativas.length < 15) {
      setErro("Selecione ao menos 15 dezenas no painel para gerar o jogo.");
      return;
    }
    setCarregando(true);
    try {
      const dados = await buscar({ data: { quantidade } });
      setConcursos(dados);
      const contagem = new Map<number, number>(TODAS.map((n) => [n, 0]));
      for (const c of dados) for (const d of c.dezenas) contagem.set(d, (contagem.get(d) ?? 0) + 1);
      const top = [...ativas]
        .sort((a, b) => (contagem.get(b) ?? 0) - (contagem.get(a) ?? 0) || a - b)
        .slice(0, 15)
        .sort((a, b) => a - b);
      setGeradas(top);
    } catch {
      setErro("Não foi possível buscar os resultados da Caixa. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  const zerar = () => {
    setAtivas([]);
    setGeradas([]);
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-8">
        <p className="font-display text-sm tracking-[0.35em] text-accent">LOTOFÁCIL · CAIXA</p>
        <h1 className="font-display text-5xl leading-none tracking-wide sm:text-6xl">
          Gerador de 15 dezenas
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Painel fixo de 01 a 25. Escolha quantos concursos analisar e o gerador seleciona as 15
          dezenas mais sorteadas entre as que você deixou ativas.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl tracking-wide">Concursos analisados</h2>
          <span className="text-xs text-muted-foreground">últimos {quantidade} resultados</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {OPCOES.map((op) => (
            <button
              key={op}
              onClick={() => setQuantidade(op)}
              className={`rounded-full border px-4 py-2 font-display text-lg tracking-wide transition-colors ${
                quantidade === op
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-secondary-foreground hover:border-primary"
              }`}
            >
              {op}
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={100}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="w-24 rounded-full border border-border bg-input px-4 py-2 text-center font-display text-lg tracking-wide outline-none focus:border-primary"
            aria-label="Quantidade de concursos"
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl tracking-wide">Painel de dezenas</h2>
          <span className="text-xs text-muted-foreground">{ativas.length} ativas</span>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-7">
          {TODAS.map((n) => {
            const ativa = ativas.includes(n);
            const freq = frequencias.get(n) ?? 0;
            const intensidade = concursos.length ? freq / maxFreq : 0;
            return (
              <button
                key={n}
                onClick={() => alternar(n)}
                aria-pressed={ativa}
                className={`ball-base relative w-full border text-2xl ${
                  ativa
                    ? "border-primary/60 bg-primary text-primary-foreground shadow-ball hover:-translate-y-0.5"
                    : "border-border bg-secondary text-muted-foreground opacity-60"
                }`}
                style={
                  ativa && intensidade > 0
                    ? { backgroundColor: `color-mix(in oklab, var(--hot) ${Math.round(intensidade * 100)}%, var(--primary))` }
                    : undefined
                }
              >
                {String(n).padStart(2, "0")}
                {concursos.length > 0 && (
                  <span className="absolute -bottom-1 right-0 rounded-full bg-background px-1.5 text-[10px] font-semibold text-foreground">
                    {freq}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={gerar}
            disabled={carregando}
            className="rounded-full bg-primary px-6 py-3 font-display text-xl tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {carregando ? "Buscando na Caixa..." : "Gerar 15 dezenas"}
          </button>
          <button
            onClick={zerar}
            className="rounded-full border border-destructive px-6 py-3 font-display text-xl tracking-wide text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            Zerar dezenas
          </button>
          <button
            onClick={() => setAtivas(TODAS)}
            className="rounded-full border border-border bg-secondary px-6 py-3 font-display text-xl tracking-wide text-secondary-foreground transition-colors hover:border-primary"
          >
            Marcar todas
          </button>
        </div>

        {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}
      </section>

      {geradas.length > 0 && (
        <section className="mt-6 rounded-2xl border border-primary/40 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Seu jogo gerado</h2>
          <p className="text-xs text-muted-foreground">
            Baseado em {concursos.length} concursos · até o concurso {concursos[0]?.concurso} (
            {concursos[0]?.data})
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8">
            {geradas.map((n) => (
              <div
                key={n}
                className="ball-base w-full bg-accent text-2xl text-accent-foreground shadow-ball"
              >
                {String(n).padStart(2, "0")}
              </div>
            ))}
          </div>
        </section>
      )}

      {concursos.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Resultados consultados</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {concursos.map((c) => (
              <li key={c.concurso} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-28 shrink-0 text-muted-foreground">
                  #{c.concurso} · {c.data}
                </span>
                <span className="font-display tracking-widest">
                  {c.dezenas.map((d) => String(d).padStart(2, "0")).join(" ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
