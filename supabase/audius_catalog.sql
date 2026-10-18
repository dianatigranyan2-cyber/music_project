-- Adds Audius sources to the existing catalogue. No tracks or files are deleted.
begin;
alter table public.music_tracks add column if not exists provider text not null default 'storage';
alter table public.music_tracks add column if not exists external_id text;
alter table public.music_tracks add column if not exists external_cover_url text;
alter table public.music_tracks add column if not exists external_metadata jsonb;
alter table public.music_tracks alter column audio_path drop not null;
alter table public.music_tracks alter column audio_sha256 drop not null;
alter table public.music_tracks alter column audio_bytes drop not null;

-- Keep native-file requirements and CC licences, and separately describe Audius.
alter table public.music_tracks drop constraint if exists music_tracks_license_code_check;
alter table public.music_tracks drop constraint if exists music_tracks_license_url_check;
alter table public.music_tracks drop constraint if exists music_tracks_license_pair_check;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.music_tracks'::regclass and conname='music_tracks_provider_fields_check') then
  alter table public.music_tracks add constraint music_tracks_provider_fields_check check (
   (provider='storage' and external_id is null and external_cover_url is null and external_metadata is null
    and audio_path is not null and audio_sha256 is not null and audio_bytes is not null)
   or
   (provider='audius' and external_id is not null and external_id ~ '^[a-zA-Z0-9_-]{3,64}$'
    and audio_path is null and audio_sha256 is null and audio_bytes is null and cover_path is null
    and external_metadata is not null and jsonb_typeof(external_metadata)='object'
    and octet_length(external_metadata::text)<=12000
    and (external_cover_url is null or external_cover_url like 'https://%'))
  );
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.music_tracks'::regclass and conname='music_tracks_provider_license_check') then
  alter table public.music_tracks add constraint music_tracks_provider_license_check check (
   (provider='storage' and ((license_code='CC-BY-4.0' and license_url='https://creativecommons.org/licenses/by/4.0/')
     or (license_code='CC-BY-SA-3.0' and license_url='https://creativecommons.org/licenses/by-sa/3.0/')))
   or (provider='audius' and license_code='Audius-OML' and license_url='https://audius.org/open-music-license.pdf')
  );
 end if;
end $$;
create unique index if not exists music_tracks_external_id_unique on public.music_tracks(provider,external_id) where external_id is not null;

create or replace function public.catalog_save_audius(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 existing public.music_tracks%rowtype;
 artist uuid; album uuid; song uuid;
 artist_name text:=btrim(p_data->>'artist');
 album_title text:=coalesce(btrim(p_data->>'album'),'');
 external_track text:=p_data->>'external_id';
begin
 if not public.is_music_admin() then raise exception 'Доступ запрещён' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object'
  or coalesce(length(artist_name),0) not between 1 and 200
  or coalesce(length(btrim(p_data->>'title')),0) not between 1 and 200
  or length(album_title)>200 or coalesce(length(btrim(p_data->>'genre')),0) not between 1 and 100
  or external_track is null or external_track !~ '^[a-zA-Z0-9_-]{3,64}$'
  or coalesce(p_data->>'source_url','') !~ '^https://audius\.co/[^?#]+/[^?#]+'
  or coalesce(jsonb_typeof(p_data->'is_published'),'')<>'boolean'
  or coalesce(jsonb_typeof(p_data->'external_metadata'),'')<>'object'
  or coalesce(length(p_data->>'attribution'),0) not between 21 and 3000
  then raise exception 'Проверьте сведения о треке Audius' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('music-catalog',0));
 if p_data->>'id' is not null then
  select * into existing from public.music_tracks where id=(p_data->>'id')::uuid and provider='audius' for update;
  if not found or existing.external_id<>external_track then raise exception 'Трек Audius не найден' using errcode='22023';end if;
  song:=existing.id;
 else
  select * into existing from public.music_tracks where provider='audius' and external_id=external_track;
  if found then
   return jsonb_build_object('id',existing.id,'artistId',existing.artist_id,'alreadyImported',true,'isPublished',existing.is_published);
  end if;
  song:=gen_random_uuid();
 end if;
 select id into artist from public.music_artists where lower(name)=lower(artist_name) order by created_at limit 1;
 if artist is null then
  insert into public.music_artists(name,slug,source_url) values(artist_name,'artist-'||gen_random_uuid(),p_data->>'source_url') returning id into artist;
 end if;
 if album_title<>'' then
  select id into album from public.music_albums where artist_id=artist and lower(title)=lower(album_title) limit 1;
  if album is null then
   insert into public.music_albums(artist_id,title,slug,source_url) values(artist,album_title,'album-'||gen_random_uuid(),p_data->>'source_url') returning id into album;
  end if;
 end if;
 if p_data->>'id' is null then
  insert into public.music_tracks(id,artist_id,album_id,title,duration_seconds,genre,source_id,source_url,license_code,license_url,attribution,is_published,provider,external_id,external_cover_url,external_metadata)
  values(song,artist,album,btrim(p_data->>'title'),(p_data->>'duration_seconds')::integer,btrim(p_data->>'genre'),'audius:'||external_track,p_data->>'source_url','Audius-OML','https://audius.org/open-music-license.pdf',p_data->>'attribution',(p_data->>'is_published')::boolean,'audius',external_track,p_data->>'external_cover_url',p_data->'external_metadata');
 else
  update public.music_tracks set artist_id=artist,album_id=album,title=btrim(p_data->>'title'),genre=btrim(p_data->>'genre'),
   source_url=p_data->>'source_url',duration_seconds=(p_data->>'duration_seconds')::integer,
   attribution=p_data->>'attribution',is_published=(p_data->>'is_published')::boolean,
   external_cover_url=p_data->>'external_cover_url',external_metadata=p_data->'external_metadata'
   where id=song;
 end if;
 return jsonb_build_object('id',song,'artistId',artist,'alreadyImported',false,'isPublished',(p_data->>'is_published')::boolean);
end $$;
revoke all on function public.catalog_save_audius(jsonb) from public,anon;
grant execute on function public.catalog_save_audius(jsonb) to authenticated;

-- Listening is supported; using Audius recordings in stories is a separate step.
create or replace function public.guard_audius_story_music() returns trigger
language plpgsql set search_path='' as $$ begin
 if new.music_track_id is not null and exists(select 1 from public.music_tracks where id=new.music_track_id and provider='audius') then
  raise exception 'Музыка Audius пока доступна для прослушивания, но не для историй' using errcode='22023';
 end if;
 return new;
end $$;
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='stories' and column_name='music_track_id') then
  create or replace trigger stories_guard_audius_music before insert or update of music_track_id on public.stories for each row execute function public.guard_audius_story_music();
 end if;
end $$;
notify pgrst,'reload schema';
commit;
