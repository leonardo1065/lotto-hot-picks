import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

export type GateSession = { unlocked?: boolean; user?: string };

export function sessionConfig() {
  return {
    password: process.env.SESSION_SECRET!,
    name: "lotofacil-gate",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function credenciaisValidas(usuario: string, senha: string) {
  const u = process.env.SITE_USER;
  const p = process.env.SITE_PASSWORD;
  if (!u || !p) throw new Error("Credenciais do app não configuradas");
  return matches(usuario.trim(), u) && matches(senha, p);
}

export async function abrirSessao() {
  return useSession<GateSession>(sessionConfig());
}

export async function exigirAcessoServidor() {
  const session = await abrirSessao();
  if (!session.data.unlocked) throw redirect({ to: "/login" });
  return session.data.user ?? "";
}
