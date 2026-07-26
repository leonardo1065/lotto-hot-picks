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

function bytesToHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// PBKDF2 via Web Crypto — disponível no runtime do servidor (Workers)
export async function derivarHash(senha: string, saltHex: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, [
    "deriveBits",
  ]);
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToHex(bits);
}

export function novoSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

type Credenciais = { usuario: string; senha_hash: string; senha_salt: string } | null;

async function credenciaisSalvas(): Promise<Credenciais> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_credenciais")
    .select("usuario, senha_hash, senha_salt")
    .eq("id", "default")
    .maybeSingle();
  return data ?? null;
}

/** Valida contra as credenciais salvas no banco; se ainda não houver, usa as iniciais. */
export async function credenciaisValidas(usuario: string, senha: string) {
  const salvas = await credenciaisSalvas();
  if (salvas) {
    const hash = await derivarHash(senha, salvas.senha_salt);
    return matches(usuario.trim(), salvas.usuario) && matches(hash, salvas.senha_hash);
  }
  const u = process.env.SITE_USER;
  const p = process.env.SITE_PASSWORD;
  if (!u || !p) throw new Error("Credenciais do app não configuradas");
  return matches(usuario.trim(), u) && matches(senha, p);
}

/** Confere a senha atual (banco ou inicial) antes de permitir a troca. */
export async function senhaAtualConfere(usuario: string, senha: string) {
  return credenciaisValidas(usuario, senha);
}

export async function salvarCredenciais(usuario: string, senha: string) {
  const senha_salt = novoSalt();
  const senha_hash = await derivarHash(senha, senha_salt);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_credenciais").upsert(
    {
      id: "default",
      usuario: usuario.trim(),
      senha_hash,
      senha_salt,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

export async function abrirSessao() {
  return useSession<GateSession>(sessionConfig());
}

/** Retorna o usuário logado ou null — nunca lança Response. */
export async function usuarioDaSessao(): Promise<string | null> {
  const session = await abrirSessao();
  if (!session.data.unlocked) return null;
  return session.data.user ?? "";
}

export async function exigirAcessoServidor() {
  const usuario = await usuarioDaSessao();
  if (usuario === null) throw new Error("Acesso não autorizado");
  return usuario;
}
