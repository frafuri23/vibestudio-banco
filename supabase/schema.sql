-- Banco: schema Supabase (eseguito dal builder via run_sql)
-- Ogni tavolo è una riga in banco_tables (stato + versione); il registro è banco_entries, a cui si aggiungono solo righe.
--
-- Sicurezza:
-- - L'app non legge e non scrive MAI le tabelle direttamente (nessuna policy, nessun permesso a anon/authenticated).
-- - Ogni telefono/browser ha un'identità sul server: un accesso anonimo di Supabase (auth.uid()), senza nome né email.
-- - Chi crea un tavolo ne diventa membro (host); gli altri diventano membri solo entrando col codice (banco_join).
-- - banco_get / banco_commit rispondono solo ai membri del tavolo, riconosciuti da auth.uid() e non da dati mandati dall'app.
-- - Ogni telefono può essere legato a UN giocatore (banco_members.player_id): l'host alla creazione, l'ospite con banco_claim.
--   A fine serata "ricevuto" lo accetta solo dal telefono di chi riceve, o dall'host per chi non ha un telefono al tavolo.
-- - Gli altri telefoni vengono avvisati con un broadcast per tavolo che contiene solo il numero di versione.

create table if not exists public.banco_tables (
  id text primary key,
  code text not null,
  kind text not null,
  name text not null,
  status text not null default 'lobby',
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists banco_tables_code_idx on public.banco_tables (code, status);

create table if not exists public.banco_entries (
  seq bigserial primary key,
  id text not null unique,
  table_id text not null references public.banco_tables(id) on delete cascade,
  ts bigint not null,
  from_acc text not null,
  to_acc text not null,
  amount bigint not null check (amount > 0),
  kind text not null check (kind in ('buyin','bet','win','pay','prize','lap','undo')),
  note text,
  undo_of text,
  created_at timestamptz not null default now(),
  check (from_acc <> to_acc)
);
create index if not exists banco_entries_table_idx on public.banco_entries (table_id, seq);

-- Chi è seduto a quale tavolo: un'identità del server (accesso anonimo) per telefono o browser
create table if not exists public.banco_members (
  table_id text not null references public.banco_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id)
);
create index if not exists banco_members_user_idx on public.banco_members (user_id);
alter table public.banco_members add column if not exists player_id text;
create unique index if not exists banco_members_player_idx on public.banco_members (table_id, player_id) where player_id is not null;

create or replace function public.banco_arr(j jsonb) returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end
$$;

-- Tentativi di entrare con un codice: ferma chi prova i codici uno dopo l'altro
create table if not exists public.banco_code_attempts (
  id bigserial primary key,
  user_id uuid not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists banco_code_attempts_user_idx on public.banco_code_attempts (user_id, at);

alter table public.banco_tables enable row level security;
alter table public.banco_entries enable row level security;
alter table public.banco_members enable row level security;
alter table public.banco_code_attempts enable row level security;

-- Nessuna policy e nessun permesso: dall'esterno non si legge l'elenco dei tavoli, né codici, né nomi, né saldi
drop policy if exists "banco_tables_read" on public.banco_tables;
revoke all on public.banco_tables from anon, authenticated;
revoke all on public.banco_entries from anon, authenticated;
revoke all on public.banco_members from anon, authenticated;
revoke all on public.banco_code_attempts from anon, authenticated;

-- La tabella dei tavoli non va più sul canale "postgres_changes" (lo vedrebbe chiunque)
do $$
begin
  if exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'banco_tables'
  ) then
    alter publication supabase_realtime drop table public.banco_tables;
  end if;
end $$;

-- Il registro non si modifica: si annulla aggiungendo la riga inversa
create or replace function public.banco_entries_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Il registro del banco non si modifica: si aggiunge una riga inversa';
end $$;
drop trigger if exists banco_entries_no_update on public.banco_entries;
create trigger banco_entries_no_update before update on public.banco_entries
  for each row execute function public.banco_entries_immutable();

-- Primo conto (giocatore o piatto) che andrebbe sotto zero; il banco ('bank') è infinito
create or replace function public.banco_negative_account(p_table text) returns text
language sql stable security definer set search_path = public as $$
  select acc from (
    select acc, sum(delta) as bal from (
      select to_acc as acc, amount as delta from public.banco_entries where table_id = p_table
      union all
      select from_acc as acc, -amount as delta from public.banco_entries where table_id = p_table
    ) x group by acc
  ) b where acc <> 'bank' and bal < 0 limit 1
$$;

create or replace function public.banco_insert_entries(p_table text, p_entries jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.banco_entries (id, table_id, ts, from_acc, to_acc, amount, kind, note, undo_of)
  select e->>'id', p_table,
         coalesce((e->>'ts')::bigint, (extract(epoch from now()) * 1000)::bigint),
         e->>'from', e->>'to', (e->>'amount')::bigint, e->>'kind', e->>'note', e->>'undoOf'
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality as x(e, n)
  order by n
$$;

-- Chi chiama è membro del tavolo? Lo dice auth.uid(), non un dato mandato dall'app
create or replace function public.banco_is_member(p_table text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.banco_members m where m.table_id = p_table and m.user_id = auth.uid())
$$;

-- Fotografia coerente di un tavolo: stato + righe del registro dopo p_after
create or replace function public.banco_snapshot(p_table text, p_after bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'table', jsonb_build_object('id', t.id, 'code', t.code, 'state', t.state, 'version', t.version, 'status', t.status),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('seq', e.seq, 'id', e.id, 'ts', e.ts, 'from', e.from_acc, 'to', e.to_acc,
                                          'amount', e.amount, 'kind', e.kind, 'note', e.note, 'undoOf', e.undo_of) order by e.seq)
      from public.banco_entries e where e.table_id = t.id and e.seq > coalesce(p_after, 0)
    ), '[]'::jsonb),
    -- giocatori che hanno un telefono al tavolo, e il giocatore di chi chiede
    'phones', coalesce((select jsonb_agg(m.player_id) from public.banco_members m where m.table_id = t.id and m.player_id is not null), '[]'::jsonb),
    'mine', (select to_jsonb(m.player_id) from public.banco_members m where m.table_id = t.id and m.user_id = auth.uid())
  )
  from public.banco_tables t
  where t.id = p_table
$$;

-- Crea il tavolo sul server: chi lo crea diventa il primo membro (host)
create or replace function public.banco_create(p_id text, p_code text, p_kind text, p_name text, p_status text, p_state jsonb, p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v int; bad text; u uuid := auth.uid();
begin
  if u is null then return jsonb_build_object('error', 'auth'); end if;
  select version into v from public.banco_tables where id = p_id;
  if found then
    if public.banco_is_member(p_id) then return jsonb_build_object('version', v, 'existing', true); end if;
    return jsonb_build_object('error', 'exists');
  end if;
  if exists (select 1 from public.banco_tables where code = upper(p_code) and status <> 'closed') then
    return jsonb_build_object('error', 'code_taken');
  end if;
  begin
    insert into public.banco_tables (id, code, kind, name, status, state, version)
    values (p_id, upper(p_code), p_kind, left(coalesce(p_name, 'Tavolo'), 80), coalesce(p_status, 'lobby'), p_state, 1);
    insert into public.banco_members (table_id, user_id, is_host, player_id)
    values (p_id, u, true, (select p->>'id' from jsonb_array_elements(public.banco_arr(p_state->'players')) p
                             where coalesce((p->>'isHost')::boolean, false) limit 1));
    perform public.banco_insert_entries(p_id, p_entries);
    bad := public.banco_negative_account(p_id);
    if bad is not null then raise exception 'NEG:%', bad; end if;
  exception
    when raise_exception then return jsonb_build_object('error', 'negative', 'detail', sqlerrm);
    when others then return jsonb_build_object('error', 'invalid', 'detail', sqlerrm);
  end;
  return jsonb_build_object('version', 1);
end $$;

-- Entra col codice: l'unico modo per diventare membro di un tavolo creato da altri.
-- Massimo 10 codici sbagliati ogni 15 minuti per identità.
create or replace function public.banco_join(p_code text, p_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); tid text; fails int;
begin
  if u is null then return jsonb_build_object('error', 'auth'); end if;
  select count(*) into fails from public.banco_code_attempts
   where user_id = u and not ok and at > now() - interval '15 minutes';
  if fails >= 10 then return jsonb_build_object('error', 'rate_limited'); end if;
  select t.id into tid from public.banco_tables t
   where t.code = upper(trim(coalesce(p_code, ''))) and t.status <> 'closed' and (p_id is null or t.id = p_id)
   order by t.created_at desc
   limit 1;
  delete from public.banco_code_attempts where user_id = u and at < now() - interval '1 day';
  insert into public.banco_code_attempts (user_id, ok) values (u, tid is not null);
  if tid is null then return jsonb_build_object('error', 'not_found'); end if;
  insert into public.banco_members (table_id, user_id) values (tid, u) on conflict do nothing;
  return public.banco_snapshot(tid, 0);
end $$;

-- Lettura di un tavolo: solo per i suoi membri. "Non esiste" e "non sei al tavolo" danno la stessa risposta.
drop function if exists public.banco_get(text, text, bigint);
create or replace function public.banco_get(p_id text, p_after bigint default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth'); end if;
  if not public.banco_is_member(p_id) then return jsonb_build_object('error', 'forbidden'); end if;
  return public.banco_snapshot(p_id, coalesce(p_after, 0));
end $$;

-- Questo telefono è il giocatore p_player. Un giocatore = un telefono; non si prende l'host né chi è "senza telefono".
create or replace function public.banco_claim(p_id text, p_player text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); cur text; v int;
begin
  if u is null then return jsonb_build_object('error', 'auth'); end if;
  select player_id into cur from public.banco_members where table_id = p_id and user_id = u;
  if not found then return jsonb_build_object('error', 'forbidden'); end if;
  if cur = p_player then return jsonb_build_object('ok', true); end if;
  if cur is not null then return jsonb_build_object('error', 'already'); end if;
  if not exists (
    select 1 from public.banco_tables t, jsonb_array_elements(public.banco_arr(t.state->'players')) p
     where t.id = p_id and p->>'id' = p_player
       and not coalesce((p->>'isHost')::boolean, false)
       and not coalesce((p->>'noPhone')::boolean, false)
  ) then
    return jsonb_build_object('error', 'no_player');
  end if;
  if exists (select 1 from public.banco_members where table_id = p_id and player_id = p_player) then
    return jsonb_build_object('error', 'taken');
  end if;
  update public.banco_members set player_id = p_player where table_id = p_id and user_id = u;
  update public.banco_tables set version = version + 1, updated_at = now() where id = p_id returning version into v;
  begin
    perform realtime.send(jsonb_build_object('version', v), 'version', 'banco-' || p_id, false);
  exception when others then
    null;
  end;
  return jsonb_build_object('ok', true, 'version', v);
exception when unique_violation then
  return jsonb_build_object('error', 'taken');
end $$;

-- Ogni mossa: solo dai membri del tavolo, sulla stessa versione vista dal telefono, nessun saldo sotto zero.
-- Dopo il salvataggio avvisa gli altri telefoni con un broadcast che contiene solo il numero di versione.
create or replace function public.banco_commit(p_id text, p_version int, p_state jsonb, p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur int; bad text; old_state jsonb; me_player text; me_host boolean;
        old_pay jsonb; new_pay jsonb; np jsonb; op jsonb; same boolean; i int;
        old_end jsonb; new_end jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth'); end if;
  if not public.banco_is_member(p_id) then return jsonb_build_object('error', 'forbidden'); end if;
  select version, state into cur, old_state from public.banco_tables where id = p_id for update;
  if not found then return jsonb_build_object('error', 'forbidden'); end if;
  if cur <> p_version then return jsonb_build_object('error', 'conflict', 'version', cur); end if;

  select m.player_id, m.is_host into me_player, me_host from public.banco_members m where m.table_id = p_id and m.user_id = auth.uid();

  -- Nomi dei giocatori: l'host li cambia tutti, gli altri solo il proprio
  if not coalesce(me_host, false) and exists (
    select 1
      from jsonb_array_elements(public.banco_arr(old_state->'players')) o
      join jsonb_array_elements(public.banco_arr(p_state->'players')) n on n->>'id' = o->>'id'
     where (n->>'name') is distinct from (o->>'name')
       and (me_player is null or o->>'id' <> me_player)
  ) then
    return jsonb_build_object('error', 'not_allowed', 'detail', 'rename');
  end if;

  old_pay := public.banco_arr(old_state->'payments');
  new_pay := public.banco_arr(p_state->'payments');
  old_end := nullif(old_state->'endedAt', 'null'::jsonb);
  new_end := nullif(p_state->'endedAt', 'null'::jsonb);

  -- L'elenco "chi paga chi" si rifà solo quando la serata si chiude (endedAt: vuoto -> data) o si riapre (data -> vuoto).
  -- Altrimenti resta identico: stessi pagamenti, stesso ordine, stessi from/to/cents; cambia al massimo lo stato.
  if old_end is not null and new_end is not null and old_end is distinct from new_end then
    return jsonb_build_object('error', 'invalid', 'detail', 'payments_replaced');
  end if;
  if old_end is not distinct from new_end then
    if jsonb_array_length(new_pay) <> jsonb_array_length(old_pay) then
      return jsonb_build_object('error', 'invalid', 'detail', 'payments_changed');
    end if;
    for i in 0 .. jsonb_array_length(new_pay) - 1 loop
      np := new_pay->i;
      op := old_pay->i;
      if (np->'from') is distinct from (op->'from') or (np->'to') is distinct from (op->'to') or (np->'cents') is distinct from (op->'cents') then
        return jsonb_build_object('error', 'invalid', 'detail', 'payments_changed');
      end if;
    end loop;
  end if;

  -- Fine serata: "ricevuto" lo segna solo chi riceve i soldi, oppure l'host per chi non ha un telefono al tavolo.
  -- Tornare a "non pagato" lo possono fare chi riceve e l'host.
  for i in 0 .. jsonb_array_length(new_pay) - 1 loop
    np := new_pay->i;
    op := old_pay->i;
    same := coalesce(op is not null and op->>'from' = np->>'from' and op->>'to' = np->>'to' and op->>'cents' = np->>'cents', false);
    if coalesce(np->>'status', '') = 'received' and not (same and coalesce(op->>'status', '') = 'received') then
      if not (coalesce(np->>'to' = me_player, false)
              or (coalesce(me_host, false) and not exists (select 1 from public.banco_members x where x.table_id = p_id and x.player_id = np->>'to'))) then
        return jsonb_build_object('error', 'not_receiver');
      end if;
    elsif same and coalesce(op->>'status', '') = 'received' and coalesce(np->>'status', '') <> 'received' then
      if not (coalesce(np->>'to' = me_player, false) or coalesce(me_host, false)) then
        return jsonb_build_object('error', 'not_receiver');
      end if;
    end if;
  end loop;

  begin
    perform public.banco_insert_entries(p_id, p_entries);
    bad := public.banco_negative_account(p_id);
    if bad is not null then raise exception 'NEG:%', bad; end if;
  exception
    when raise_exception then return jsonb_build_object('error', 'negative', 'detail', sqlerrm);
    when unique_violation then return jsonb_build_object('error', 'duplicate', 'detail', sqlerrm);
    when others then return jsonb_build_object('error', 'invalid', 'detail', sqlerrm);
  end;
  update public.banco_tables
     set state = p_state,
         status = coalesce(p_state->>'status', status),
         name = left(coalesce(p_state->>'name', name), 80),
         version = cur + 1,
         updated_at = now()
   where id = p_id;
  begin
    perform realtime.send(jsonb_build_object('version', cur + 1), 'version', 'banco-' || p_id, false);
  exception when others then
    null; -- l'avviso è un di più: la mossa è salvata, gli altri si riallineano alla prossima lettura
  end;
  return jsonb_build_object('version', cur + 1);
end $$;

-- Permessi: le funzioni interne non sono chiamabili da fuori; quelle pubbliche solo da chi ha un'identità
revoke all on function public.banco_negative_account(text) from public, anon, authenticated;
revoke all on function public.banco_insert_entries(text, jsonb) from public, anon, authenticated;
revoke all on function public.banco_is_member(text) from public, anon, authenticated;
revoke all on function public.banco_snapshot(text, bigint) from public, anon, authenticated;
revoke all on function public.banco_arr(jsonb) from public, anon, authenticated;
revoke all on function public.banco_claim(text, text) from public, anon;
grant execute on function public.banco_claim(text, text) to authenticated;
revoke all on function public.banco_create(text, text, text, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.banco_join(text, text) from public, anon;
revoke all on function public.banco_get(text, bigint) from public, anon;
revoke all on function public.banco_commit(text, int, jsonb, jsonb) from public, anon;
grant execute on function public.banco_create(text, text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.banco_join(text, text) to authenticated;
grant execute on function public.banco_get(text, bigint) to authenticated;
grant execute on function public.banco_commit(text, int, jsonb, jsonb) to authenticated;

-- ---------- Account (email e password) ----------
-- Dati personali (nome, tavoli, serate passate) di chi ha un account vero. Solo via rpc, mai le tabelle dirette.
create table if not exists public.banco_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  data jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.banco_profiles enable row level security;
revoke all on public.banco_profiles from anon, authenticated;

-- Passaggio dei posti al tavolo dall'identità anonima del telefono all'account (gettone segreto, valido 1 ora)
create table if not exists public.banco_handoffs (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.banco_handoffs enable row level security;
revoke all on public.banco_handoffs from anon, authenticated;

create or replace function public.banco_is_account() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
$$;

create or replace function public.banco_profile_get() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.banco_profiles;
begin
  if not public.banco_is_account() then return jsonb_build_object('error', 'auth'); end if;
  select * into r from public.banco_profiles where user_id = auth.uid();
  if not found then return jsonb_build_object('version', 0, 'name', '', 'data', '{}'::jsonb); end if;
  return jsonb_build_object('version', r.version, 'name', r.name, 'data', r.data, 'updated_at', r.updated_at);
end $$;

-- Salva solo se nessun altro telefono ha salvato nel frattempo (versione), altrimenti 'conflict'
create or replace function public.banco_profile_save(p_version int, p_name text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur int; u uuid := auth.uid();
begin
  if not public.banco_is_account() then return jsonb_build_object('error', 'auth'); end if;
  if jsonb_typeof(coalesce(p_data, '{}'::jsonb)) <> 'object' then return jsonb_build_object('error', 'invalid'); end if;
  if pg_column_size(p_data) > 3000000 then return jsonb_build_object('error', 'too_big'); end if;
  select version into cur from public.banco_profiles where user_id = u for update;
  if not found then
    if coalesce(p_version, 0) <> 0 then return jsonb_build_object('error', 'conflict', 'version', 0); end if;
    insert into public.banco_profiles (user_id, name, data, version)
    values (u, left(coalesce(p_name, ''), 40), coalesce(p_data, '{}'::jsonb), 1)
    on conflict (user_id) do nothing;
    if not found then return jsonb_build_object('error', 'conflict'); end if;
    return jsonb_build_object('version', 1);
  end if;
  if cur <> coalesce(p_version, -1) then return jsonb_build_object('error', 'conflict', 'version', cur); end if;
  update public.banco_profiles
     set name = left(coalesce(p_name, ''), 40), data = coalesce(p_data, '{}'::jsonb), version = cur + 1, updated_at = now()
   where user_id = u;
  return jsonb_build_object('version', cur + 1);
end $$;

create or replace function public.banco_handoff_start() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); tok text;
begin
  if u is null then return jsonb_build_object('error', 'auth'); end if;
  if not coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then return jsonb_build_object('error', 'not_anonymous'); end if;
  delete from public.banco_handoffs where created_at < now() - interval '1 hour' or user_id = u;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.banco_handoffs (token, user_id) values (tok, u);
  return jsonb_build_object('token', tok);
end $$;

create or replace function public.banco_handoff_finish(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); old uuid; r record; n int := 0;
begin
  if u is null then return jsonb_build_object('error', 'auth'); end if;
  delete from public.banco_handoffs
   where token = coalesce(p_token, '') and created_at > now() - interval '1 hour'
  returning user_id into old;
  if old is null then return jsonb_build_object('error', 'not_found'); end if;
  if old = u then return jsonb_build_object('moved', 0); end if;
  for r in select table_id, is_host, player_id from public.banco_members where user_id = old loop
    if exists (select 1 from public.banco_members where table_id = r.table_id and user_id = u) then
      delete from public.banco_members where table_id = r.table_id and user_id = old;
      update public.banco_members
         set is_host = is_host or r.is_host, player_id = coalesce(player_id, r.player_id)
       where table_id = r.table_id and user_id = u;
    else
      update public.banco_members set user_id = u where table_id = r.table_id and user_id = old;
    end if;
    n := n + 1;
  end loop;
  return jsonb_build_object('moved', n);
end $$;

revoke all on function public.banco_is_account() from public, anon, authenticated;
revoke all on function public.banco_profile_get() from public, anon;
revoke all on function public.banco_profile_save(int, text, jsonb) from public, anon;
revoke all on function public.banco_handoff_start() from public, anon;
revoke all on function public.banco_handoff_finish(text) from public, anon;
grant execute on function public.banco_profile_get() to authenticated;
grant execute on function public.banco_profile_save(int, text, jsonb) to authenticated;
grant execute on function public.banco_handoff_start() to authenticated;
grant execute on function public.banco_handoff_finish(text) to authenticated;

-- Una tantum: i tavoli creati prima dei membri non hanno un proprietario e i loro codici erano leggibili da tutti.
-- Si chiudono (niente viene cancellato): con quei codici non si entra più.
update public.banco_tables t
   set status = 'closed', state = jsonb_set(t.state, '{status}', '"closed"'), updated_at = now()
 where t.status <> 'closed'
   and not exists (select 1 from public.banco_members m where m.table_id = t.id);

notify pgrst, 'reload schema';
