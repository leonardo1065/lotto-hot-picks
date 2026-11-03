import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { buscarConcursosMegaSena, type ConcursoMegaSena } from "@/lib/megasena.functions";

const TODAS = Array.from({ length: 60 }, (_, i) => i + 1);
const JANELAS = [10, 20, 30, 40, 60, 100];
const TAMANHOS = Array.from({ length: 15 }, (_, i) => i + 6);
const fmt = new Intl.NumberFormat("pt-BR");
function combinacao(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - i + 1) / i;
  return r;
}
function chance(tamanho: number, minimo: number): string {
  let casos = 0;
  for (let acertos = minimo; acertos <= Math.min(6, tamanho); acertos++) {
    casos += combinacao(tamanho, acertos) * combinacao(60 - tamanho, 6 - acertos);
  }
  return casos ? "1 em " + fmt.format(Math.round(combinacao(60, 6) / casos)) : "—";
}

export function MegaSena({ onVoltar }: { onVoltar: () => void }) {
  const buscar = useServerFn(buscarConcursosMegaSena);
  const [quantidade, setQuantidade] = useState(20);
  const [fixas, setFixas] = useState<number[]>([]);
  const [tamanho, setTamanho] = useState(6);
  const [quantidadeCartoes, setQuantidadeCartoes] = useState(3);
  const [cartoes, setCartoes] = useState<number[][]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const { data: concursos = [], isFetching, isError, dataUpdatedAt, refetch } = useQuery<ConcursoMegaSena[]>({
    queryKey: ["megasena", quantidade],
    queryFn: () => buscar({ data: { quantidade } }),
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 60 * 1000,
    staleTime: 0,
  });
  const frequencias = useMemo(() => {
    const mapa = new Map(TODAS.map((n) => [n, 0]));
    concursos.forEach((c) => c.dezenas.forEach((n) => mapa.set(n, (mapa.get(n) ?? 0) + 1)));
    return mapa;
  }, [concursos]);
  const ranking = useMemo(() => [...TODAS].sort((a, b) => (frequencias.get(b) ?? 0) - (frequencias.get(a) ?? 0) || a - b), [frequencias]);
  const sugestao = ranking.slice(0, 6);
  const toggle = (n: number) => setFixas((antes) => antes.includes(n) ? antes.filter((x) => x !== n) : [...antes, n].sort((a, b) => a - b));

  const gerar = () => {
    if (fixas.length > tamanho) { setErro("A quantidade de dezenas fixas excede o tamanho da aposta."); return; }
    if (!concursos.length) { setErro("Aguarde os resultados oficiais da Caixa carregarem."); return; }
    setErro(null);
    const base = ranking.filter((n) => !fixas.includes(n));
    const novos: number[][] = [];
    const vistos = new Set<string>();
    for (let i = 0; i < quantidadeCartoes && novos.length < 100; i++) {
      const complemento: number[] = [];
      const inicio = base.length ? (i * Math.max(1, tamanho - fixas.length)) % base.length : 0;
      for (let p = 0; p < base.length && fixas.length + complemento.length < tamanho; p++) {
        const n = base[(inicio + p) % base.length];
        if (!complemento.includes(n)) complemento.push(n);
      }
      const jogo = [...fixas, ...complemento].sort((a, b) => a - b);
      const key = jogo.join(",");
      if (jogo.length === tamanho && !vistos.has(key)) { vistos.add(key); novos.push(jogo); }
    }
    setCartoes(novos);
    if (novos.length < quantidadeCartoes) setErro("Só foi possível formar " + novos.length + " combinações diferentes com as dezenas fixas.");
  };

  const analise = useMemo(() => {
    if (!cartoes.length || !concursos.length) return null;
    const linhas = cartoes.map((jogo, i) => {
      const pontos = concursos.map((c) => jogo.filter((n) => c.dezenas.includes(n)).length);
      return { indice: i + 1, jogo, melhor: Math.max(...pontos), media: pontos.reduce((a, b) => a + b, 0) / pontos.length };
    });
    return { melhor: Math.max(...linhas.map((l) => l.melhor)), media: linhas.reduce((a, l) => a + l.media, 0) / linhas.length, linhas };
  }, [cartoes, concursos]);

  return <div className="min-h-screen bg-background pb-20 text-foreground"><main className="mx-auto w-full max-w-5xl px-5 py-8">
    <header className="mb-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-sm tracking-[0.35em] text-accent">MEGA-SENA · CAIXA</p><h1 className="mt-3 font-display text-5xl leading-none tracking-wide sm:text-6xl">Gerador Mega-Sena</h1></div><button onClick={onVoltar} className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground">Voltar à Lotofácil</button></div><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Analise concursos oficiais, escolha dezenas fixas e gere apostas de 6 a 20 dezenas. Frequências históricas descrevem resultados passados e não preveem sorteios futuros.</p></header>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-panel">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-2xl tracking-wide">Histórico e estatísticas</h2><p className="mt-1 text-xs text-muted-foreground">{isFetching ? "Consultando a Caixa..." : concursos.length + " concursos carregados" + (dataUpdatedAt ? " · atualizado " + new Date(dataUpdatedAt).toLocaleTimeString("pt-BR") : "")}</p></div><div className="flex items-center gap-2"><label htmlFor="mega-janela" className="text-xs text-muted-foreground">Concursos</label><select id="mega-janela" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className="rounded-xl border border-border bg-secondary px-3 py-2 text-foreground">{JANELAS.map((n) => <option key={n} value={n}>Últimos {n}</option>)}</select><button onClick={() => void refetch()} className="rounded-full border border-border px-3 py-2 text-xs hover:border-primary">Atualizar</button></div></div>
      {isError && <p role="alert" className="mt-3 text-sm text-destructive">Não foi possível consultar os resultados oficiais da Caixa.</p>}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Concursos analisados</p><p className="mt-1 font-display text-2xl">{concursos.length}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Último concurso</p><p className="mt-1 font-display text-2xl">{concursos[0]?.concurso ?? "—"}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Data do sorteio</p><p className="mt-1 font-display text-lg">{concursos[0]?.data ?? "—"}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Maior frequência</p><p className="mt-1 font-display text-2xl">{Math.max(0, ...frequencias.values())} <span className="text-sm">vezes</span></p></div></div>
      <h3 className="mt-6 font-display text-xl tracking-wide">Frequência das dezenas 01–60</h3><div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10 md:grid-cols-12">{TODAS.map((n) => <div key={n} title={(frequencias.get(n) ?? 0) + " aparições"} className="rounded-lg border border-border bg-secondary/60 p-2 text-center"><span className="font-display text-lg">{String(n).padStart(2, "0")}</span><span className="block text-[10px] text-muted-foreground">{frequencias.get(n) ?? 0}</span></div>)}</div>
      <h3 className="mt-6 font-display text-xl tracking-wide">Concursos recentes</h3><div className="mt-3 space-y-2">{concursos.slice(0, 5).map((c) => <div key={c.concurso} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"><span className="text-xs text-muted-foreground">#{c.concurso} · {c.data}</span><div className="flex gap-1.5">{[...c.dezenas].sort((a, b) => a - b).map((n) => <span key={n} className="ball-base size-8 border border-accent bg-accent text-sm text-accent-foreground">{String(n).padStart(2, "0")}</span>)}</div></div>)}</div>
    </section>
    <section className="mt-6 rounded-2xl border border-accent/50 bg-card p-5 shadow-panel"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-2xl tracking-wide">Montar apostas</h2><p className="mt-1 text-sm text-muted-foreground">Marque dezenas fixas manualmente ou use as seis mais frequentes na janela selecionada.</p></div><button onClick={() => { setFixas(sugestao); setErro(null); }} disabled={!concursos.length} className="rounded-full border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-accent-foreground disabled:opacity-50">Sugerir melhores 6</button></div>
      <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10 md:grid-cols-12">{TODAS.map((n) => { const active = fixas.includes(n); return <button key={n} type="button" aria-pressed={active} onClick={() => toggle(n)} className={"ball-base size-10 border text-base transition " + (active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-secondary text-foreground hover:border-accent")}>{String(n).padStart(2, "0")}</button>; })}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{fixas.length} dezena(s) fixa(s); a frequência completa o restante.</span><button onClick={() => setFixas([])} className="underline underline-offset-4">Limpar seleção</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="text-sm">Dezenas por aposta<select value={tamanho} onChange={(e) => setTamanho(Number(e.target.value))} className="mt-1 block w-full rounded-xl border border-border bg-secondary px-3 py-2">{TAMANHOS.map((n) => <option key={n} value={n}>{n} dezenas</option>)}</select></label><label className="text-sm">Quantidade de cartões<input type="number" min={1} max={100} value={quantidadeCartoes} onChange={(e) => setQuantidadeCartoes(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} className="mt-1 block w-full rounded-xl border border-border bg-secondary px-3 py-2" /></label><div className="flex items-end"><button onClick={gerar} className="w-full rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">Gerar cartões</button></div></div>
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      {!!cartoes.length && <div className="mt-5 space-y-2"><h3 className="font-display text-xl tracking-wide">{cartoes.length} cartões gerados</h3>{cartoes.map((jogo, i) => <div key={jogo.join("-")} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3"><span className="w-24 text-xs text-muted-foreground">Cartão {i + 1}</span>{jogo.map((n) => <span key={n} className="ball-base size-9 border border-accent bg-accent text-sm text-accent-foreground">{String(n).padStart(2, "0")}</span>)}</div>)}</div>}
    </section>
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel"><h2 className="font-display text-2xl tracking-wide">Probabilidades matemáticas</h2><p className="mt-1 text-xs text-muted-foreground">Probabilidade de acertar pelo menos 4, 5 ou 6 dezenas em um sorteio, calculada pela distribuição combinatória 6 entre 60.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="p-2">Dezenas</th><th className="p-2">Quadra ou mais</th><th className="p-2">Quina ou mais</th><th className="p-2">Sena</th></tr></thead><tbody>{TAMANHOS.map((n) => <tr key={n} className={"border-b border-border/60 " + (n === tamanho ? "bg-accent/10" : "")}><td className="p-2 font-semibold">{n}</td><td className="p-2">{chance(n, 4)}</td><td className="p-2">{chance(n, 5)}</td><td className="p-2">{chance(n, 6)}</td></tr>)}</tbody></table></div><p className="mt-2 text-xs text-muted-foreground">Os valores são calculados por combinações possíveis (C(n,k) × C(60−n,6−k) / C(60,6)).</p></section>
    {analise && <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel"><h2 className="font-display text-2xl tracking-wide">Análise histórica dos cartões</h2><p className="mt-1 text-sm text-muted-foreground">Comparação com os {concursos.length} concursos carregados. Melhor pontuação: {analise.melhor} acertos · média geral: {analise.media.toFixed(2)}.</p><div className="mt-3 space-y-2">{analise.linhas.map((l) => <div key={l.indice} className="flex flex-wrap justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"><span>Cartão {l.indice}</span><span>Melhor: {l.melhor} · média: {l.media.toFixed(2)} acertos</span></div>)}</div></section>}
    <footer className="mt-8 text-center text-xs text-muted-foreground">Resultados consultados diretamente no <a className="underline" href="https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx" target="_blank" rel="noreferrer">Portal Loterias CAIXA</a>.</footer>
  </main></div>;
}
