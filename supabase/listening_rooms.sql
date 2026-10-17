-- LEGACY: replaced by friend_listening.sql; apply that migration afterward. No room UI remains.
-- Run after music_library.sql. Rooms are private to signed-in people with the link.
begin;
create table if not exists public.listening_rooms (
  id uuid primary key default gen_random_uuid(), host_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(char_length(title) between 1 and 80),
  track_id uuid references public.music_tracks(id), queue_ids uuid[] not null default '{}',
  playing boolean not null default false, position double precision not null default 0 check(position>=0 and position<=86400),
  anchored_at timestamptz not null default clock_timestamp(), revision bigint not null default 0,
  closed boolean not null default false,created_at timestamptz not null default now(),check(cardinality(queue_ids)<=100)
);
create table if not exists public.listening_room_members (
  room_id uuid not null references public.listening_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,last_seen timestamptz not null default now(),
  primary key(room_id,user_id)
);
create table if not exists public.listening_room_messages (
  id uuid primary key default gen_random_uuid(),room_id uuid not null references public.listening_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,body text not null check(char_length(body) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists listening_room_messages_recent on public.listening_room_messages(room_id,created_at desc);
alter table public.listening_rooms enable row level security;
alter table public.listening_room_members enable row level security;
alter table public.listening_room_messages enable row level security;
revoke all on public.listening_rooms,public.listening_room_members,public.listening_room_messages from anon,authenticated;
grant select on public.listening_rooms to authenticated;
create or replace function public.listening_room_member(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.listening_room_members where room_id=p_room and user_id=auth.uid() and last_seen>now()-interval '60 seconds');
$$;
revoke all on function public.listening_room_member(uuid) from public;
grant execute on function public.listening_room_member(uuid) to authenticated;
drop policy if exists listening_rooms_read on public.listening_rooms;
create policy listening_rooms_read on public.listening_rooms for select to authenticated using(public.listening_room_member(id));

create or replace function public.listening_room_snapshot(p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.listening_rooms; stamp timestamptz:=clock_timestamp(); host_seen timestamptz; result jsonb; duration integer; idx integer; elapsed double precision;
begin
 if auth.uid() is null or not exists(select 1 from public.listening_room_members where room_id=p_room and user_id=auth.uid()) then raise exception 'Нет доступа к комнате' using errcode='42501';end if;
 select * into r from public.listening_rooms where id=p_room for update;
 if not found then raise exception 'Комната не найдена' using errcode='P0002';end if;
 update public.listening_room_members set last_seen=stamp where room_id=p_room and user_id=auth.uid();
 select last_seen into host_seen from public.listening_room_members where room_id=p_room and user_id=r.host_id;
 if r.playing and (host_seen is null or host_seen<stamp-interval '60 seconds') then
  update public.listening_rooms set playing=false,position=least(86400,position+greatest(0,extract(epoch from stamp-anchored_at))),anchored_at=stamp,revision=revision+1 where id=p_room returning * into r;
 end if;
 -- Server time advances the queue even when the host has locally disabled sound.
 while r.playing and not r.closed loop
  select duration_seconds into duration from public.music_tracks where id=r.track_id and is_published;
  if duration is null then
   update public.listening_rooms set playing=false,anchored_at=stamp,revision=revision+1 where id=p_room returning * into r;exit;
  end if;
  elapsed:=r.position+greatest(0,extract(epoch from stamp-r.anchored_at));
  exit when elapsed<duration;
  idx:=array_position(r.queue_ids,r.track_id)+1;
  if idx between 1 and cardinality(r.queue_ids) then
   update public.listening_rooms set track_id=r.queue_ids[idx],position=0,anchored_at=r.anchored_at+(duration-r.position)*interval '1 second',revision=revision+1 where id=p_room returning * into r;
  else
   update public.listening_rooms set playing=false,position=duration,anchored_at=stamp,revision=revision+1 where id=p_room returning * into r;
  end if;
 end loop;
 select jsonb_build_object('id',r.id,'title',r.title,'hostId',r.host_id,'trackId',r.track_id,'queueIds',r.queue_ids,'playing',r.playing,'position',r.position,'anchoredAt',r.anchored_at,'serverNow',stamp,'revision',r.revision,'closed',r.closed,'hostOnline',host_seen>stamp-interval '60 seconds',
  'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.display_name,p.username,'Слушатель'),'host',m.user_id=r.host_id) order by m.user_id=r.host_id desc,m.user_id) from public.listening_room_members m left join public.profiles p on p.id=m.user_id where m.room_id=p_room and m.last_seen>stamp-interval '60 seconds'),'[]'::jsonb),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',coalesce(p.display_name,p.username,'Слушатель'),'text',v.body,'time',v.created_at) order by v.created_at,v.id) from (select * from public.listening_room_messages where room_id=p_room order by created_at desc,id desc limit 50) v left join public.profiles p on p.id=v.user_id),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function public.listening_room_create(p_title text,p_tracks uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; ids uuid[]:=coalesce(p_tracks,'{}');
begin
 if auth.uid() is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 if char_length(btrim(p_title)) not between 1 and 80 or cardinality(ids)>100 or cardinality(ids)<>(select count(distinct id) from unnest(ids) t(id)) then raise exception 'Проверьте название и очередь';end if;
 if exists(select 1 from unnest(ids) t(id) where not exists(select 1 from public.music_tracks mt where mt.id=t.id and mt.is_published)) then raise exception 'Песня недоступна';end if;
 if (select count(*) from public.listening_rooms where host_id=auth.uid() and not closed and created_at>now()-interval '1 day')>=10 then raise exception 'Закройте одну из своих комнат';end if;
 insert into public.listening_rooms(host_id,title,track_id,queue_ids) values(auth.uid(),btrim(p_title),ids[1],ids) returning id into rid;
 insert into public.listening_room_members(room_id,user_id) values(rid,auth.uid());
 return public.listening_room_snapshot(rid);
end $$;
create or replace function public.listening_room_join(p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 perform 1 from public.listening_rooms where id=p_room and not closed for update;
 if not found then raise exception 'Комната закрыта или не существует' using errcode='P0002';end if;
 if not exists(select 1 from public.listening_room_members where room_id=p_room and user_id=auth.uid() and last_seen>now()-interval '60 seconds') and (select count(*) from public.listening_room_members where room_id=p_room and last_seen>now()-interval '60 seconds')>=20 then raise exception 'В комнате уже 20 участников';end if;
 insert into public.listening_room_members(room_id,user_id) values(p_room,auth.uid()) on conflict(room_id,user_id) do update set last_seen=clock_timestamp();
 return public.listening_room_snapshot(p_room);
end $$;
create or replace function public.listening_room_command(p_room uuid,p_revision bigint,p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.listening_rooms; kind text:=p_command->>'type'; ids uuid[]; tid uuid; idx integer; pos double precision; stamp timestamptz:=clock_timestamp();
begin
 select * into r from public.listening_rooms where id=p_room for update;
 if not found or r.closed then raise exception 'Комната закрыта' using errcode='P0002';end if;
 if auth.uid() is null or r.host_id<>auth.uid() or not exists(select 1 from public.listening_room_members where room_id=p_room and user_id=auth.uid()) then raise exception 'Управлять может только ведущий' using errcode='42501';end if;
 if r.revision<>p_revision then raise exception 'Состояние изменилось. Повторите действие.' using errcode='40001';end if;
 pos:=least(86400,r.position+case when r.playing then greatest(0,extract(epoch from stamp-r.anchored_at)) else 0 end);
 if kind='play' then
  select coalesce(array_agg(value::uuid order by ord),'{}') into ids from jsonb_array_elements_text(p_command->'queueIds') with ordinality t(value,ord);
  tid:=(p_command->>'trackId')::uuid;
  if cardinality(ids) not between 1 and 100 or not tid=any(ids) or cardinality(ids)<>(select count(distinct id) from unnest(ids) t(id)) or exists(select 1 from unnest(ids) t(id) where not exists(select 1 from public.music_tracks mt where mt.id=t.id and mt.is_published)) then raise exception 'Проверьте очередь';end if;
  r.queue_ids:=ids;r.track_id:=tid;r.playing:=true;pos:=0;
 elsif kind='pause' then r.playing:=false;
 elsif kind='resume' then
  if r.track_id is null or not exists(select 1 from public.music_tracks where id=r.track_id and is_published) then raise exception 'Сначала выберите песню';end if;
  if pos>=(select duration_seconds from public.music_tracks where id=r.track_id) then pos:=0;end if;r.playing:=true;
 elsif kind='seek' then
  pos:=(p_command->>'position')::double precision;
  if pos is null or pos<0 or pos>86400 or pos='NaN'::float8 then raise exception 'Некорректная позиция';end if;
  select least(pos,duration_seconds) into pos from public.music_tracks where id=r.track_id;
  if pos is null then raise exception 'Сначала выберите песню';end if;
 elsif kind in ('next','previous') then
  idx:=array_position(r.queue_ids,r.track_id)+case when kind='next' then 1 else -1 end;
  if idx between 1 and cardinality(r.queue_ids) then r.track_id:=r.queue_ids[idx];pos:=0;r.playing:=true;
  elsif kind='previous' then pos:=0;
  else r.playing:=false;select duration_seconds into pos from public.music_tracks where id=r.track_id;end if;
 elsif kind='queue' then
  tid:=(p_command->>'trackId')::uuid;
  if not exists(select 1 from public.music_tracks where id=tid and is_published) then raise exception 'Песня недоступна';end if;
  if not tid=any(r.queue_ids) then
   if cardinality(r.queue_ids)>=100 then raise exception 'В очереди уже 100 песен';end if;
   if p_command->>'next'='true' and r.track_id is not null then idx:=array_position(r.queue_ids,r.track_id);r.queue_ids:=r.queue_ids[1:idx]||tid||r.queue_ids[idx+1:cardinality(r.queue_ids)];else r.queue_ids:=array_append(r.queue_ids,tid);end if;
   if r.track_id is null then r.track_id:=tid;pos:=0;end if;
  end if;
 elsif kind='remove' then
  tid:=(p_command->>'trackId')::uuid;if tid=r.track_id then raise exception 'Нельзя удалить текущую песню';end if;r.queue_ids:=array_remove(r.queue_ids,tid);
 elsif kind='close' then r.closed:=true;r.playing:=false;
 else raise exception 'Неизвестная команда';end if;
 update public.listening_rooms set track_id=r.track_id,queue_ids=r.queue_ids,playing=r.playing,position=coalesce(pos,0),anchored_at=stamp,revision=revision+1,closed=r.closed where id=p_room;
 return public.listening_room_snapshot(p_room);
end $$;
create or replace function public.listening_room_chat(p_room uuid,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.listening_room_member(p_room) or exists(select 1 from public.listening_rooms where id=p_room and closed) then raise exception 'Войдите в комнату' using errcode='42501';end if;
 if char_length(btrim(p_body)) not between 1 and 1000 then raise exception 'Сообщение: от 1 до 1000 символов';end if;
 if exists(select 1 from public.listening_room_messages where room_id=p_room and user_id=auth.uid() and created_at>clock_timestamp()-interval '1 second') then raise exception 'Подождите секунду';end if;
 insert into public.listening_room_messages(room_id,user_id,body) values(p_room,auth.uid(),btrim(p_body));
 return public.listening_room_snapshot(p_room);
end $$;
create or replace function public.listening_room_leave(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.listening_rooms;stamp timestamptz:=clock_timestamp();
begin
 select * into r from public.listening_rooms where id=p_room for update;
 if auth.uid() is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 if r.host_id=auth.uid() then update public.listening_rooms set playing=false,position=least(86400,position+case when playing then greatest(0,extract(epoch from stamp-anchored_at)) else 0 end),anchored_at=stamp,revision=revision+1 where id=p_room;end if;
 delete from public.listening_room_members where room_id=p_room and user_id=auth.uid();
end $$;
revoke all on function public.listening_room_snapshot(uuid),public.listening_room_create(text,uuid[]),public.listening_room_join(uuid),public.listening_room_command(uuid,bigint,jsonb),public.listening_room_chat(uuid,text),public.listening_room_leave(uuid) from public;
grant execute on function public.listening_room_snapshot(uuid),public.listening_room_create(text,uuid[]),public.listening_room_join(uuid),public.listening_room_command(uuid,bigint,jsonb),public.listening_room_chat(uuid,text),public.listening_room_leave(uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='listening_rooms') then alter publication supabase_realtime add table public.listening_rooms;end if;
end $$;
commit;
