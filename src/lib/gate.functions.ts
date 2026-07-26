import { createServerFn } from "@tanstack/react-start";
import {
  abrirSessao,
  credenciaisValidas,
  exigirAcessoServidor,
} from "./gate.server";

export const entrar = createServerFn({ method: "POST" })
  .inputValidator((data: { usuario: string; senha: string }) => data)
  .handler(async ({ data }) => {
    if (!credenciaisValidas(data.usuario ?? "", data.senha ?? "")) {
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
