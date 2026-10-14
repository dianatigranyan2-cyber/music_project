-- Melo's licensed catalogue. Run in Supabase SQL Editor as project owner.
-- This migration does not modify social tables or their policies.
begin;

create table if not exists public.music_artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  source_url text not null check (source_url like 'https://%'),
  created_at timestamptz not null default now()
);
create table if not exists public.music_albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.music_artists(id),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (length(btrim(title)) between 1 and 200),
  release_year integer check (release_year between 1900 and 2200),
  source_url text not null check (source_url like 'https://%'),
  unique (artist_id, slug),
  unique (id, artist_id)
);
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.music_artists(id),
  album_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  track_number integer check (track_number > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  genre text not null,
  audio_path text not null unique check (audio_path ~ '^[a-f0-9-]{36}\.(mp3|m4a)$'),
  audio_sha256 text not null unique check (audio_sha256 ~ '^[a-f0-9]{64}$'),
  audio_bytes bigint not null check (audio_bytes between 10000 and 52428800),
  source_id text not null,
  source_url text not null check (source_url like 'https://%'),
  license_code text not null check (license_code = 'CC-BY-4.0'),
  license_url text not null check (license_url = 'https://creativecommons.org/licenses/by/4.0/'),
  attribution text not null check (length(btrim(attribution)) > 20),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (artist_id, source_id),
  foreign key (album_id, artist_id) references public.music_albums(id, artist_id)
);
create index if not exists music_tracks_artist_idx on public.music_tracks(artist_id);
create index if not exists music_tracks_album_idx on public.music_tracks(album_id, track_number);

alter table public.music_artists enable row level security;
alter table public.music_albums enable row level security;
alter table public.music_tracks enable row level security;
revoke all on public.music_artists, public.music_albums, public.music_tracks from anon, authenticated;
grant select on public.music_artists, public.music_albums, public.music_tracks to anon, authenticated;
grant all on public.music_artists, public.music_albums, public.music_tracks to service_role;
drop policy if exists music_tracks_public_read on public.music_tracks;
create policy music_tracks_public_read on public.music_tracks for select to anon, authenticated using (is_published);
drop policy if exists music_artists_public_read on public.music_artists;
create policy music_artists_public_read on public.music_artists for select to anon, authenticated using (
  exists (select 1 from public.music_tracks t where t.artist_id = music_artists.id and t.is_published)
);
drop policy if exists music_albums_public_read on public.music_albums;
create policy music_albums_public_read on public.music_albums for select to anon, authenticated using (
  exists (select 1 from public.music_tracks t where t.album_id = music_albums.id and t.is_published)
);
-- Public GET is intentional: CC BY permits redistribution. No public upload policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music-audio', 'music-audio', true, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a'])
on conflict (id) do nothing;
-- Restrictive guards also cover projects with older, broad Storage write policies.
drop policy if exists music_audio_insert_guard on storage.objects;
create policy music_audio_insert_guard on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'music-audio');
drop policy if exists music_audio_update_guard on storage.objects;
create policy music_audio_update_guard on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id <> 'music-audio') with check (bucket_id <> 'music-audio');
drop policy if exists music_audio_delete_guard on storage.objects;
create policy music_audio_delete_guard on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id <> 'music-audio');
notify pgrst, 'reload schema';
commit;
