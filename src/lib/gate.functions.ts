import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  abrirSessao,
  credenciaisValidas,
  exigirAcessoServidor,
  salvarCredenciais,
  senhaAtualConfere,
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
  const usuario = await exigirAcessoServidor();
  return { usuario };
});

const alterarSchema = z.object({
  senhaAtual: z.string().min(1).max(200),
  novoUsuario: z.string().trim().min(3, "Login deve ter ao menos 3 caracteres").max(60),
  novaSenha: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(200),
});

export const alterarCredenciais = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => alterarSchema.parse(data))
  .handler(async ({ data }) => {
    const usuarioAtual = await exigirAcessoServidor();
    if (!(await senhaAtualConfere(usuarioAtual, data.senhaAtual))) {
      return { ok: false as const, erro: "Senha atual incorreta." };
    }
    await salvarCredenciais(data.novoUsuario, data.novaSenha);
    const session = await abrirSessao();
    await session.update({ unlocked: true, user: data.novoUsuario.trim() });
    return { ok: true as const };
  });
