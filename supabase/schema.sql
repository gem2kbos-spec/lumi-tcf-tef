create table if not exists public.lumi_documents (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lumi_documents enable row level security;

-- Do not add public policies. Lumi accesses this table only from its server
-- with the service-role key; browsers never receive database credentials.
revoke all on table public.lumi_documents from anon, authenticated;
grant all on table public.lumi_documents to service_role;

create index if not exists lumi_documents_updated_at_idx on public.lumi_documents (updated_at desc);

