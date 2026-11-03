import { createServerFn } from "@tanstack/react-start";

const API = "https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena";

type CaixaConcurso = { numero: number; dataApuracao: string; listaDezenas: string[] };
export type ConcursoMegaSena = { concurso: number; data: string; dezenas: number[] };

function normalizar(resultado: CaixaConcurso): ConcursoMegaSena {
  const dezenas = (resultado.listaDezenas ?? []).map(Number).filter((n) => n >= 1 && n <= 60);
  if (!resultado.numero || dezenas.length !== 6) {
    throw new Error("A Caixa retornou um resultado inválido para a Mega-Sena.");
  }
  return { concurso: resultado.numero, data: resultado.dataApuracao, dezenas };
}

async function consultar(concurso?: number): Promise<ConcursoMegaSena> {
  const urls = concurso ? [API + "?concurso=" + concurso, API + "/" + concurso] : [API];
  for (const url of urls) {
    try {
      const resposta = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "LottoHotPicks/1.0" },
      });
      if (!resposta.ok) continue;
      const resultado = normalizar((await resposta.json()) as CaixaConcurso);
      if (!concurso || resultado.concurso === concurso) return resultado;
    } catch {
      // tenta a próxima forma de consulta, sempre no domínio oficial da Caixa
    }
  }
  throw new Error("Não foi possível consultar esse resultado oficial da Caixa.");
}

export const buscarConcursosMegaSena = createServerFn({ method: "GET" })
  .inputValidator((data: { quantidade: number }) => ({
    quantidade: Math.max(1, Math.min(100, Math.floor(Number(data?.quantidade) || 20))),
  }))
  .handler(async ({ data }): Promise<ConcursoMegaSena[]> => {
    const ultimo = await consultar();
    const numeros = Array.from(
      { length: Math.min(data.quantidade, ultimo.concurso) },
      (_, indice) => ultimo.concurso - indice,
    );
    const resultados = await Promise.all(
      numeros.map(async (numero) => {
        try {
          return numero === ultimo.concurso ? ultimo : await consultar(numero);
        } catch {
          return null;
        }
      }),
    );
    return resultados.filter((item): item is ConcursoMegaSena => item !== null);
  });
