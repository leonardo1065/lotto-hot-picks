CREATE TABLE public.cartoes_salvos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  janela integer NOT NULL DEFAULT 0,
  concurso_topo integer,
  jogos jsonb NOT NULL
);

CREATE INDEX cartoes_salvos_usuario_idx ON public.cartoes_salvos (usuario, criado_em DESC);

GRANT ALL ON public.cartoes_salvos TO service_role;

ALTER TABLE public.cartoes_salvos ENABLE ROW LEVEL SECURITY;