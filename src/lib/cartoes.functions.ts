import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirAcessoServidor } from "./gate.server";

export type LoteCartoes = {
  id: string;
  criadoEm: number;
  janela: number;
  concursoTopo?: number;
  jogos: number[][];
};

type Linha = {
  id: string;
  criado_em: string;
  janela: number;
  concurso_topo: number | null;
  jogos: unknown;
};

function mapear(linha: Linha): LoteCartoes {
  return {
    id: linha.id,
    criadoEm: new Date(linha.criado_em).getTime(),
    janela: linha.janela,
    concursoTopo: linha.concurso_topo ?? undefined,
    jogos: (linha.jogos as number[][]) ?? [],
  };
}

export const listarCartoes = createServerFn({ method: "GET" }).handler(
  async (): Promise<LoteCartoes[]> => {
    const usuario = await exigirAcessoServidor();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("cartoes_salvos")
      .select("id, criado_em, janela, concurso_topo, jogos")
      .eq("usuario", usuario)
      .order("criado_em", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((l) => mapear(l as Linha));
  },
);

const salvarSchema = z.object({
  janela: z.number().int().min(0).max(1000),
  concursoTopo: z.number().int().positive().nullable().optional(),
  jogos: z.array(z.array(z.number().int().min(1).max(25)).length(15)).min(1).max(200),
});

export const salvarCartoesNuvem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => salvarSchema.parse(data))
  .handler(async ({ data }): Promise<LoteCartoes> => {
    const usuario = await exigirAcessoServidor();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linha, error } = await supabaseAdmin
      .from("cartoes_salvos")
      .insert({
        usuario,
        janela: data.janela,
        concurso_topo: data.concursoTopo ?? null,
        jogos: data.jogos,
      })
      .select("id, criado_em, janela, concurso_topo, jogos")
      .single();
    if (error) throw new Error(error.message);
    return mapear(linha as Linha);
  });

export const removerCartoesNuvem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const usuario = await exigirAcessoServidor();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cartoes_salvos")
      .delete()
      .eq("id", data.id)
      .eq("usuario", usuario);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
