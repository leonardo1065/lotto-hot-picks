export const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23];
export const MOLDURA = [1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25];

export type Estrategia = "equilibrada" | "quentes" | "atrasadas" | "cobertura";

export const ESTRATEGIAS: { id: Estrategia; nome: string; resumo: string }[] = [
  { id: "equilibrada", nome: "Equilibrada", resumo: "pesos dinâmicos · 8 quentes · 5 mornas · 2 frias" },
  { id: "quentes", nome: "Foco nas quentes", resumo: "pesos dinâmicos · 11 quentes · 4 mornas" },
  { id: "atrasadas", nome: "Atrasadas", resumo: "atraso controlado · 9 atrasadas · 6 quentes" },
  { id: "cobertura", nome: "Cobertura máxima", resumo: "pesos suavizados em todo o painel" },
];

export type ItemRanking = {
  n: number;
  freq: number;
  tendencia?: number;
  recencia?: number;
};

export type FaixaDinamica = "quentes" | "mornas" | "frias";

export type PerfilPesosDinamicos = {
  itens: { n: number; peso: number; faixa: FaixaDinamica }[];
  grupos: Record<FaixaDinamica, { multiplicador: number; mediaFrequencia: number }>;
};

const limitar = (valor: number, minimo: number, maximo: number) =>
  Math.max(minimo, Math.min(maximo, valor));

export function calcularPesosDinamicos(
  ranking: ItemRanking[],
  rankingAtraso: { n: number; atraso: number }[],
): PerfilPesosDinamicos {
  const ordenadoPorFrequencia = [...ranking].sort((a, b) => b.freq - a.freq || a.n - b.n);
  const faixaPorNumero = new Map<number, FaixaDinamica>();
  ordenadoPorFrequencia.forEach((item, indice) => {
    faixaPorNumero.set(item.n, indice < 8 ? "quentes" : indice < 17 ? "mornas" : "frias");
  });

  const frequenciaMedia =
    ranking.reduce((total, item) => total + item.freq, 0) / Math.max(1, ranking.length);
  const atrasoPorNumero = new Map(rankingAtraso.map((item) => [item.n, item.atraso]));
  const atrasoMaximo = Math.max(1, ...rankingAtraso.map((item) => item.atraso));
  const gruposBase = { quentes: [] as ItemRanking[], mornas: [] as ItemRanking[], frias: [] as ItemRanking[] };
  for (const item of ranking) gruposBase[faixaPorNumero.get(item.n) ?? "mornas"].push(item);

  const grupos = Object.fromEntries(
    (Object.keys(gruposBase) as FaixaDinamica[]).map((faixa) => {
      const itens = gruposBase[faixa];
      const mediaFrequencia = itens.reduce((total, item) => total + item.freq, 0) / Math.max(1, itens.length);
      const tendenciaMedia =
        itens.reduce((total, item) => total + (item.tendencia ?? 0), 0) / Math.max(1, itens.length);
      const forcaRelativa = frequenciaMedia > 0 ? mediaFrequencia / frequenciaMedia : 1;
      const multiplicador = limitar(forcaRelativa + tendenciaMedia * 0.8, 0.65, 1.65);
      return [faixa, { multiplicador, mediaFrequencia }];
    }),
  ) as PerfilPesosDinamicos["grupos"];

  const frequenciaMaxima = Math.max(1, ...ranking.map((item) => item.freq));
  const itens = ranking
    .map((item) => {
      const faixa = faixaPorNumero.get(item.n) ?? "mornas";
      const frequencia = item.freq / frequenciaMaxima;
      const tendencia = limitar(item.tendencia ?? 0, -1, 1);
      const recencia = limitar(item.recencia ?? frequencia, 0, 1);
      const atraso = (atrasoPorNumero.get(item.n) ?? 0) / atrasoMaximo;
      // Frequência e presença recente dominam. Tendência reforça dezenas em alta;
      // atraso tem influência menor para não tratar ausência passada como garantia futura.
      const base = 1 + frequencia * 4.5 + recencia * 2 + tendencia * 1.5 + atraso * 0.45;
      return { n: item.n, faixa, peso: Math.max(0.2, base * grupos[faixa].multiplicador) };
    })
    .sort((a, b) => b.peso - a.peso || a.n - b.n);

  return { itens, grupos };
}

export type Criterios = {
  paresMin: number;
  paresMax: number;
  primosMin: number;
  primosMax: number;
  somaMin: number;
  somaMax: number;
  molduraMin: number;
  molduraMax: number;
  maxSequencia: number;
  maxRepeticaoEntreCartoes: number;
};

export const CRITERIOS_PADRAO: Criterios = {
  paresMin: 6,
  paresMax: 8,
  primosMin: 4,
  primosMax: 7,
  somaMin: 170,
  somaMax: 220,
  molduraMin: 8,
  molduraMax: 11,
  maxSequencia: 5,
  maxRepeticaoEntreCartoes: 13,
};

export function estatisticasJogo(jogo: number[]) {
  const pares = jogo.filter((n) => n % 2 === 0).length;
  const primos = jogo.filter((n) => PRIMOS.includes(n)).length;
  const soma = jogo.reduce((a, b) => a + b, 0);
  const moldura = jogo.filter((n) => MOLDURA.includes(n)).length;
  const ordenado = [...jogo].sort((a, b) => a - b);
  let seq = 1;
  let maiorSeq = 1;
  for (let i = 1; i < ordenado.length; i++) {
    if (ordenado[i] === ordenado[i - 1] + 1) seq++;
    else seq = 1;
    if (seq > maiorSeq) maiorSeq = seq;
  }
  return { pares, impares: jogo.length - pares, primos, soma, moldura, maiorSeq };
}

export function validarCombinacao(jogo: number[], c: Criterios) {
  const s = estatisticasJogo(jogo);
  const motivos: string[] = [];
  if (s.pares < c.paresMin || s.pares > c.paresMax) motivos.push("pares/ímpares");
  if (s.primos < c.primosMin || s.primos > c.primosMax) motivos.push("primos");
  if (s.soma < c.somaMin || s.soma > c.somaMax) motivos.push("soma");
  if (s.moldura < c.molduraMin || s.moldura > c.molduraMax) motivos.push("moldura/miolo");
  if (s.maiorSeq > c.maxSequencia) motivos.push("sequência longa");
  return { ok: motivos.length === 0, motivos, stats: s };
}

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

export type EntradaGeracao = {
  ranking: ItemRanking[];
  rankingAtraso: { n: number; atraso: number }[];
  ativas: number[];
  estrategia: Estrategia;
  qtd: number;
  criterios: Criterios;
  /** dezenas escolhidas pelo usuário que entram em todos os cartões */
  fixas?: number[];
};

export function gerarCartoes({
  ranking,
  rankingAtraso,
  ativas,
  estrategia,
  qtd,
  criterios,
  fixas = [],
}: EntradaGeracao): number[][] {
  const obrigatorias = [...new Set(fixas)].slice(0, 15);
  const permitidas = new Set(ativas);
  const perfil = calcularPesosDinamicos(ranking, rankingAtraso);
  const poolDe = (faixa?: FaixaDinamica) =>
    perfil.itens
      .filter((item) => permitidas.has(item.n) && (!faixa || item.faixa === faixa))
      .map((item) => ({ n: item.n, peso: item.peso }));

  const poolQuentes = poolDe("quentes");
  const poolMornas = poolDe("mornas");
  const poolFrias = poolDe("frias");
  const poolTodas = poolDe();
  const poolAtrasadas = rankingAtraso
    .filter((r) => permitidas.has(r.n))
    .map((r) => {
      const dinamico = perfil.itens.find((item) => item.n === r.n)?.peso ?? 1;
      return { n: r.n, peso: dinamico * (1 + Math.min(r.atraso, 5) * 0.12) };
    });

  const completar = (jogoSet: Set<number>) => {
    if (jogoSet.size < 15) {
      for (const p of sortearPonderado(poolTodas, poolTodas.length)) {
        if (jogoSet.size >= 15) break;
        jogoSet.add(p);
      }
    }
    return jogoSet;
  };

  const montar = (): Set<number> => {
    switch (estrategia) {
      case "quentes":
        return completar(
          new Set<number>([
            ...sortearPonderado(poolQuentes, Math.min(11, poolQuentes.length)),
            ...sortearPonderado(poolMornas, Math.min(4, poolMornas.length)),
          ]),
        );
      case "atrasadas":
        return completar(
          new Set<number>([
            ...sortearPonderado(poolAtrasadas, Math.min(9, poolAtrasadas.length)),
            ...sortearPonderado(poolQuentes, Math.min(6, poolQuentes.length)),
          ]),
        );
      case "cobertura":
        return completar(
          new Set<number>(
            sortearPonderado(
              poolTodas.map((p) => ({ n: p.n, peso: Math.sqrt(p.peso) })),
              15,
            ),
          ),
        );
      default:
        return completar(
          new Set<number>([
            ...sortearPonderado(poolQuentes, Math.min(8, poolQuentes.length)),
            ...sortearPonderado(poolMornas, Math.min(5, poolMornas.length)),
            ...sortearPonderado(poolFrias, Math.min(2, poolFrias.length)),
          ]),
        );
    }
  };

  const vistas = new Set<string>();
  const novas: number[][] = [];
  const limite = qtd * 300;
  let tentativas = 0;

  while (novas.length < qtd && tentativas < limite) {
    tentativas++;
    const relaxado = tentativas > qtd * 200;
    const base = montar();
    const set = new Set<number>(obrigatorias);
    for (const n of base) if (set.size < 15) set.add(n);
    completar(set);
    if (set.size < 15) continue;
    const lista = [...set].slice(0, 15).sort((a, b) => a - b);
    const chave = lista.join("-");
    if (vistas.has(chave)) continue;
    if (!relaxado && !validarCombinacao(lista, criterios).ok) continue;
    if (!relaxado) {
      // evita padrões repetidos: limita quantas dezenas o cartão compartilha com os já aceitos
      const repetido = novas.some(
        (j) => j.filter((n) => set.has(n)).length > criterios.maxRepeticaoEntreCartoes,
      );
      if (repetido) continue;
    }
    vistas.add(chave);
    novas.push(lista);
  }

  return novas;
}

export type Avaliacao = {
  faixas: Record<number, number>;
  media: number;
  sorteios: number;
  chance11: number;
  chance13: number;
  chance14: number;
  score: number;
};

// backtest: confronta os cartões com os concursos reais informados
export function avaliarCartoes(
  jogos: number[][],
  concursos: { dezenas: number[] }[],
): Avaliacao {
  const faixas: Record<number, number> = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 };
  let soma = 0;
  let sorteios = 0;
  let rodadas11 = 0;
  let rodadas13 = 0;
  let rodadas14 = 0;

  for (const c of concursos) {
    const set = new Set(c.dezenas);
    let melhor = 0;
    for (const jogo of jogos) {
      let acertos = 0;
      for (const n of jogo) if (set.has(n)) acertos++;
      soma += acertos;
      sorteios++;
      if (acertos >= 11) faixas[acertos]++;
      if (acertos > melhor) melhor = acertos;
    }
    if (melhor >= 11) rodadas11++;
    if (melhor >= 13) rodadas13++;
    if (melhor >= 14) rodadas14++;
  }

  const rodadas = Math.max(1, concursos.length);
  const chance11 = (rodadas11 / rodadas) * 100;
  const chance13 = (rodadas13 / rodadas) * 100;
  const chance14 = (rodadas14 / rodadas) * 100;

  return {
    faixas,
    media: sorteios ? soma / sorteios : 0,
    sorteios,
    chance11,
    chance13,
    chance14,
    score: chance11 * 0.5 + chance13 * 3 + chance14 * 8,
  };
}

/**
 * Gera variações ancoradas no palpite estatístico (15 dezenas sugeridas):
 * mantém a maior parte das dezenas do palpite e troca poucas (2 a 4) por
 * dezenas ativas fora do palpite, ponderadas pelo ranking dinâmico.
 */
export function gerarCartoesDoPalpite({
  palpite,
  ranking,
  ativas,
  qtd,
  criterios,
}: {
  palpite: number[];
  ranking: ItemRanking[];
  ativas: number[];
  qtd: number;
  criterios: Criterios;
}): number[][] {
  if (palpite.length !== 15) return [];
  const base = [...palpite].sort((a, b) => a - b);
  const fora = ativas.filter((n) => !base.includes(n));
  const pesoDe = new Map(ranking.map((r) => [r.n, r.freq]));
  const poolFora = fora.map((n) => ({ n, peso: 1 + (pesoDe.get(n) ?? 0) * 4 }));

  const vistas = new Set<string>([base.join("-")]);
  const novas: number[][] = [];
  const limite = qtd * 300;
  let tentativas = 0;

  while (novas.length < qtd && tentativas < limite) {
    tentativas++;
    const relaxado = tentativas > qtd * 200;
    // quantas dezenas do palpite serão trocadas neste cartão (0 a 4)
    const trocas = Math.min(
      poolFora.length,
      tentativas % 7 === 0 ? 0 : 2 + Math.floor(Math.random() * 3),
    );
    const set = new Set(base);
    if (trocas > 0) {
      const saidas = [...base].sort(() => Math.random() - 0.5).slice(0, trocas);
      for (const s of saidas) set.delete(s);
      for (const e of sortearPonderado(poolFora, trocas)) set.add(e);
    }
    if (set.size !== 15) continue;
    const lista = [...set].sort((a, b) => a - b);
    const chave = lista.join("-");
    if (vistas.has(chave)) continue;
    if (!relaxado && !validarCombinacao(lista, criterios).ok) continue;
    if (!relaxado) {
      const repetido = novas.some(
        (j) => j.filter((n) => set.has(n)).length > criterios.maxRepeticaoEntreCartoes,
      );
      if (repetido) continue;
    }
    vistas.add(chave);
    novas.push(lista);
  }

  return novas;
}
