import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { buscarConcursos, buscarConcurso, type ConcursoResultado } from "@/lib/lotofacil.functions";
import { exigirAcesso, sair } from "@/lib/gate.functions";
import {
  listarCartoes,
  salvarCartoesNuvem,
  removerCartoesNuvem,
  type LoteCartoes,
} from "@/lib/cartoes.functions";


export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { autorizado } = await exigirAcesso();
    if (!autorizado) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Lotofácil Expert | Estratégias e Conferência Automática" },
      {
        name: "description",
        content:
          "tirar as decriçoes que estao abaixo do gerador, tentar fechar a moior combinaçao possivel para acerto com 13 pontos com a escolha de cartoes a gera mos os 3 cartoes mais forte para acertos",
      },
      { property: "og:title", content: "Lotofácil Expert" },
      {
        property: "og:description",
        content:
          "Estratégias avançadas, ranking de dezenas e conferência automática de cartões salvos.",
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

function formatarDataHora(ms: number) {
  return new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RelogioLocal() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl border border-primary/40 bg-card/70 px-4 py-3">
      <p className="w-full text-[10px] uppercase tracking-[0.25em] text-accent">Data e hora local</p>
      <p className="font-display text-2xl leading-tight tracking-wide tabular-nums">
        {agora
          ? agora.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "--:--:--"}
      </p>
      <p className="text-xs capitalize text-muted-foreground">
        {agora
          ? agora.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "—"}
      </p>
    </div>
  );
}
const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23];
const FAIXAS = [15, 14, 13, 12, 11];
const PREMIO_MEDIO: Record<number, string> = {
  15: "prêmio principal",
  14: "~R$ 1.900",
  13: "~R$ 30",
  12: "~R$ 12",
  11: "~R$ 6",
};

const STORAGE_RODADAS = "lotofacil:rodadas";
const STORAGE_CARTOES = "lotofacil:cartoes";

type Rodada = {
  id: string;
  criadaEm: number;
  janela: number;
  concursoTopo?: number;
  cartoes: number;
  dezenasAtivas: number;
  jogos: number[][];
  media: number;
  premiados: number;
  faixas: Record<number, number>;
  sorteios: number;
};

type CartoesSalvos = LoteCartoes;



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
  const [historicoAtivas, setHistoricoAtivas] = useState<number[][]>([]);
  const [geradas, setGeradas] = useState<number[]>([]);
  const [qtdApostas, setQtdApostas] = useState(5);
  const [apostas, setApostas] = useState<number[][]>([]);
  const [geradoEm, setGeradoEm] = useState<number | null>(null);
  const [geradasEm, setGeradasEm] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [comparar, setComparar] = useState<string[]>([]);
  const [conferirId, setConferirId] = useState<string | null>(null);
  const [concursoAlvo, setConcursoAlvo] = useState<string>("");
  const [salvandoCartoes, setSalvandoCartoes] = useState(false);

  const [numSimulacoes, setNumSimulacoes] = useState(100);
  const listar = useServerFn(listarCartoes);
  const salvarNuvem = useServerFn(salvarCartoesNuvem);
  const removerNuvem = useServerFn(removerCartoesNuvem);

  const {
    data: salvos = [],
    refetch: recarregarSalvos,
    isFetching: carregandoSalvos,
  } = useQuery({
    queryKey: ["cartoes-salvos"],
    queryFn: () => listar(),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_RODADAS);
      if (raw) setRodadas(JSON.parse(raw) as Rodada[]);
    } catch {
      /* histórico indisponível */
    }
  }, []);

  // migra uma única vez os cartões que ficaram salvos no navegador para a nuvem
  useEffect(() => {
    const migrar = async () => {
      try {
        const rawC = localStorage.getItem(STORAGE_CARTOES);
        if (!rawC) return;
        const antigos = JSON.parse(rawC) as CartoesSalvos[];
        localStorage.removeItem(STORAGE_CARTOES);
        for (const lote of antigos.slice(0, 20).reverse()) {
          if (!lote?.jogos?.length) continue;
          await salvarNuvem({
            data: {
              janela: lote.janela ?? 0,
              concursoTopo: lote.concursoTopo ?? null,
              jogos: lote.jogos,
            },
          });
        }
        await recarregarSalvos();
      } catch {
        /* migração opcional */
      }
    };
    void migrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistir = (lista: Rodada[]) => {
    setRodadas(lista);
    try {
      localStorage.setItem(STORAGE_RODADAS, JSON.stringify(lista));
    } catch {
      /* ignora falha de armazenamento */
    }
  };







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

  const alternar = (n: number) => {
    setHistoricoAtivas((prev) => [ativas, ...prev].slice(0, 50));
    setAtivas((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b),
    );
  };

  const desfazer = () => {
    if (historicoAtivas.length === 0) return;
    const [anterior, ...resto] = historicoAtivas;
    setAtivas(anterior);
    setHistoricoAtivas(resto);
  };

  const validarJogoOtimizado = (jogo: number[]) => {
    const p = jogo.filter((n) => n % 2 === 0).length;
    // Padrão comum: 7:8 ou 8:7 pares/ímpares
    if (p < 7 || p > 8) return false;
    
    const pr = jogo.filter((n) => PRIMOS.includes(n)).length;
    // Padrão comum: 5 ou 6 primos
    if (pr < 5 || pr > 6) return false;

    const s = jogo.reduce((a, b) => a + b, 0);
    // Padrão comum: soma entre 180 e 210
    if (s < 180 || s > 210) return false;

    return true;
  };

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
    setGeradasEm(Date.now());
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

    // Tentamos gerar jogos equilibrados (otimizados) primeiro
    while (novas.length < qtdApostas && tentativas < qtdApostas * 100) {
      tentativas++;
      const jogoSet = new Set<number>([
        ...sortearPonderado(poolQuentes, Math.min(8, poolQuentes.length)),
        ...sortearPonderado(poolMornas, Math.min(5, poolMornas.length)),
        ...sortearPonderado(poolFrias, Math.min(2, poolFrias.length)),
      ]);
      
      if (jogoSet.size < 15) {
         const extras = sortearPonderado(poolTodas, poolTodas.length);
         for (const p of extras) {
           if (jogoSet.size >= 15) break;
           jogoSet.add(p);
         }
      }

      if (jogoSet.size < 15) continue;
      const lista = [...jogoSet].slice(0, 15).sort((a, b) => a - b);
      const chave = lista.join("-");
      if (vistas.has(chave)) continue;

      // Na primeira metade das tentativas, buscamos jogos "perfeitos" estatisticamente
      if (tentativas < qtdApostas * 50) {
        if (!validarJogoOtimizado(lista)) continue;
      }

      vistas.add(chave);
      novas.push(lista);
    }

    setApostas(novas);
    setGeradoEm(Date.now());
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

    // Se o usuário pedir muitas simulações, podemos usar um subconjunto aleatório ou repetir
    // mas aqui a simulação é contra o histórico real dos concursos carregados.
    // O pedido do usuário diz "recalcular a chance... com base nas simulações realizadas".
    // Vou ajustar para que o cálculo use numSimulacoes concursos aleatórios do histórico (se disponíveis)
    // ou simplesmente limitar a janela de análise se for o caso, mas o mais lógico é
    // que ele queira rodar X simulações estocásticas se fosse sorteio puro.
    // Como estamos baseados em concursos REAIS, vou usar a janela de concursos carregada.
    
    const porAposta = jogosParaSimular.map((jogo) => {
      const set = new Set(jogo);
      const faixas = zeroFaixas();
      let totalAcertos = 0;
      let melhor = 0;
      
      // Se numSimulacoes for maior que concursos.length, repetimos com variação ou usamos apenas o total.
      // Aqui vamos respeitar o numSimulacoes fazendo sorteios aleatórios do histórico
      for (let i = 0; i < numSimulacoes; i++) {
        const c = concursos[Math.floor(Math.random() * concursos.length)];
        if (!c) continue;
        
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
      sorteiosGeral += numSimulacoes;
      return {
        jogo,
        faixas,
        media: totalAcertos / numSimulacoes,
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
  }, [apostas, geradas, concursos, numSimulacoes]);

  // top 3 cartões: score histórico ponderado pelas faixas de premiação + média de acertos
  const melhores = useMemo(() => {
    if (!simulacao || simulacao.usandoJogoUnico || simulacao.porAposta.length < 2) return null;
    const PESO: Record<number, number> = { 11: 1, 12: 5, 13: 50, 14: 200, 15: 1000 };
    return simulacao.porAposta
      .map((r, i) => ({
        ...r,
        indice: i + 1,
        score: FAIXAS.reduce((a, f) => a + r.faixas[f] * PESO[f], 0) + r.media * 2,
      }))
      .sort((a, b) => b.score - a.score || b.media - a.media)
      .slice(0, 3);
  }, [simulacao]);

  const salvarRodada = () => {
    if (!simulacao) {
      setErro("Gere ao menos um cartão para salvar a rodada.");
      return;
    }
    setErro(null);
    const faixas: Record<number, number> = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 };
    for (const f of FAIXAS) faixas[f] = simulacao.geral[f];
    const nova: Rodada = {
      id: `${Date.now()}`,
      criadaEm: Date.now(),
      janela: concursos.length,
      concursoTopo: concursos[0]?.concurso,
      cartoes: simulacao.porAposta.length,
      dezenasAtivas: ativas.length,
      jogos: simulacao.porAposta.map((r) => r.jogo),
      media: simulacao.mediaGeral,
      premiados: FAIXAS.reduce((a, f) => a + faixas[f], 0),
      faixas,
      sorteios: simulacao.sorteios,
    };
    persistir([nova, ...rodadas].slice(0, 12));
    setComparar((prev) => [nova.id, ...prev].slice(0, 3));
  };

  const alternarComparacao = (id: string) =>
    setComparar((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-3),
    );

  const removerRodada = (id: string) => {
    persistir(rodadas.filter((r) => r.id !== id));
    setComparar((prev) => prev.filter((x) => x !== id));
  };

  const rodadasComparadas = rodadas.filter((r) => comparar.includes(r.id));

  // ---- cartões salvos e conferência com o resultado oficial ----
  const salvarCartoes = async () => {
    const jogos = apostas.length ? apostas : geradas.length === 15 ? [geradas] : [];
    if (!jogos.length) {
      setErro("Gere ao menos um cartão para salvar.");
      return;
    }
    setErro(null);
    setSalvandoCartoes(true);
    try {
      const novo = await salvarNuvem({
        data: {
          janela: concursos.length,
          concursoTopo: concursos[0]?.concurso ?? null,
          jogos,
        },
      });
      await recarregarSalvos();
      setConferirId(novo.id);
    } catch {
      setErro("Não foi possível salvar os cartões na nuvem. Tente de novo.");
    } finally {
      setSalvandoCartoes(false);
    }
  };

  const removerCartoes = async (id: string) => {
    try {
      await removerNuvem({ data: { id } });
      await recarregarSalvos();
      setConferirId((prev) => (prev === id ? null : prev));
    } catch {
      setErro("Não foi possível remover este lote.");
    }
  };


  const buscarUm = useServerFn(buscarConcurso);
  const numeroAlvo = concursoAlvo.trim() ? Number(concursoAlvo.trim()) : null;
  const {
    data: sorteioOficial,
    isFetching: conferindo,
    isError: erroConferencia,
    refetch: recarregarSorteio,
  } = useQuery<ConcursoResultado>({
    queryKey: ["lotofacil-concurso", numeroAlvo ?? "latest"],
    queryFn: () => buscarUm({ data: { numero: numeroAlvo } }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const cartaoConferido = salvos.find((c) => c.id === conferirId) ?? salvos[0] ?? null;

  const conferencia = useMemo(() => {
    if (!cartaoConferido || !sorteioOficial) return null;
    const set = new Set(sorteioOficial.dezenas);
    const linhas = cartaoConferido.jogos.map((jogo, i) => {
      const acertadas = jogo.filter((n) => set.has(n));
      return { indice: i + 1, jogo, acertadas, acertos: acertadas.length };
    });
    const faixas: Record<number, number> = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 };
    for (const l of linhas) if (l.acertos >= 11) faixas[l.acertos] += 1;
    const premiados = FAIXAS.reduce((a, f) => a + faixas[f], 0);
    return {
      linhas: [...linhas].sort((a, b) => b.acertos - a.acertos),
      faixas,
      premiados,
      melhor: Math.max(...linhas.map((l) => l.acertos)),
      media: linhas.reduce((a, l) => a + l.acertos, 0) / linhas.length,
    };
  }, [cartaoConferido, sorteioOficial]);




  const zerar = () => {
    setHistoricoAtivas((prev) => [ativas, ...prev].slice(0, 50));
    setAtivas([]);
    setGeradas([]);
    setApostas([]);
    setGeradoEm(null);
    setGeradasEm(null);
  };

  const sairFn = useServerFn(sair);
  const router = useRouter();
  const sairDoApp = async () => {
    await sairFn();
    await router.navigate({ to: "/login" });
  };

  // Conferência automática ao carregar
  useEffect(() => {
    if (concursos.length > 0 && salvos.length > 0 && !conferirId) {
      // Se temos concursos e cartões salvos, mas não estamos conferindo um lote específico,
      // sugerimos conferir o lote mais recente com o último concurso.
      setConferirId(salvos[0].id);
      setConcursoAlvo(String(concursos[0].concurso));
    }
  }, [concursos, salvos, conferirId]);

  const statsRanking = useMemo(() => {
    // Helper para calcular ranking em diferentes janelas
    const calcularPara = (qtd: number) => {
      const sub = concursos.slice(0, Math.min(qtd, concursos.length));
      if (sub.length === 0) return ranking;
      const mapa = new Map<number, number>();
      for (const c of sub) {
        for (const d of c.dezenas) mapa.set(d, (mapa.get(d) ?? 0) + 1);
      }
      return TODAS.map((n) => ({ n, freq: mapa.get(n) ?? 0 })).sort((a, b) => b.freq - a.freq);
    };

    return {
      j10: calcularPara(10),
      j20: calcularPara(20),
      j30: calcularPara(30),
      j50: calcularPara(50),
    };
  }, [concursos, ranking]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
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
        <div className="mt-4">
          <RelogioLocal />
        </div>
        <h1 className="font-display text-5xl leading-none tracking-wide sm:text-6xl">
          Gerador de 15 dezenas
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          tirar as decriçoes que estao abaixo do gerador, tentar fechar a moior combinaçao possivel para acerto com 13 pontos com a escolha de cartoes a gera mos os 3 cartoes mais forte para acertos
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
            Limpar dezenas
          </button>
          <button
            onClick={() => {
              setHistoricoAtivas((prev) => [ativas, ...prev].slice(0, 50));
              setAtivas(TODAS);
            }}
            className="rounded-full border border-border bg-secondary px-6 py-3 font-display text-xl tracking-wide text-secondary-foreground transition-colors hover:border-primary"
          >
            Marcar todas
          </button>
          <button
            onClick={desfazer}
            disabled={historicoAtivas.length === 0}
            className="rounded-full border border-border bg-secondary px-6 py-3 font-display text-xl tracking-wide text-secondary-foreground transition-colors hover:border-primary disabled:opacity-40"
          >
            Desfazer
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
              max={100}
              value={qtdApostas}
              onChange={(e) =>
                setQtdApostas(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
              }
              className="w-24 rounded-full border border-border bg-input px-4 py-2 text-center font-display text-lg tracking-wide outline-none focus:border-accent"
              aria-label="Quantidade de apostas"
            />
            <button
              onClick={gerarApostas}
              disabled={isFetching}
              className="rounded-full bg-accent px-6 py-2.5 font-display text-lg tracking-wide text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              Gerar {qtdApostas} {qtdApostas === 1 ? "cartão" : "cartões"}
            </button>
            {apostas.length > 0 && (
              <button
                onClick={() => {
                  setApostas([]);
                  setGeradoEm(null);
                }}
                className="rounded-full border border-border px-4 py-2.5 font-display text-lg tracking-wide text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                Limpar
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {qtdApostas} {qtdApostas === 1 ? "cartão" : "cartões"} × 15 dezenas ={" "}
            {qtdApostas * 15} dezenas marcadas · custo estimado{" "}
            <strong className="text-foreground">
              R$ {(qtdApostas * PRECO_CARTAO).toFixed(2).replace(".", ",")}
            </strong>{" "}
            (aposta simples de R$ 3,50)
          </p>
        </div>

        {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}
      </section>

      {apostas.length > 0 && (
        <section className="mt-6 rounded-2xl border border-accent/40 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">
            {apostas.length} {apostas.length === 1 ? "cartão gerado" : "cartões gerados"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Baseados no ranking dos últimos {concursos.length} concursos · todos diferentes entre si
          </p>
          {geradoEm && (
            <p className="mt-2 inline-block rounded-full border border-accent bg-accent/10 px-4 py-1 font-display text-base tracking-wide text-accent">
              Gerados em {formatarDataHora(geradoEm)}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Cartões</p>
              <p className="font-display text-2xl tracking-wide">{apostas.length}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Data e hora da geração</p>
              <p className="font-display text-2xl tracking-wide">
                {geradoEm ? formatarDataHora(geradoEm) : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Dezenas diferentes usadas</p>
              <p className="font-display text-2xl tracking-wide">
                {new Set(apostas.flat()).size}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Custo estimado</p>
              <p className="font-display text-2xl tracking-wide">
                R$ {(apostas.length * PRECO_CARTAO).toFixed(2).replace(".", ",")}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-4">
            {apostas.map((jogo, i) => {
              const pares = jogo.filter((n) => n % 2 === 0).length;
              const primos = jogo.filter((n) => PRIMOS.includes(n)).length;
              const soma = jogo.reduce((a, b) => a + b, 0);
              return (
                <li key={jogo.join("-")} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-lg tracking-wide">Cartão {i + 1}</span>
                    <span className="text-xs text-muted-foreground">
                      {geradoEm ? `${formatarDataHora(geradoEm)} · ` : ""}soma {soma} · {pares}{" "}
                      pares / {15 - pares} ímpares · {primos} primos
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
          <button
            onClick={salvarCartoes}
            disabled={salvandoCartoes}
            className="mt-4 rounded-full bg-accent px-6 py-3 font-display text-xl tracking-wide text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {salvandoCartoes ? "Salvando na nuvem..." : "Salvar estes cartões para conferir"}
          </button>

        </section>
      )}

      {/* ---- Conferência com o resultado oficial ---- */}
      <section className="mt-6 rounded-2xl border border-accent/60 bg-card p-5 shadow-panel">
        <h2 className="font-display text-2xl tracking-wide">Conferir cartões com o resultado</h2>
        <p className="text-xs text-muted-foreground">
          Os cartões ficam salvos na nuvem da sua conta — dá para conferir de qualquer dispositivo,
          com o último concurso da Caixa ou um concurso específico.
          {carregandoSalvos ? " Carregando seus cartões..." : ""}
        </p>

        {(apostas.length > 0 || geradas.length === 15) && (
          <button
            onClick={salvarCartoes}
            disabled={salvandoCartoes}
            className="mt-4 rounded-full bg-accent px-6 py-3 font-display text-xl tracking-wide text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {salvandoCartoes
              ? "Salvando na nuvem..."
              : `Salvar cartões gerados agora (${apostas.length || 1})`}
          </button>
        )}




        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-[11px] text-muted-foreground">Concurso (vazio = último)</span>
            <input
              value={concursoAlvo}
              onChange={(e) => setConcursoAlvo(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="ex.: 3200"
              className="mt-1 w-40 rounded-xl border border-border bg-secondary px-3 py-2 text-foreground"
            />
          </label>
          <button
            onClick={() => recarregarSorteio()}
            className="rounded-full border border-accent px-5 py-2 font-display text-lg tracking-wide"
          >
            {conferindo ? "Buscando..." : "Atualizar resultado"}
          </button>
        </div>

        {erroConferencia && (
          <p className="mt-3 text-sm text-destructive">
            Não foi possível carregar esse concurso. Confira o número e tente de novo.
          </p>
        )}

        {sorteioOficial && (
          <div className="mt-4 rounded-xl border border-border p-3">
            <p className="font-display text-lg tracking-wide">
              Concurso {sorteioOficial.concurso} · {sorteioOficial.data}
            </p>
            <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-8">
              {[...sorteioOficial.dezenas].sort((a, b) => a - b).map((n) => (
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

        {salvos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum cartão salvo ainda. Gere os cartões e use “Salvar estes cartões para conferir”.
          </p>
        ) : (
          <>
            <ul className="mt-4 space-y-2 text-sm">
              {salvos.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
                >
                  <label className="flex flex-1 items-center gap-3">
                    <input
                      type="radio"
                      name="cartoes-salvos"
                      checked={cartaoConferido?.id === c.id}
                      onChange={() => setConferirId(c.id)}
                    />
                    <span>
                      {c.jogos.length} {c.jogos.length === 1 ? "cartão" : "cartões"} ·{" "}
                      {formatarDataHora(c.criadoEm)}
                      {c.concursoTopo ? ` · base até #${c.concursoTopo}` : ""}
                    </span>
                  </label>
                  <button
                    onClick={() => removerCartoes(c.id)}
                    className="text-xs text-muted-foreground underline"
                  >
                    remover
                  </button>
                </li>
              ))}
            </ul>

            {conferencia && sorteioOficial && (
              <div className="mt-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] text-muted-foreground">Cartões conferidos</p>
                    <p className="font-display text-2xl tracking-wide">
                      {conferencia.linhas.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] text-muted-foreground">Melhor cartão</p>
                    <p className="font-display text-2xl tracking-wide">
                      {conferencia.melhor} acertos
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] text-muted-foreground">Média de acertos</p>
                    <p className="font-display text-2xl tracking-wide">
                      {conferencia.media.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[11px] text-muted-foreground">Cartões premiados</p>
                    <p className="font-display text-2xl tracking-wide">{conferencia.premiados}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {FAIXAS.map((f) => (
                    <span key={f} className="rounded-full border border-border px-3 py-1">
                      {f} acertos: <strong>{conferencia.faixas[f]}</strong> ({PREMIO_MEDIO[f]})
                    </span>
                  ))}
                </div>

                <ul className="mt-4 space-y-3">
                  {conferencia.linhas.map((l) => (
                    <li key={l.jogo.join("-")} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-display text-lg tracking-wide">
                          Cartão {l.indice}
                        </span>
                        <span
                          className={`text-sm ${l.acertos >= 11 ? "text-accent" : "text-muted-foreground"}`}
                        >
                          {l.acertos} acertos {l.acertos >= 11 ? "· premiado" : ""}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-8">
                        {l.jogo.map((n) => {
                          const acertou = l.acertadas.includes(n);
                          return (
                            <div
                              key={n}
                              className={`ball-base w-full border text-xl ${
                                acertou
                                  ? "border-accent bg-accent text-accent-foreground"
                                  : "border-border bg-secondary text-muted-foreground"
                              }`}
                            >
                              {String(n).padStart(2, "0")}
                            </div>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>



      {melhores && (
        <section className="mt-6 rounded-2xl border border-accent/60 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Os 3 melhores cartões</h2>
          <p className="text-xs text-muted-foreground">
            Exibir para cada um dos 3 cartões gerados uma estimativa de chance de alcançar 13 pontos com base nas simulações realizadas.
          </p>
          <ol className="mt-4 space-y-4">
            {melhores.map((r, pos) => (
              <li
                key={r.jogo.join("-")}
                className="rounded-xl border border-accent/40 bg-secondary/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-lg tracking-wide text-accent">
                    {pos + 1}º · Cartão {r.indice}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    média {r.media.toFixed(2)} · melhor {r.melhor} acertos · {r.premiados} vezes
                    premiado
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-8">
                  {r.jogo.map((n) => (
                    <div
                      key={n}
                      className="ball-base w-full border border-accent bg-accent/15 text-xl text-foreground"
                    >
                      {String(n).padStart(2, "0")}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {FAIXAS.map((f) => (
                      <span key={f}>
                        {f} pts: <strong className="text-foreground">{r.faixas[f]}</strong>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 border border-accent/20">
                    <span className="text-[10px] uppercase tracking-wider text-accent font-semibold">Chance estimada 13 pts:</span>
                    <span className="text-sm font-bold text-foreground">
                      {((r.faixas[13] / concursos.length) * 100).toFixed(2)}%
                    </span>
                    <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-accent/10">
                      <div 
                        className="h-full bg-accent transition-all" 
                        style={{ width: `${Math.min(100, (r.faixas[13] / concursos.length) * 1000)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Os 3 melhores cartões são selecionados priorizando a pontuação de 13 pontos e a média histórica mais alta.
          </p>
        </section>
      )}


      {simulacao && (
        <section className="mt-6 rounded-2xl border border-primary/40 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Desempenho da rodada</h2>
          <p className="text-xs text-muted-foreground">
            {simulacao.usandoJogoUnico
              ? "Jogo gerado"
              : `${simulacao.porAposta.length} apostas`}{" "}
            conferidas contra os {concursos.length} concursos analisados
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


          <button
            onClick={salvarRodada}
            className="mt-4 rounded-full bg-accent px-6 py-3 font-display text-xl tracking-wide text-accent-foreground transition-transform hover:-translate-y-0.5"
          >
            Salvar esta rodada
          </button>
        </section>
      )}

      {rodadas.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Rodadas salvas</h2>
          <p className="text-xs text-muted-foreground">
            Marque até 3 rodadas para comparar lado a lado.
          </p>

          <ul className="mt-4 space-y-2 text-sm">
            {rodadas.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
              >
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={comparar.includes(r.id)}
                    onChange={() => alternarComparacao(r.id)}
                    className="size-4 accent-current"
                  />
                  <span>
                    <strong className="font-display text-lg tracking-wide">
                      {r.cartoes} cartão(ões)
                    </strong>{" "}
                    · janela {r.janela} concursos
                    {r.concursoTopo ? ` (até #${r.concursoTopo})` : ""} · {r.dezenasAtivas} dezenas
                    ativas
                    <span className="block text-xs text-muted-foreground">
                      {formatarDataHora(r.criadaEm)} · média {r.media.toFixed(2)} ·{" "}
                      {r.premiados} premiações
                    </span>
                  </span>
                </label>
                <button
                  onClick={() => removerRodada(r.id)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>

          {rodadasComparadas.length > 1 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 text-left">Métrica</th>
                    {rodadasComparadas.map((r) => (
                      <th key={r.id} className="py-2 text-center">
                        {new Date(r.criadaEm).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { rotulo: "Cartões", valor: (r: Rodada) => String(r.cartoes) },
                    { rotulo: "Janela (concursos)", valor: (r: Rodada) => String(r.janela) },
                    { rotulo: "Dezenas ativas", valor: (r: Rodada) => String(r.dezenasAtivas) },
                    { rotulo: "Conferências", valor: (r: Rodada) => String(r.sorteios) },
                    { rotulo: "Média de acertos", valor: (r: Rodada) => r.media.toFixed(2) },
                    { rotulo: "Total premiado", valor: (r: Rodada) => String(r.premiados) },
                    ...FAIXAS.map((f) => ({
                      rotulo: `${f} acertos`,
                      valor: (r: Rodada) => String(r.faixas[f] ?? 0),
                    })),
                    {
                      rotulo: "Premiação por cartão",
                      valor: (r: Rodada) => (r.premiados / Math.max(1, r.cartoes)).toFixed(2),
                    },
                  ].map((linha) => (
                    <tr key={linha.rotulo} className="border-b border-border/60">
                      <td className="py-2 text-muted-foreground">{linha.rotulo}</td>
                      {rodadasComparadas.map((r) => (
                        <td key={r.id} className="py-2 text-center font-display text-lg">
                          {linha.valor(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}




      {geradas.length > 0 && (
        <section className="mt-6 rounded-2xl border border-primary/40 bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Seu jogo gerado</h2>
          <p className="text-xs text-muted-foreground">
            Baseado em {concursos.length} concursos · até o concurso {concursos[0]?.concurso} (
            {concursos[0]?.data})
          </p>
          {geradasEm && (
            <p className="mt-2 inline-block rounded-full border border-primary bg-primary/10 px-4 py-1 font-display text-base tracking-wide text-primary">
              Gerado em {formatarDataHora(geradasEm)}
            </p>
          )}
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

      {concursos.length > 0 && statsRanking && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-panel">
          <h2 className="font-display text-2xl tracking-wide">Melhor estratégia entre concursos</h2>
          <p className="text-xs text-muted-foreground">
            Comparação das dezenas mais sorteadas em diferentes janelas de concursos.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "10 Concursos", data: statsRanking.j10 },
              { label: "20 Concursos", data: statsRanking.j20 },
              { label: "30 Concursos", data: statsRanking.j30 },
              { label: "50 Concursos", data: statsRanking.j50 },
            ].map((janela) => (
              <div key={janela.label} className="rounded-xl border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{janela.label}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {janela.data.slice(0, 5).map(r => (
                    <span key={r.n} className="ball-base size-7 text-xs border border-accent/40 bg-secondary">
                      {String(r.n).padStart(2, "0")}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
            onClick={() => {
              setGeradas(sugestaoEstrategica);
              setGeradasEm(Date.now());
            }}
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
    </div>
  );
}
