CREATE TABLE public.app_credenciais (
  id text PRIMARY KEY DEFAULT 'default',
  usuario text NOT NULL,
  senha_hash text NOT NULL,
  senha_salt text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_credenciais TO service_role;

ALTER TABLE public.app_credenciais ENABLE ROW LEVEL SECURITY;