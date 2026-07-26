import { createServerFn } from "@tanstack/react-start";

const API = "https://loteriascaixa-api.herokuapp.com/api/lotofacil";

export type ConcursoResultado = {
  concurso: number;
  data: string;
  dezenas: number[];
};

export const buscarConcursos = createServerFn({ method: "GET" })
  .inputValidator((data: { quantidade: number }) => ({
    quantidade: Math.max(1, Math.min(100, Math.floor(Number(data.quantidade) || 20))),
  }))
  .handler(async ({ data }): Promise<ConcursoResultado[]> => {
    const latestRes = await fetch(`${API}/latest`);
    if (!latestRes.ok) throw new Error("Não foi possível consultar a Caixa agora.");
    const latest = (await latestRes.json()) as { concurso: number; data: string; dezenas: string[] };

    const ultimo = latest.concurso;
    const numeros = Array.from({ length: data.quantidade }, (_, i) => ultimo - i).filter((n) => n > 0);

    const resultados = await Promise.all(
      numeros.map(async (n): Promise<ConcursoResultado | null> => {
        if (n === ultimo) {
          return { concurso: latest.concurso, data: latest.data, dezenas: latest.dezenas.map(Number) };
        }
        const res = await fetch(`${API}/${n}`);
        if (!res.ok) return null;
        const json = (await res.json()) as { concurso: number; data: string; dezenas: string[] };
        if (!json?.dezenas) return null;
        return { concurso: json.concurso, data: json.data, dezenas: json.dezenas.map(Number) };
      }),
    );

    return resultados.filter((r): r is ConcursoResultado => r !== null);
  });
