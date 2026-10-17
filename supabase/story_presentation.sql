begin;
alter table public.stories add column if not exists presentation jsonb not null default '{}'::jsonb;

create or replace function public.valid_story_presentation(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare m jsonb; l jsonb; ids text[]:='{}'; text_length integer:=0; music_count integer:=0;
begin
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>16384 then return false;end if;
  if p='{}'::jsonb then return true;end if;
  if jsonb_typeof(p->'version') is distinct from 'number' or p->>'version'<>'1'
    or coalesce(p->>'filter','') not in ('none','warm','cool','mono','vintage')
    or jsonb_typeof(p->'media') is distinct from 'object'
    or jsonb_typeof(p->'layers') is distinct from 'array' then return false;end if;
  m:=p->'media';
  if coalesce(m->>'fit','') not in ('cover','contain')
    or jsonb_typeof(m->'zoom') is distinct from 'number' or (m->>'zoom')::numeric not between 1 and 3
    or jsonb_typeof(m->'x') is distinct from 'number' or (m->>'x')::numeric not between 0 and 100
    or jsonb_typeof(m->'y') is distinct from 'number' or (m->>'y')::numeric not between 0 and 100
    or jsonb_array_length(p->'layers')>20 then return false;end if;
  for l in select value from jsonb_array_elements(p->'layers') loop
    if jsonb_typeof(l) is distinct from 'object' or coalesce(l->>'id','') !~ '^[a-zA-Z0-9_-]{1,50}$' or l->>'id'=any(ids)
      or coalesce(l->>'kind','') not in ('text','sticker','music') or jsonb_typeof(l->'text') is distinct from 'string'
      or jsonb_typeof(l->'x') is distinct from 'number' or (l->>'x')::numeric not between 5 and 95
      or jsonb_typeof(l->'y') is distinct from 'number' or (l->>'y')::numeric not between 8 and 92
      or jsonb_typeof(l->'size') is distinct from 'number' or (l->>'size')::numeric not between 2 and 24
      or jsonb_typeof(l->'rotation') is distinct from 'number' or (l->>'rotation')::numeric not between -180 and 180
      or coalesce(l->>'color','') !~ '^#[0-9a-fA-F]{6}$'
      or coalesce(l->>'background','') not in ('none','dark','light')
      or coalesce(l->>'font','') not in ('sans','serif','mono') then return false;end if;
    if l->>'kind'='text' then text_length:=text_length+length(l->>'text');end if;
    if l->>'kind'='sticker' and l->>'text' not in ('❤️','✨','🎵','🎧','🔥','🌙','☀️','🦋','🌸','💜','⭐','🥰') then return false;end if;
    if l->>'kind'='music' then
      music_count:=music_count+1;
      if l->>'text'<>'' then return false;end if;
    end if;
    if text_length>300 or music_count>1 then return false;end if;
    ids:=array_append(ids,l->>'id');
  end loop;
  return true;
exception when others then return false;
end $$;

do $$begin
  if not exists(select 1 from pg_constraint where conrelid='public.stories'::regclass and conname='stories_presentation_valid') then
    alter table public.stories add constraint stories_presentation_valid check(public.valid_story_presentation(presentation));
  end if;
end $$;
grant update(presentation) on public.stories to authenticated;
notify pgrst,'reload schema';
commit;
