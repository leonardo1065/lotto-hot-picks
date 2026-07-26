import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { buscarConcursos, type ConcursoResultado } from "@/lib/lotofacil.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerador Lotofácil 15 Dezenas | Painel de 25" },
      {
        name: "description",
        content:
          "Gere 15 dezenas da Lotofácil a partir das mais sorteadas nos últimos concursos da Caixa, com painel fixo de 01 a 25 e estratégia de acertos.",
      },
      { property: "og:title", content: "Gerador Lotofácil 15 Dezenas" },
      {
        property: "og:description",
        content:
          "Ranking das dezenas mais sorteadas, painel de 25 dezenas e estratégia de jogo baseada nos concursos recentes da Caixa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TODAS = Array.from({ length: 25 }, (_, i) => i + 1);
const OPCOES = [10, 20, 30, 50, 100];
const OPCOES_APOSTAS = [3, 5, 8, 10];
const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23];

// sorteio ponderado: quanto mais a dezena saiu nos concursos, maior a chance
function sortearPonderado(pool: { n: number; peso: number }[], qtd: number) {
  const restantes = pool.map((p) => ({ ...p }));
  const escolhidas: number[] = [];
  while (escolhidas.length < qtd && restantes.length) {
    const total = restantes.reduce((a, b) => a + b.peso, 0);
    let alvo = Math.random() * total;
    let idx = restantes.length - 1;
    for (let i = 0; i < restantes.length; i++) {
      alvo -= restantes[i].peso;
      if (alvo <= 0) {
        idx = i;
        break;
      }
    }
    escolhidas.push(restantes[idx].n);
    restantes.splice(idx, 1);
  }
  return escolhidas;
}

function Index() {
  const buscar = useServerFn(buscarConcursos);
  const [quantidade, setQuantidade] = useState(20);
  const [ativas, setAtivas] = useState<number[]>(TODAS);
  const [geradas, setGeradas] = useState<number[]>([]);
  const [qtdApostas, setQtdApostas] = useState(5);
  const [apostas, setApostas] = useState<number[][]>([]);
  const [erro, setErro] = useState<string | null>(null);


  const {
    data: concursos = [],
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery<ConcursoResultado[]>({
    queryKey: ["lotofacil", quantidade],
    queryFn: () => buscar({ data: { quantidade } }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const frequencias = useMemo(() => {
    const mapa = new Map<number, number>(TODAS.map((n) => [n, 0]));
    for (const c of concursos) {
      for (const d of c.dezenas) mapa.set(d, (mapa.get(d) ?? 0) + 1);
    }
    return mapa;
  }, [concursos]);

  const ranking = useMemo(
    () =>
      TODAS.map((n) => ({ n, freq: frequencias.get(n) ?? 0 })).sort(
        (a, b) => b.freq - a.freq || a.n - b.n,
      ),
    [frequencias],
  );

  const maxFreq = Math.max(1, ...ranking.map((r) => r.freq));

  const quentes = ranking.slice(0, 8);
  const mornas = ranking.slice(8, 17);
  const frias = ranking.slice(17);

  const sugestaoEstrategica = useMemo(() => {
    if (!concursos.length) return [] as number[];
    const permitidas = new Set(ativas);
    const pick = (lista: { n: number }[], qtd: number) =>
      lista.filter((r) => permitidas.has(r.n)).slice(0, qtd).map((r) => r.n);
    const escolhidas = new Set<number>([
      ...pick(quentes, 8),
      ...pick(mornas, 5),
      ...pick(frias, 2),
    ]);
    for (const r of ranking) {
      if (escolhidas.size >= 15) break;
      if (permitidas.has(r.n)) escolhidas.add(r.n);
    }
    return [...escolhidas].slice(0, 15).sort((a, b) => a - b);
  }, [concursos, ativas, ranking, quentes, mornas, frias]);

  const pares = sugestaoEstrategica.filter((n) => n % 2 === 0).length;
  const primos = sugestaoEstrategica.filter((n) =>
    [2, 3, 5, 7, 11, 13, 17, 19, 23].includes(n),
  ).length;
  const soma = sugestaoEstrategica.reduce((a, b) => a + b, 0);

  // dezenas presentes em quase todos os concursos analisados
  const fixas = ranking.filter((r) => concursos.length && r.freq / concursos.length >= 0.8);

  useEffect(() => {
    if (isError) setErro("Não foi possível buscar os resultados da Caixa. Tente novamente.");
    else setErro(null);
  }, [isError]);

  const alternar = (n: number) =>
    setAtivas((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b),
    );

  const gerar = () => {
    if (ativas.length < 15) {
      setErro("Selecione ao menos 15 dezenas no painel para gerar o jogo.");
      return;
    }
    if (!concursos.length) {
      setErro("Aguarde o carregamento dos concursos da Caixa.");
      return;
    }
    setErro(null);
    const top = [...ativas]
      .sort((a, b) => (frequencias.get(b) ?? 0) - (frequencias.get(a) ?? 0) || a - b)
      .slice(0, 15)
      .sort((a, b) => a - b);
    setGeradas(top);
  };

  const gerarApostas = () => {
    if (ativas.length < 15) {
      setErro("Selecione ao menos 15 dezenas no painel para gerar as apostas.");
      return;
    }
    if (!concursos.length) {
      setErro("Aguarde o carregamento dos concursos da Caixa.");
      return;
    }
    setErro(null);
    const permitidas = new Set(ativas);
    const poolDe = (lista: { n: number; freq: number }[]) =>
      lista
        .filter((r) => permitidas.has(r.n))
        .map((r) => ({ n: r.n, peso: r.freq + 1 }));

    const poolQuentes = poolDe(quentes);
    const poolMornas = poolDe(mornas);
    const poolFrias = poolDe(frias);
    const poolTodas = poolDe(ranking);

    const vistas = new Set<string>();
    const novas: number[][] = [];
    let tentativas = 0;

    while (novas.length < qtdApostas && tentativas < qtdApostas * 60) {
      tentativas++;
      const jogo = new Set<number>([
        ...sortearPonderado(poolQuentes, Math.min(8, poolQuentes.length)),
        ...sortearPonderado(poolMornas, Math.min(5, poolMornas.length)),
        ...sortearPonderado(poolFrias, Math.min(2, poolFrias.length)),
      ]);
      for (const p of sortearPonderado(poolTodas, poolTodas.length)) {
        if (jogo.size >= 15) break;
        jogo.add(p);
      }
      if (jogo.size < 15) break;
      const lista = [...jogo].slice(0, 15).sort((a, b) => a - b);
      const chave = lista.join("-");
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      novas.push(lista);
    }

    setApostas(novas);
  };




  const zerar = () => {
    setAtivas([]);
    setGeradas([]);
    setApostas([]);
  };


  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-8">
        <p className="font-display text-sm tracking-[0.35em] text-accent">LOTOFÁCIL · CAIXA</p>
        <h1 className="font-display text-5xl leading-none tracking-wide sm:text-6xl">
          Gerador de 15 dezenas
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Os resultados são atualizados automaticamente ao abrir a tela. Escolha quantos concursos
          analisar e veja o ranking das dezenas mais sorteadas.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl tracking-wide">Concursos analisados</h2>
          <span className="text-xs text-muted-foreground">
            {isFetching
              ? "atualizando com a Caixa..."
              : dataUpdatedAt
                ? `atualizado ${new Date(dataUpdatedAt).toLocaleTimeString("pt-BR")}`
                : "—"}
          </span>
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
          <button
            onClick={() => refetch()}
            className="rounded-full border border-border bg-secondary px-4 py-2 font-display text-lg tracking-wide text-secondary-foreground transition-colors hover:border-primary"
          >
            Atualizar agora
          </button>
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
                    ? {
                        backgroundColor: `color-mix(in oklab, var(--hot) ${Math.round(intensidade * 100)}%, var(--primary))`,
                      }
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
            disabled={isFetching}
            className="rounded-full bg-primary px-6 py-3 font-display text-xl tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {isFetching ? "Buscando na Caixa..." : "Gerar 15 dezenas"}
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
          <h2 className="font-display text-2xl tracking-wide">Mais sorteadas nos concursos</h2>
          <p className="text-xs text-muted-foreground">
            Frequência nos últimos {concursos.length} concursos (do #{concursos[concursos.length - 1]?.concurso} ao #
            {concursos[0]?.concurso})
          </p>
          <ul className="mt-4 space-y-1.5">
            {ranking.map((r, i) => (
              <li key={r.n} className="flex items-center gap-3">
                <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}º</span>
                <span className="font-display text-lg tracking-widest">
                  {String(r.n).padStart(2, "0")}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${(r.freq / maxFreq) * 100}%` }}
                  />
                </span>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {r.freq}x · {Math.round((r.freq / concursos.length) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {concursos.length > 0 && sugestaoEstrategica.length === 15 && (
        <section className="mt-6 rounded-2xl border border-accent/40 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Estratégia sugerida</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Distribuição equilibrada: 8 dezenas quentes, 5 mornas e 2 frias. Historicamente os jogos
            premiados misturam repetição recente com dezenas atrasadas, em vez de usar só as mais
            sorteadas.
          </p>

          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8">
            {sugestaoEstrategica.map((n) => (
              <div
                key={n}
                className="ball-base w-full border border-accent/50 bg-secondary text-2xl text-foreground"
              >
                {String(n).padStart(2, "0")}
              </div>
            ))}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl border border-border p-3">
              <dt className="text-xs text-muted-foreground">Pares / Ímpares</dt>
              <dd className="font-display text-xl">
                {pares} / {15 - pares}
              </dd>
            </div>
            <div className="rounded-xl border border-border p-3">
              <dt className="text-xs text-muted-foreground">Primos</dt>
              <dd className="font-display text-xl">{primos}</dd>
            </div>
            <div className="rounded-xl border border-border p-3">
              <dt className="text-xs text-muted-foreground">Soma das dezenas</dt>
              <dd className="font-display text-xl">{soma}</dd>
            </div>
            <div className="rounded-xl border border-border p-3">
              <dt className="text-xs text-muted-foreground">Dezenas âncora (≥80%)</dt>
              <dd className="font-display text-xl">{fixas.length}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Quentes:</strong>{" "}
              {quentes.map((r) => String(r.n).padStart(2, "0")).join(" ")}
            </p>
            <p>
              <strong className="text-foreground">Mornas:</strong>{" "}
              {mornas.map((r) => String(r.n).padStart(2, "0")).join(" ")}
            </p>
            <p>
              <strong className="text-foreground">Frias:</strong>{" "}
              {frias.map((r) => String(r.n).padStart(2, "0")).join(" ")}
            </p>
            <p className="pt-2 text-xs">
              Dicas de fechamento: mantenha a soma entre 170 e 210, use de 7 a 8 pares e repita de 8
              a 10 dezenas do último concurso. Loteria é jogo de azar — nenhuma estratégia garante
              prêmio.
            </p>
          </div>

          <button
            onClick={() => setGeradas(sugestaoEstrategica)}
            className="mt-5 rounded-full bg-accent px-6 py-3 font-display text-xl tracking-wide text-accent-foreground transition-transform hover:-translate-y-0.5"
          >
            Usar esta estratégia
          </button>
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
