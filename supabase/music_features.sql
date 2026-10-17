-- Apply after personal_music.sql. Private collection data; sharing is opt-in.
begin;
alter table public.music_playlists add column if not exists cover_path text;
alter table public.music_playlists add column if not exists is_shared boolean not null default false;
alter table public.music_playlists add column if not exists share_token uuid not null default gen_random_uuid();
do $$ begin
  if not exists(select 1 from pg_constraint where conname='music_playlist_cover_owner' and conrelid='public.music_playlists'::regclass) then
    alter table public.music_playlists add constraint music_playlist_cover_owner check(
      cover_path is null or (split_part(cover_path,'/',1)=user_id::text and cover_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$')
    );
  end if;
end $$;
create unique index if not exists music_playlist_share_token_idx on public.music_playlists(share_token);

create table if not exists public.music_saved_artists (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_id uuid not null references public.music_artists(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,artist_id)
);
create table if not exists public.music_saved_albums (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  album_id uuid not null references public.music_albums(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,album_id)
);
create table if not exists public.music_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  played_at timestamptz not null default now(), primary key(user_id,track_id)
);
create index if not exists music_history_recent_idx on public.music_history(user_id,played_at desc);
alter table public.music_saved_artists enable row level security;
alter table public.music_saved_albums enable row level security;
alter table public.music_history enable row level security;
revoke all on public.music_saved_artists,public.music_saved_albums,public.music_history from public,anon,authenticated;
grant select,insert,delete on public.music_saved_artists,public.music_saved_albums to authenticated;
grant select,delete on public.music_history to authenticated;
grant all on public.music_saved_artists,public.music_saved_albums,public.music_history to service_role;
drop policy if exists saved_artists_own on public.music_saved_artists;
create policy saved_artists_own on public.music_saved_artists for all to authenticated using(user_id=(select auth.uid())) with check(
  user_id=(select auth.uid()) and exists(select 1 from public.music_tracks t where t.artist_id=music_saved_artists.artist_id and t.is_published)
);
drop policy if exists saved_albums_own on public.music_saved_albums;
create policy saved_albums_own on public.music_saved_albums for all to authenticated using(user_id=(select auth.uid())) with check(
  user_id=(select auth.uid()) and exists(select 1 from public.music_tracks t where t.album_id=music_saved_albums.album_id and t.is_published)
);
drop policy if exists music_history_own on public.music_history;
create policy music_history_own on public.music_history for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create or replace function public.music_record_listen(p_track_id uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); stamp timestamptz;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from public.music_tracks where id=p_track_id and is_published) then
    raise exception 'Track unavailable' using errcode='22023';
  end if;
  insert into public.music_history as h(user_id,track_id,played_at) values(caller,p_track_id,statement_timestamp())
    on conflict(user_id,track_id) do update set played_at=greatest(h.played_at,excluded.played_at)
    returning played_at into stamp;
  return stamp;
end $$;
revoke all on function public.music_record_listen(uuid) from public,anon;
grant execute on function public.music_record_listen(uuid) to authenticated;

create or replace function public.music_playlist_sharing(p_playlist_id uuid,p_enabled boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.music_playlists set is_shared=p_enabled,share_token=gen_random_uuid()
    where id=p_playlist_id and user_id=auth.uid();
  if not found then raise exception 'Playlist not found' using errcode='42501'; end if;
end $$;
revoke all on function public.music_playlist_sharing(uuid,boolean) from public,anon;
grant execute on function public.music_playlist_sharing(uuid,boolean) to authenticated;

-- No public SELECT policies on personal tables. Only the requested, enabled link is exposed.
create or replace function public.music_shared_playlist(p_token uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p.id,'title',p.title,'description',p.description,'coverPath',p.cover_path,
    'trackIds',coalesce((select jsonb_agg(t.track_id order by t.position) from public.music_playlist_tracks t
      join public.music_tracks m on m.id=t.track_id and m.is_published where t.playlist_id=p.id),'[]'::jsonb))
  from public.music_playlists p where p.share_token=p_token and p.is_shared;
$$;
revoke all on function public.music_shared_playlist(uuid) from public;
grant execute on function public.music_shared_playlist(uuid) to anon,authenticated;

-- Covers stay private until their playlist is shared; signed URLs are short-lived.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('music-playlist-covers','music-playlist-covers',false,5242880,array['image/jpeg','image/png','image/webp'])
  on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.music_cover_shared(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.music_playlists where cover_path=p_path and is_shared);
$$;
revoke all on function public.music_cover_shared(text) from public;
grant execute on function public.music_cover_shared(text) to anon,authenticated;
drop policy if exists music_cover_read on storage.objects;
create policy music_cover_read on storage.objects for select to anon,authenticated using(
  bucket_id='music-playlist-covers' and ((select auth.uid())::text=split_part(name,'/',1) or public.music_cover_shared(name))
);
drop policy if exists music_cover_insert on storage.objects;
create policy music_cover_insert on storage.objects for insert to authenticated with check(
  bucket_id='music-playlist-covers' and (select auth.uid())::text=split_part(name,'/',1)
);
-- Restrictive guards also protect covers if older broad Storage policies exist.
drop policy if exists music_cover_read_guard on storage.objects;
create policy music_cover_read_guard on storage.objects as restrictive for select to anon,authenticated using(
  bucket_id<>'music-playlist-covers' or ((select auth.uid())::text=split_part(name,'/',1) or public.music_cover_shared(name))
);
drop policy if exists music_cover_insert_guard on storage.objects;
create policy music_cover_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(
  bucket_id<>'music-playlist-covers' or (select auth.uid())::text=split_part(name,'/',1)
);
drop policy if exists music_cover_update_guard on storage.objects;
create policy music_cover_update_guard on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'music-playlist-covers') with check(bucket_id<>'music-playlist-covers');
drop policy if exists music_cover_delete_guard on storage.objects;
create policy music_cover_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'music-playlist-covers');
notify pgrst,'reload schema';
commit;
