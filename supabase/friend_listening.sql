-- Direct listening with accepted friends. Apply after notifications.sql and music_library.sql.
begin;
create table if not exists public.music_social_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,broadcast boolean not null default true,allow_follow boolean not null default true
);
alter table public.music_social_preferences enable row level security;
revoke all on public.music_social_preferences from public,anon,authenticated;
grant select on public.music_social_preferences to authenticated;
drop policy if exists music_social_preferences_read on public.music_social_preferences;
create policy music_social_preferences_read on public.music_social_preferences for select to authenticated using(user_id=auth.uid());
create table if not exists public.friend_music_activity (
 user_id uuid primary key references auth.users(id) on delete cascade,
 track_id uuid not null references public.music_tracks(id),playing boolean not null,
 position double precision not null check(position>=0 and position<=86400),
 anchored_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 device_id uuid not null,sequence bigint not null check(sequence>=0)
);
create table if not exists public.friend_music_follows (
 listener_id uuid primary key references auth.users(id) on delete cascade,
 host_id uuid not null references auth.users(id) on delete cascade,device_id uuid not null,
 join_id uuid not null default gen_random_uuid(),joined_at timestamptz not null default clock_timestamp(),
 last_seen timestamptz not null default clock_timestamp(),check(listener_id<>host_id)
);
create index if not exists friend_music_followers on public.friend_music_follows(host_id,last_seen);
alter table public.friend_music_activity enable row level security;
alter table public.friend_music_follows enable row level security;
revoke all on public.friend_music_activity,public.friend_music_follows from public,anon,authenticated;
grant select on public.friend_music_activity,public.friend_music_follows to authenticated;
create or replace function public.music_are_friends(p_first uuid,p_second uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() in(p_first,p_second) and p_first<>p_second and exists(select 1 from public.friend_requests where status='accepted' and ((sender_id=p_first and receiver_id=p_second) or(sender_id=p_second and receiver_id=p_first)));
$$;
revoke all on function public.music_are_friends(uuid,uuid) from public,anon;
grant execute on function public.music_are_friends(uuid,uuid) to authenticated;
create or replace function public.music_activity_visible(p_host uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=p_host or(public.music_are_friends(auth.uid(),p_host) and coalesce((select broadcast from public.music_social_preferences where user_id=p_host),true) and exists(select 1 from public.friend_music_activity where user_id=p_host and updated_at>now()-interval '60 seconds'));
$$;
revoke all on function public.music_activity_visible(uuid) from public,anon;
grant execute on function public.music_activity_visible(uuid) to authenticated;
drop policy if exists friend_music_activity_read on public.friend_music_activity;
create policy friend_music_activity_read on public.friend_music_activity for select to authenticated using(public.music_activity_visible(user_id));
drop policy if exists friend_music_follows_read on public.friend_music_follows;
create policy friend_music_follows_read on public.friend_music_follows for select to authenticated using(listener_id=auth.uid() or(host_id=auth.uid() and public.music_are_friends(listener_id,host_id)));

create or replace function public.friend_music_publish(p_device uuid,p_sequence bigint,p_track uuid,p_playing boolean,p_position double precision,p_claim boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare duration integer; old public.friend_music_activity;stamp timestamptz:=clock_timestamp();
begin
 if auth.uid() is null then raise exception 'Войдите в Melo' using errcode='42501';end if;
 if p_device is null or p_sequence is null or p_sequence<0 or p_position is null or p_position<0 or p_position>86400 or p_position='NaN'::float8 or p_playing is null then raise exception 'Некорректное состояние плеера';end if;
 select duration_seconds into duration from public.music_tracks where id=p_track and is_published;
 if not found then raise exception 'Песня недоступна';end if;
 -- Serialize publication, joining and leaving for this account, including multiple browser tabs.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.music_social_preferences where user_id=auth.uid() and not broadcast) then return false;end if;
 if p_playing and exists(select 1 from public.friend_music_follows where listener_id=auth.uid() and last_seen>stamp-interval '60 seconds') then
  if p_claim then delete from public.friend_music_follows where listener_id=auth.uid() and device_id<>p_device;end if;
  if exists(select 1 from public.friend_music_follows where listener_id=auth.uid() and last_seen>stamp-interval '60 seconds') then return false;end if;
 end if;
 select * into old from public.friend_music_activity where user_id=auth.uid() for update;
 if found and ((old.device_id=p_device and old.sequence>=p_sequence) or(old.device_id<>p_device and old.updated_at>stamp-interval '60 seconds' and not p_claim)) then return false;end if;
 insert into public.friend_music_activity(user_id,track_id,playing,position,anchored_at,updated_at,device_id,sequence)
 values(auth.uid(),p_track,p_playing,least(p_position,duration),stamp,stamp,p_device,p_sequence)
 on conflict(user_id) do update set track_id=excluded.track_id,playing=excluded.playing,position=excluded.position,anchored_at=excluded.anchored_at,updated_at=excluded.updated_at,device_id=excluded.device_id,sequence=excluded.sequence;
 return true;
end $$;
create or replace function public.friend_music_state(p_device uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare stamp timestamptz:=clock_timestamp();following jsonb:=null;result jsonb;target public.friend_music_follows;
begin
 if auth.uid() is null or p_device is null then raise exception 'Войдите в Melo' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into target from public.friend_music_follows where listener_id=auth.uid() and device_id=p_device;
 if found then
  if public.music_are_friends(auth.uid(),target.host_id) and not exists(select 1 from public.music_social_preferences where user_id=target.host_id and (not broadcast or not allow_follow)) and exists(select 1 from public.friend_music_activity a join public.music_tracks t on t.id=a.track_id and t.is_published where a.user_id=target.host_id and a.updated_at>stamp-interval '60 seconds') and not exists(select 1 from public.friend_music_follows where listener_id=target.host_id and last_seen>stamp-interval '60 seconds') then
   update public.friend_music_follows set last_seen=stamp where listener_id=auth.uid() and device_id=p_device;
   select jsonb_build_object('id',a.user_id,'name',coalesce(p.display_name,p.username,'Друг'),'trackId',a.track_id,'playing',a.playing,'position',a.position,'anchoredAt',a.anchored_at) into following from public.friend_music_activity a left join public.profiles p on p.id=a.user_id where a.user_id=target.host_id;
  else delete from public.friend_music_follows where listener_id=auth.uid() and device_id=p_device;end if;
 end if;
 select jsonb_build_object('serverNow',stamp,'following',following,'preferences',jsonb_build_object('broadcast',coalesce((select broadcast from public.music_social_preferences where user_id=auth.uid()),true),'allowFollow',coalesce((select allow_follow from public.music_social_preferences where user_id=auth.uid()),true)),
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.display_name,p.username,'Друг'),'username',p.username,'avatarUrl',p.avatar_url,'trackId',case when a.updated_at>stamp-interval '60 seconds' and coalesce(prefs.broadcast,true) then a.track_id else null end,'canJoin',coalesce(prefs.broadcast,true) and coalesce(prefs.allow_follow,true),'playing',coalesce(coalesce(prefs.broadcast,true) and a.playing and a.updated_at>stamp-interval '60 seconds' and not exists(select 1 from public.friend_music_follows f where f.listener_id=p.id and f.last_seen>stamp-interval '60 seconds'),false),'position',case when coalesce(prefs.broadcast,true) and a.updated_at>stamp-interval '60 seconds' then a.position else 0 end,'anchoredAt',case when coalesce(prefs.broadcast,true) and a.updated_at>stamp-interval '60 seconds' then a.anchored_at else null end) order by p.username) from public.profiles p left join public.friend_music_activity a on a.user_id=p.id left join public.music_social_preferences prefs on prefs.user_id=p.id where public.music_are_friends(auth.uid(),p.id)),'[]'::jsonb),
 'listeners',coalesce((select jsonb_agg(jsonb_build_object('id',f.listener_id,'name',coalesce(p.display_name,p.username,'Друг'),'joinId',f.join_id) order by f.joined_at) from public.friend_music_follows f left join public.profiles p on p.id=f.listener_id where f.host_id=auth.uid() and f.last_seen>stamp-interval '60 seconds' and public.music_are_friends(f.listener_id,auth.uid())),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function public.friend_music_follow(p_host uuid,p_device uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.friend_music_follows;entry public.friend_music_follows;activity public.friend_music_activity; stamp timestamptz:=clock_timestamp();fresh boolean;
begin
 if auth.uid() is null or p_device is null or not public.music_are_friends(auth.uid(),p_host) then raise exception 'Можно присоединиться только к другу' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid()::text,p_host::text),0));
 perform pg_advisory_xact_lock(hashtextextended(greatest(auth.uid()::text,p_host::text),0));
 if exists(select 1 from public.music_social_preferences where user_id=p_host and (not broadcast or not allow_follow)) then raise exception 'Друг отключил совместное прослушивание' using errcode='42501';end if;
 select * into activity from public.friend_music_activity where user_id=p_host;
 if not found or not activity.playing or activity.updated_at<stamp-interval '60 seconds' or not exists(select 1 from public.music_tracks where id=activity.track_id and is_published) then raise exception 'Друг сейчас ничего не слушает';end if;
 if exists(select 1 from public.friend_music_follows where listener_id=p_host and last_seen>stamp-interval '60 seconds') then raise exception 'Друг уже слушает вместе с другим человеком';end if;
 select * into previous from public.friend_music_follows where listener_id=auth.uid() for update;
 fresh:=not found or previous.host_id<>p_host or previous.last_seen<stamp-interval '60 seconds';
 if (select count(*) from public.friend_music_follows where host_id=p_host and listener_id<>auth.uid() and last_seen>stamp-interval '60 seconds')>=20 then raise exception 'К другу уже присоединились 20 слушателей';end if;
 insert into public.friend_music_follows(listener_id,host_id,device_id,join_id,joined_at,last_seen) values(auth.uid(),p_host,p_device,case when fresh then gen_random_uuid() else previous.join_id end,case when fresh then stamp else previous.joined_at end,stamp)
 on conflict(listener_id) do update set host_id=excluded.host_id,device_id=excluded.device_id,join_id=excluded.join_id,joined_at=excluded.joined_at,last_seen=excluded.last_seen returning * into entry;
 update public.friend_music_activity set playing=false,updated_at=stamp,anchored_at=stamp where user_id=auth.uid();
 if fresh then insert into public.notifications(recipient_id,actor_id,type,payload,event_key) values(p_host,auth.uid(),'music_listener_joined',jsonb_build_object('track_id',activity.track_id),'music_join:'||entry.join_id::text) on conflict(recipient_id,type,event_key) do nothing;end if;
 return public.friend_music_state(p_device);
end $$;
create or replace function public.friend_music_leave(p_device uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Войдите в Melo' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 delete from public.friend_music_follows where listener_id=auth.uid() and device_id=p_device;
 return public.friend_music_state(p_device);
end $$;
create or replace function public.friend_music_preferences(p_broadcast boolean,p_allow_follow boolean,p_device uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_device is null then raise exception 'Войдите в Melo' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 insert into public.music_social_preferences(user_id,broadcast,allow_follow) values(auth.uid(),p_broadcast,p_allow_follow)
 on conflict(user_id) do update set broadcast=excluded.broadcast,allow_follow=excluded.allow_follow;
 if not p_broadcast then update public.friend_music_activity set playing=false,updated_at=clock_timestamp() where user_id=auth.uid();end if;
 if not p_broadcast or not p_allow_follow then delete from public.friend_music_follows where host_id=auth.uid();end if;
 return public.friend_music_state(p_device);
end $$;
revoke all on function public.friend_music_preferences(boolean,boolean,uuid) from public,anon;
grant execute on function public.friend_music_preferences(boolean,boolean,uuid) to authenticated;
revoke all on function public.friend_music_publish(uuid,bigint,uuid,boolean,double precision,boolean),public.friend_music_state(uuid),public.friend_music_follow(uuid,uuid),public.friend_music_leave(uuid) from public,anon;
grant execute on function public.friend_music_publish(uuid,bigint,uuid,boolean,double precision,boolean),public.friend_music_state(uuid),public.friend_music_follow(uuid,uuid),public.friend_music_leave(uuid) to authenticated;
do $$ declare signature text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_music_activity') then alter publication supabase_realtime add table public.friend_music_activity;end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_music_follows') then alter publication supabase_realtime add table public.friend_music_follows;end if;
 end if;
 -- Retire the previous room API without dropping any historical user data.
 foreach signature in array array['listening_room_create(text,uuid[])','listening_room_join(uuid)','listening_room_snapshot(uuid)','listening_room_command(uuid,bigint,jsonb)','listening_room_chat(uuid,text)','listening_room_leave(uuid)'] loop
  if to_regprocedure('public.'||signature) is not null then execute 'revoke execute on function public.'||signature||' from authenticated,anon,public';end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
