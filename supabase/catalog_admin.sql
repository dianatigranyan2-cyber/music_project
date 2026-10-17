-- Catalog permissions only; no access to users, private profiles or messages.
begin;
create table if not exists public.music_catalog_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.music_catalog_admins enable row level security;
revoke all on public.music_catalog_admins from public,anon,authenticated;
grant select on public.music_catalog_admins to authenticated;
drop policy if exists catalog_admin_self on public.music_catalog_admins;
create policy catalog_admin_self on public.music_catalog_admins for select to authenticated using(user_id=auth.uid());
create or replace function public.is_music_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.music_catalog_admins where user_id=auth.uid());
$$;
revoke all on function public.is_music_admin() from public;
grant execute on function public.is_music_admin() to anon,authenticated;
do $$ declare account uuid; begin
 if (select count(*) from public.profiles where lower(username)=lower('UserZero_Diana'))<>1 then raise exception 'Expected exactly one UserZero_Diana account';end if;
 select id into account from public.profiles where lower(username)=lower('UserZero_Diana');
 -- Re-running cannot silently grant an additional catalog administrator.
 delete from public.music_catalog_admins where user_id<>account;
 insert into public.music_catalog_admins values(account) on conflict do nothing;
end $$;
alter table public.music_tracks add column if not exists cover_path text check(cover_path ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$');
grant insert,update on public.music_artists,public.music_albums,public.music_tracks to authenticated;
do $$ declare tab text; begin
 foreach tab in array array['music_artists','music_albums','music_tracks'] loop
 execute format('drop policy if exists catalog_admin_read on public.%I',tab);
 execute format('create policy catalog_admin_read on public.%I for select to authenticated using(public.is_music_admin())',tab);
 execute format('drop policy if exists catalog_admin_insert on public.%I',tab);
 execute format('create policy catalog_admin_insert on public.%I for insert to authenticated with check(public.is_music_admin())',tab);
 execute format('drop policy if exists catalog_admin_update on public.%I',tab);
 execute format('create policy catalog_admin_update on public.%I for update to authenticated using(public.is_music_admin()) with check(public.is_music_admin())',tab);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('music-covers','music-covers',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists music_audio_insert_guard on storage.objects;
create policy music_audio_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id not in ('music-audio','music-covers') or public.is_music_admin());
drop policy if exists music_audio_update_guard on storage.objects;
create policy music_audio_update_guard on storage.objects as restrictive for update to anon,authenticated using(bucket_id not in ('music-audio','music-covers') or public.is_music_admin()) with check(bucket_id not in ('music-audio','music-covers') or public.is_music_admin());
drop policy if exists music_audio_delete_guard on storage.objects;
create policy music_audio_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id not in ('music-audio','music-covers') or public.is_music_admin());
drop policy if exists catalog_storage_admin on storage.objects;
create policy catalog_storage_admin on storage.objects for all to authenticated using(bucket_id in ('music-audio','music-covers') and public.is_music_admin()) with check(bucket_id in ('music-audio','music-covers') and public.is_music_admin());

create or replace function public.catalog_save_track(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare artist uuid; album uuid; song uuid; artist_name text:=btrim(p_data->>'artist');album_title text:=btrim(p_data->>'album');
begin
 if not public.is_music_admin() then raise exception 'Доступ запрещён' using errcode='42501';end if;
 if p_data->>'id' is not null then
  song:=(p_data->>'id')::uuid;
  if not exists(select 1 from public.music_tracks where id=song) then raise exception 'Песня не найдена';end if;
 else song:=gen_random_uuid();end if;
 if length(artist_name) not between 1 and 200 then raise exception 'Укажите исполнителя';end if;
 perform pg_advisory_xact_lock(hashtextextended('music-catalog',0));
 select id into artist from public.music_artists where lower(name)=lower(artist_name) order by created_at limit 1;
 if artist is null then insert into public.music_artists(name,slug,source_url) values(artist_name,'artist-'||gen_random_uuid(),p_data->>'source_url') returning id into artist;end if;
 if album_title<>'' then
  select id into album from public.music_albums where artist_id=artist and lower(title)=lower(album_title) limit 1;
  if album is null then insert into public.music_albums(artist_id,title,slug,source_url) values(artist,album_title,'album-'||gen_random_uuid(),p_data->>'source_url') returning id into album;end if;
 end if;
 if p_data->>'id' is null then
  insert into public.music_tracks(id,artist_id,album_id,title,duration_seconds,genre,audio_path,audio_sha256,audio_bytes,source_id,source_url,license_code,license_url,attribution,is_published,cover_path)
  values(song,artist,album,btrim(p_data->>'title'),(p_data->>'duration_seconds')::integer,btrim(p_data->>'genre'),p_data->>'audio_path',p_data->>'audio_sha256',(p_data->>'audio_bytes')::bigint,song::text,p_data->>'source_url',p_data->>'license_code',p_data->>'license_url',btrim(p_data->>'attribution'),(p_data->>'is_published')::boolean,p_data->>'cover_path');
 else
  update public.music_tracks set artist_id=artist,album_id=album,title=btrim(p_data->>'title'),genre=btrim(p_data->>'genre'),source_url=p_data->>'source_url',license_code=p_data->>'license_code',license_url=p_data->>'license_url',attribution=btrim(p_data->>'attribution'),is_published=(p_data->>'is_published')::boolean,cover_path=case when p_data ? 'cover_path' then p_data->>'cover_path' else cover_path end where id=song;
 end if;
 return song;
end $$;
revoke all on function public.catalog_save_track(jsonb) from public,anon;
grant execute on function public.catalog_save_track(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
