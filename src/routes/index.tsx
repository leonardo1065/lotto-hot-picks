import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { buscarConcursos, type ConcursoResultado } from "@/lib/lotofacil.functions";
import { exigirAcesso, sair } from "@/lib/gate.functions";

export const Route = createFileRoute("/")({
  beforeLoad: () => exigirAcesso(),
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
const OPCOES_APOSTAS = [3, 5, 10, 15, 20];
const PRECO_CARTAO = 3.5; // valor da aposta simples de 15 dezenas
const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23];
const FAIXAS = [15, 14, 13, 12, 11];
const PREMIO_MEDIO: Record<number, string> = {
  15: "prêmio principal",
  14: "~R$ 1.900",
  13: "~R$ 30",
  12: "~R$ 12",
  11: "~R$ 6",
};


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


  // simulação: confronta cada aposta gerada com todos os concursos analisados
  const simulacao = useMemo(() => {
    const jogosParaSimular = apostas.length
      ? apostas
      : geradas.length === 15
        ? [geradas]
        : [];
    if (!jogosParaSimular.length || !concursos.length) return null;

    const zeroFaixas = () => ({ 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 }) as Record<number, number>;
    const geral = zeroFaixas();
    let somaGeral = 0;
    let sorteiosGeral = 0;

    const porAposta = jogosParaSimular.map((jogo) => {
      const set = new Set(jogo);
      const faixas = zeroFaixas();
      let totalAcertos = 0;
      let melhor = 0;
      for (const c of concursos) {
        let acertos = 0;
        for (const d of c.dezenas) if (set.has(d)) acertos++;
        totalAcertos += acertos;
        if (acertos > melhor) melhor = acertos;
        if (acertos >= 11) {
          faixas[acertos]++;
          geral[acertos]++;
        }
      }
      somaGeral += totalAcertos;
      sorteiosGeral += concursos.length;
      return {
        jogo,
        faixas,
        media: totalAcertos / concursos.length,
        melhor,
        premiados: FAIXAS.reduce((a, f) => a + faixas[f], 0),
      };
    });

    return {
      porAposta,
      geral,
      sorteios: sorteiosGeral,
      mediaGeral: somaGeral / sorteiosGeral,
      usandoJogoUnico: !apostas.length,
    };
  }, [apostas, geradas, concursos]);

  const zerar = () => {
    setAtivas([]);
    setGeradas([]);
    setApostas([]);
  };

  const sairFn = useServerFn(sair);
  const router = useRouter();
  const sairDoApp = async () => {
    await sairFn();
    await router.navigate({ to: "/login" });
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-sm tracking-[0.35em] text-accent">LOTOFÁCIL · CAIXA</p>
          <div className="flex items-center gap-2">
            <Link
              to="/alterar-senha"
              className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              Alterar senha
            </Link>
            <button
              onClick={sairDoApp}
              className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              Sair
            </button>
          </div>
        </div>
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

        <div className="mt-6 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl tracking-wide">Quantos cartões quer jogar?</h3>
            <span className="text-xs text-muted-foreground">
              8 quentes · 5 mornas · 2 frias, sorteadas por peso do ranking
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha 3, 5, 10 ou mais cartões — cada cartão é um jogo de 15 dezenas, todos
            diferentes entre si.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {OPCOES_APOSTAS.map((op) => (
              <button
                key={op}
                onClick={() => setQtdApostas(op)}
                className={`rounded-full border px-4 py-2 font-display text-lg tracking-wide transition-colors ${
                  qtdApostas === op
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-secondary text-secondary-foreground hover:border-accent"
                }`}
              >
                {op}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={30}
              value={qtdApostas}
              onChange={(e) =>
                setQtdApostas(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
              }
              className="w-24 rounded-full border border-border bg-input px-4 py-2 text-center font-display text-lg tracking-wide outline-none focus:border-accent"
              aria-label="Quantidade de apostas"
            />
            <button
              onClick={gerarApostas}
              disabled={isFetching}
              className="rounded-full bg-accent px-6 py-2.5 font-display text-lg tracking-wide text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              Gerar {qtdApostas} apostas
            </button>
            {apostas.length > 0 && (
              <button
                onClick={() => setApostas([])}
                className="rounded-full border border-border px-4 py-2.5 font-display text-lg tracking-wide text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}
      </section>

      {apostas.length > 0 && (
        <section className="mt-6 rounded-2xl border border-accent/40 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">
            {apostas.length} apostas geradas
          </h2>
          <p className="text-xs text-muted-foreground">
            Baseadas no ranking dos últimos {concursos.length} concursos · todas diferentes entre si
          </p>
          <ul className="mt-4 space-y-4">
            {apostas.map((jogo, i) => {
              const pares = jogo.filter((n) => n % 2 === 0).length;
              const primos = jogo.filter((n) => PRIMOS.includes(n)).length;
              const soma = jogo.reduce((a, b) => a + b, 0);
              return (
                <li key={jogo.join("-")} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-lg tracking-wide">Aposta {i + 1}</span>
                    <span className="text-xs text-muted-foreground">
                      soma {soma} · {pares} pares / {15 - pares} ímpares · {primos} primos
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-8">
                    {jogo.map((n) => (
                      <div
                        key={n}
                        className="ball-base w-full border border-accent/40 bg-secondary text-xl text-foreground"
                      >
                        {String(n).padStart(2, "0")}
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {simulacao && (
        <section className="mt-6 rounded-2xl border border-primary/40 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Simulação de desempenho</h2>
          <p className="text-xs text-muted-foreground">
            {simulacao.usandoJogoUnico
              ? "Jogo gerado"
              : `${simulacao.porAposta.length} apostas`}{" "}
            conferidas contra os {concursos.length} concursos analisados ·{" "}
            {simulacao.sorteios} conferências
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {FAIXAS.map((f) => {
              const qtd = simulacao.geral[f];
              const perc = (qtd / simulacao.sorteios) * 100;
              return (
                <div key={f} className="rounded-xl border border-border p-3">
                  <p className="font-display text-xl tracking-wide">{f} acertos</p>
                  <p className="text-2xl font-semibold">{qtd}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {perc.toFixed(1)}% · {PREMIO_MEDIO[f]}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Média de acertos por conferência:{" "}
            <strong className="text-foreground">{simulacao.mediaGeral.toFixed(2)}</strong> · a cada
            100 apostas jogadas nesses concursos, a estimativa é de{" "}
            <strong className="text-foreground">
              {((simulacao.geral[11] +
                simulacao.geral[12] +
                simulacao.geral[13] +
                simulacao.geral[14] +
                simulacao.geral[15]) /
                simulacao.sorteios *
                100).toFixed(1)}
            </strong>{" "}
            jogos premiados (11+ acertos).
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2">Aposta</th>
                  {FAIXAS.map((f) => (
                    <th key={f} className="py-2 text-center">
                      {f}
                    </th>
                  ))}
                  <th className="py-2 text-center">Média</th>
                  <th className="py-2 text-center">Melhor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {simulacao.porAposta.map((r, i) => (
                  <tr key={r.jogo.join("-")}>
                    <td className="py-2 font-display tracking-wide">
                      {simulacao.usandoJogoUnico ? "Jogo gerado" : `Aposta ${i + 1}`}
                    </td>
                    {FAIXAS.map((f) => (
                      <td
                        key={f}
                        className={`py-2 text-center ${
                          r.faixas[f] > 0 ? "font-semibold text-accent" : "text-muted-foreground"
                        }`}
                      >
                        {r.faixas[f]}
                      </td>
                    ))}
                    <td className="py-2 text-center">{r.media.toFixed(2)}</td>
                    <td className="py-2 text-center font-semibold">{r.melhor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            A simulação é retrospectiva: mostra como cada aposta teria se saído nos concursos já
            realizados. Não é previsão de resultados futuros.
          </p>
        </section>
      )}


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
