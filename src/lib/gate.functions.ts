import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  abrirSessao,
  credenciaisValidas,
  exigirAcessoServidor,
  migrarCartoes,
  salvarCredenciais,
  senhaAtualConfere,
  usuarioDaSessao,
} from "./gate.server";

export const entrar = createServerFn({ method: "POST" })
  .inputValidator((data: { usuario: string; senha: string }) => data)
  .handler(async ({ data }) => {
    if (!(await credenciaisValidas(data.usuario ?? "", data.senha ?? ""))) {
      return { ok: false as const };
    }
    const session = await abrirSessao();
    await session.update({ unlocked: true, user: data.usuario.trim() });
    return { ok: true as const };
  });

export const sair = createServerFn({ method: "POST" }).handler(async () => {
  const session = await abrirSessao();
  await session.clear();
  return { ok: true as const };
});

export const exigirAcesso = createServerFn({ method: "GET" }).handler(async () => {
  const usuario = await usuarioDaSessao();
  return { autorizado: usuario !== null, usuario: usuario ?? "" };
});

const alterarSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual.").max(200),
  novoUsuario: z.string().trim().min(3, "O novo login deve ter ao menos 3 caracteres.").max(60),
  novaSenha: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres.").max(200),
});

export const alterarCredenciais = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => {
    const parsed = alterarSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const entrada = parsed.data;
    let usuarioAtual: string;
    try {
      usuarioAtual = await exigirAcessoServidor();
    } catch {
      return { ok: false as const, erro: "Sessão expirada. Entre novamente para trocar o acesso." };
    }
    if (!(await senhaAtualConfere(usuarioAtual, entrada.senhaAtual))) {
      return { ok: false as const, erro: "Senha atual incorreta." };
    }
    try {
      await salvarCredenciais(entrada.novoUsuario, entrada.novaSenha);
      await migrarCartoes(usuarioAtual, entrada.novoUsuario.trim());
    } catch (e) {
      return {
        ok: false as const,
        erro: e instanceof Error ? e.message : "Não foi possível salvar as novas credenciais.",
      };
    }
    const session = await abrirSessao();
    await session.update({ unlocked: true, user: entrada.novoUsuario.trim() });
    return { ok: true as const, erro: undefined };
  });


export const gerarCodigoRecuperacao = createServerFn({ method: "POST" }).handler(async () => {
  const { gerarCodigoRecuperacaoServidor, usuarioDaSessao: sessao } = await import("./gate.server");
  const usuario = await sessao();
  if (usuario === null) return { ok: false as const, erro: "Sessão expirada. Entre novamente." };
  const codigo = await gerarCodigoRecuperacaoServidor(usuario);
  return { ok: true as const, codigo };
});

export const statusCodigoRecuperacao = createServerFn({ method: "GET" }).handler(async () => {
  const { temCodigoRecuperacao, usuarioDaSessao: sessao } = await import("./gate.server");
  if ((await sessao()) === null) return { existe: false };
  return { existe: await temCodigoRecuperacao() };
});

const recuperarSchema = z.object({
  codigo: z.string().trim().min(8, "Informe o código secreto.").max(40),
  novoUsuario: z.string().trim().min(3, "O novo login deve ter ao menos 3 caracteres.").max(60),
  novaSenha: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres.").max(200),
});

export const recuperarComCodigo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => {
    const parsed = recuperarSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const { usarCodigoRecuperacao } = await import("./gate.server");
    const usuarioAntigo = await usarCodigoRecuperacao(parsed.data.codigo);
    if (usuarioAntigo === null) return { ok: false as const, erro: "Código secreto inválido." };
    await salvarCredenciais(parsed.data.novoUsuario, parsed.data.novaSenha);
    await migrarCartoes(usuarioAntigo, parsed.data.novoUsuario.trim());
    const session = await abrirSessao();
    await session.update({ unlocked: true, user: parsed.data.novoUsuario.trim() });
    return { ok: true as const, erro: undefined };
  });
