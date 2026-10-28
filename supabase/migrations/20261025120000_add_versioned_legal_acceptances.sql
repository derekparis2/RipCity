-- Store the exact legal-document versions accepted by each authenticated user.
-- Client applications may read the current versions and a user may record an
-- acceptance only through the guarded RPC. Acceptance rows are append-only.

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy')),
  version text not null,
  title text not null,
  document_path text not null,
  effective_at timestamptz not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (document_type, version)
);

create unique index legal_documents_one_current_per_type
  on public.legal_documents (document_type)
  where is_current = true;

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_document_id uuid not null references public.legal_documents(id),
  privacy_document_id uuid not null references public.legal_documents(id),
  age_bracket text not null check (age_bracket in ('18_or_older', '13_to_17')),
  guardian_permission_confirmed boolean not null default false,
  accepted_at timestamptz not null default now(),
  acceptance_source text not null default 'web_signup_or_gate',
  unique (user_id, terms_document_id, privacy_document_id),
  check (age_bracket = '18_or_older' or guardian_permission_confirmed = true)
);

create index legal_acceptances_user_id_idx
  on public.legal_acceptances (user_id, accepted_at desc);

alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;

create policy "current legal documents are publicly readable"
  on public.legal_documents
  for select
  to anon, authenticated
  using (is_current = true);

create policy "users can read own legal acceptances"
  on public.legal_acceptances
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.legal_documents from public, anon, authenticated;
grant select on table public.legal_documents to anon, authenticated;

revoke all on table public.legal_acceptances from public, anon, authenticated;
grant select on table public.legal_acceptances to authenticated;

insert into public.legal_documents (
  document_type,
  version,
  title,
  document_path,
  effective_at,
  is_current
)
values
  ('terms', '2026-10-25', 'Terms of Service', 'terms.html', '2026-10-25 00:00:00-04', true),
  ('privacy', '2026-10-25', 'Privacy Policy', 'privacy.html', '2026-10-25 00:00:00-04', true);

create or replace function public.get_current_legal_acceptance()
returns table (
  terms_document_id uuid,
  terms_version text,
  terms_path text,
  privacy_document_id uuid,
  privacy_version text,
  privacy_path text,
  accepted boolean,
  accepted_at timestamptz,
  age_bracket text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with current_documents as (
    select
      terms.id as terms_document_id,
      terms.version as terms_version,
      terms.document_path as terms_path,
      privacy.id as privacy_document_id,
      privacy.version as privacy_version,
      privacy.document_path as privacy_path
    from public.legal_documents terms
    cross join public.legal_documents privacy
    where terms.document_type = 'terms'
      and terms.is_current = true
      and privacy.document_type = 'privacy'
      and privacy.is_current = true
  )
  select
    docs.terms_document_id,
    docs.terms_version,
    docs.terms_path,
    docs.privacy_document_id,
    docs.privacy_version,
    docs.privacy_path,
    acceptance.id is not null as accepted,
    acceptance.accepted_at,
    acceptance.age_bracket
  from current_documents docs
  left join lateral (
    select la.id, la.accepted_at, la.age_bracket
    from public.legal_acceptances la
    where la.user_id = auth.uid()
      and la.terms_document_id = docs.terms_document_id
      and la.privacy_document_id = docs.privacy_document_id
    order by la.accepted_at desc
    limit 1
  ) acceptance on true;
$$;

create or replace function public.record_current_legal_acceptance(
  p_age_bracket text,
  p_guardian_permission_confirmed boolean,
  p_legal_terms_confirmed boolean
)
returns table (
  acceptance_id uuid,
  terms_version text,
  privacy_version text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requester_id uuid := auth.uid();
  current_terms public.legal_documents%rowtype;
  current_privacy public.legal_documents%rowtype;
  saved_acceptance public.legal_acceptances%rowtype;
begin
  if requester_id is null then
    raise exception 'Authentication is required to accept legal documents.';
  end if;

  if p_age_bracket not in ('18_or_older', '13_to_17') then
    raise exception 'Choose a valid age confirmation.';
  end if;

  if p_age_bracket = '13_to_17' and coalesce(p_guardian_permission_confirmed, false) is not true then
    raise exception 'Parent or legal guardian permission is required for users under 18.';
  end if;

  if coalesce(p_legal_terms_confirmed, false) is not true then
    raise exception 'The Terms of Service and Privacy Policy must be acknowledged.';
  end if;

  select * into current_terms
  from public.legal_documents
  where document_type = 'terms' and is_current = true;

  select * into current_privacy
  from public.legal_documents
  where document_type = 'privacy' and is_current = true;

  if current_terms.id is null or current_privacy.id is null then
    raise exception 'Current legal documents are not configured.';
  end if;

  insert into public.legal_acceptances (
    user_id,
    terms_document_id,
    privacy_document_id,
    age_bracket,
    guardian_permission_confirmed
  )
  values (
    requester_id,
    current_terms.id,
    current_privacy.id,
    p_age_bracket,
    case when p_age_bracket = '13_to_17' then true else false end
  )
  on conflict (user_id, terms_document_id, privacy_document_id)
  do nothing
  returning * into saved_acceptance;

  if saved_acceptance.id is null then
    select * into saved_acceptance
    from public.legal_acceptances
    where user_id = requester_id
      and terms_document_id = current_terms.id
      and privacy_document_id = current_privacy.id;
  end if;

  return query
  select
    saved_acceptance.id,
    current_terms.version,
    current_privacy.version,
    saved_acceptance.accepted_at;
end;
$$;

revoke all on function public.get_current_legal_acceptance() from public;
grant execute on function public.get_current_legal_acceptance() to authenticated;

revoke all on function public.record_current_legal_acceptance(text, boolean, boolean) from public;
grant execute on function public.record_current_legal_acceptance(text, boolean, boolean) to authenticated;

comment on table public.legal_documents is
  'Append-only catalog of published Terms of Service and Privacy Policy versions.';
comment on table public.legal_acceptances is
  'Append-only evidence that an authenticated user accepted the then-current legal-document pair.';
comment on function public.get_current_legal_acceptance() is
  'Returns the current document versions and whether the authenticated user accepted that exact pair.';
comment on function public.record_current_legal_acceptance(text, boolean, boolean) is
  'Records one server-timestamped acceptance of the current document pair after age and guardian checks.';
