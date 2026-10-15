alter table public.books alter column shelf set default '';
alter table public.books drop constraint books_shelf_check;
alter table public.books add constraint books_shelf_check
  check (length(btrim(shelf)) <= 80);
