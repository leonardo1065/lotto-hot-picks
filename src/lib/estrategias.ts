export const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23];
export const MOLDURA = [1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25];

export type Estrategia = "equilibrada" | "quentes" | "atrasadas" | "cobertura";

export const ESTRATEGIAS: { id: Estrategia; nome: string; resumo: string }[] = [
  { id: "equilibrada", nome: "Equilibrada", resumo: "8 quentes · 5 mornas · 2 frias" },
  { id: "quentes", nome: "Foco nas quentes", resumo: "11 quentes · 4 mornas" },
  { id: "atrasadas", nome: "Atrasadas", resumo: "9 atrasadas · 6 quentes" },
  { id: "cobertura", nome: "Cobertura máxima", resumo: "variação total do painel" },
];

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
  ranking: { n: number; freq: number }[];
  rankingAtraso: { n: number; atraso: number }[];
  ativas: number[];
  estrategia: Estrategia;
  qtd: number;
  criterios: Criterios;
};

export function gerarCartoes({
  ranking,
  rankingAtraso,
  ativas,
  estrategia,
  qtd,
  criterios,
}: EntradaGeracao): number[][] {
  const permitidas = new Set(ativas);
  const poolDe = (lista: { n: number; freq: number }[]) =>
    lista.filter((r) => permitidas.has(r.n)).map((r) => ({ n: r.n, peso: r.freq + 1 }));

  const poolQuentes = poolDe(ranking.slice(0, 8));
  const poolMornas = poolDe(ranking.slice(8, 17));
  const poolFrias = poolDe(ranking.slice(17));
  const poolTodas = poolDe(ranking);
  const poolAtrasadas = rankingAtraso
    .filter((r) => permitidas.has(r.n))
    .map((r) => ({ n: r.n, peso: r.atraso + 1 }));

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
    const set = montar();
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
