-- Add parent linkage columns to custom_categories
alter table public.custom_categories
  add column if not exists parent_id uuid references public.custom_categories(id) on delete restrict,
  add column if not exists parent_builtin text,
  add column if not exists root_builtin text;

create index if not exists custom_categories_parent_id_idx on public.custom_categories(parent_id);
create index if not exists custom_categories_parent_builtin_idx on public.custom_categories(parent_builtin);

-- Exactly-one-parent rule: at most one of parent_id / parent_builtin set
alter table public.custom_categories drop constraint if exists custom_categories_one_parent;
alter table public.custom_categories
  add constraint custom_categories_one_parent
  check (parent_id is null or parent_builtin is null);

-- Trigger: cycle prevention + auto-derive root_builtin
create or replace function public.custom_categories_validate()
returns trigger language plpgsql as $$
declare
  _depth int := 0;
  _cur uuid;
  _parent_row record;
begin
  -- Cannot be your own parent
  if new.parent_id is not null and new.parent_id = new.id then
    raise exception 'cycle: a category cannot be its own parent';
  end if;

  -- Derive root_builtin from chain
  if new.parent_builtin is not null then
    new.root_builtin := new.parent_builtin;
  elsif new.parent_id is not null then
    -- walk up the chain, max 64 hops
    _cur := new.parent_id;
    while _cur is not null and _depth < 64 loop
      if _cur = new.id then
        raise exception 'cycle detected in custom_categories tree';
      end if;
      select parent_id, parent_builtin, root_builtin
        into _parent_row
        from public.custom_categories
        where id = _cur;
      if not found then
        exit;
      end if;
      if _parent_row.parent_builtin is not null then
        new.root_builtin := _parent_row.parent_builtin;
        exit;
      end if;
      if _parent_row.root_builtin is not null then
        new.root_builtin := _parent_row.root_builtin;
        exit;
      end if;
      _cur := _parent_row.parent_id;
      _depth := _depth + 1;
    end loop;
    if _depth >= 64 then
      raise exception 'category tree too deep';
    end if;
  else
    new.root_builtin := null;
  end if;

  return new;
end;
$$;

drop trigger if exists custom_categories_validate_trg on public.custom_categories;
create trigger custom_categories_validate_trg
  before insert or update on public.custom_categories
  for each row execute function public.custom_categories_validate();

-- Block deletion if non-empty (has child categories OR documents)
create or replace function public.custom_categories_block_nonempty_delete()
returns trigger language plpgsql as $$
declare
  _kids int;
  _docs int;
begin
  if old.is_system then
    raise exception 'system categories cannot be deleted';
  end if;
  select count(*) into _kids from public.custom_categories where parent_id = old.id;
  if _kids > 0 then
    raise exception 'category has subfolders';
  end if;
  select count(*) into _docs from public.documents
    where user_id = old.user_id and category = 'custom:' || old.id::text;
  if _docs > 0 then
    raise exception 'category is not empty';
  end if;
  return old;
end;
$$;

drop trigger if exists custom_categories_block_delete_trg on public.custom_categories;
create trigger custom_categories_block_delete_trg
  before delete on public.custom_categories
  for each row execute function public.custom_categories_block_nonempty_delete();
