-- Server-side admin authorization source of truth for /api/admin/* routes.

CREATE TABLE IF NOT EXISTS public.admin_users (
  email text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_enabled_idx
  ON public.admin_users (enabled);

INSERT INTO public.admin_users (email, enabled)
VALUES ('genti28@gmail.com', true)
ON CONFLICT (email) DO UPDATE SET enabled = EXCLUDED.enabled;
