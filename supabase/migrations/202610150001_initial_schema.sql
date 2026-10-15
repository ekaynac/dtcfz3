create extension if not exists pgcrypto;

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  author text not null check (length(btrim(author)) between 1 and 160),
  category text not null check (length(btrim(category)) between 1 and 80),
  shelf text not null default '' check (length(btrim(shelf)) <= 80),
  copies integer not null default 1 check (copies between 1 and 1000),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  borrower_name text,
  checked_out_at timestamptz not null default now(),
  returned_at timestamptz,
  check (returned_at is not null or (borrower_name is not null and length(btrim(borrower_name)) between 1 and 100)),
  check (returned_at is null or returned_at >= checked_out_at)
);

create index loans_active_by_book on public.loans (book_id) where returned_at is null;
create index loans_active_by_date on public.loans (checked_out_at) where returned_at is null;

create or replace function public.is_library_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

revoke all on function public.is_library_admin() from public;
grant execute on function public.is_library_admin() to authenticated;

alter table public.books enable row level security;
alter table public.loans enable row level security;

grant select on public.books to anon, authenticated;
grant insert, update, delete on public.books to authenticated;
revoke all on table public.loans from anon, public;
grant select on table public.loans to authenticated;

create policy "Public can read active book records"
  on public.books for select to anon
  using (not archived);

create policy "Admins can manage books"
  on public.books for all to authenticated
  using ((select public.is_library_admin()))
  with check ((select public.is_library_admin()));

create policy "Admins can read loans"
  on public.loans for select to authenticated
  using ((select public.is_library_admin()));


create or replace function public.get_public_catalog()
returns table (
  id uuid,
  title text,
  author text,
  category text,
  shelf text,
  copies integer,
  available_copies integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.title, b.author, b.category, b.shelf, b.copies,
    greatest(b.copies - count(l.id) filter (where l.returned_at is null), 0)::integer
  from public.books b
  left join public.loans l on l.book_id = b.id
  where not b.archived
  group by b.id
  order by b.title;
$$;

revoke all on function public.get_public_catalog() from public;
grant execute on function public.get_public_catalog() to anon, authenticated;

create or replace function public.borrow_book(p_book_id uuid, p_borrower_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_book public.books%rowtype;
  active_loans integer;
  new_loan_id uuid;
begin
  if p_borrower_name is null or length(btrim(p_borrower_name)) not between 1 and 100 then
    raise exception 'Lütfen adınızı 1-100 karakter arasında girin.' using errcode = '22023';
  end if;

  select * into requested_book
  from public.books
  where id = p_book_id and not archived
  for update;

  if not found then
    raise exception 'Bu kitap artık ödünç verilemiyor.' using errcode = 'P0002';
  end if;

  select count(*)::integer into active_loans
  from public.loans
  where book_id = requested_book.id and returned_at is null;

  if active_loans >= requested_book.copies then
    raise exception 'Bu kitabın tüm nüshaları şu anda ödünçte.' using errcode = 'P0001';
  end if;

  insert into public.loans (book_id, borrower_name)
  values (requested_book.id, btrim(p_borrower_name))
  returning id into new_loan_id;

  return new_loan_id;
end;
$$;

revoke all on function public.borrow_book(uuid, text) from public;
grant execute on function public.borrow_book(uuid, text) to anon, authenticated;

create or replace function public.return_loan(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false) then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;

  update public.loans
  set returned_at = now(), borrower_name = null
  where id = p_loan_id and returned_at is null;

  if not found then
    raise exception 'Açık ödünç kaydı bulunamadı.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.return_loan(uuid) from public;
grant execute on function public.return_loan(uuid) to authenticated;

create or replace function public.keep_copies_above_active_loans()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  active_loans integer;
begin
  if new.copies < old.copies then
    select count(*)::integer into active_loans
    from public.loans
    where book_id = old.id and returned_at is null;

    if new.copies < active_loans then
      raise exception 'Nüsha adedi, halen ödünçteki kitap sayısından az olamaz.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger books_keep_copies_above_active_loans
  before update of copies on public.books
  for each row execute function public.keep_copies_above_active_loans();
