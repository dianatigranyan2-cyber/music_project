begin;
create table if not exists public.music_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
create table if not exists public.music_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 100),
  description text not null default '' check (length(description) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists music_playlists_owner_idx on public.music_playlists(user_id);
create table if not exists public.music_playlist_tracks (
  playlist_id uuid not null references public.music_playlists(id) on delete cascade,
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  position integer not null check (position >= 0),
  primary key (playlist_id, track_id),
  constraint music_playlist_track_position unique (playlist_id, position) deferrable initially deferred
);
alter table public.music_favorites enable row level security;
alter table public.music_playlists enable row level security;
alter table public.music_playlist_tracks enable row level security;
revoke all on public.music_favorites, public.music_playlists, public.music_playlist_tracks from anon, authenticated;
grant select, insert, delete on public.music_favorites to authenticated;
grant select, insert, update, delete on public.music_playlists, public.music_playlist_tracks to authenticated;
grant all on public.music_favorites, public.music_playlists, public.music_playlist_tracks to service_role;
drop policy if exists favorites_own_read on public.music_favorites;
create policy favorites_own_read on public.music_favorites for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists favorites_own_add on public.music_favorites;
create policy favorites_own_add on public.music_favorites for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.music_tracks t where t.id=track_id and t.is_published)
);
drop policy if exists favorites_own_remove on public.music_favorites;
create policy favorites_own_remove on public.music_favorites for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists playlists_own on public.music_playlists;
create policy playlists_own on public.music_playlists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists playlist_tracks_own on public.music_playlist_tracks;
create policy playlist_tracks_own on public.music_playlist_tracks for all to authenticated using (
  exists (select 1 from public.music_playlists p where p.id=playlist_id and p.user_id=(select auth.uid()))
) with check (
  exists (select 1 from public.music_playlists p where p.id=playlist_id and p.user_id=(select auth.uid()))
  and exists (select 1 from public.music_tracks t where t.id=track_id and t.is_published)
);

-- Lock the owner's playlist to make concurrent appends/reordering atomic.
create or replace function public.music_playlist_add_track(p_playlist_id uuid, p_track_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.music_playlists where id=p_playlist_id and user_id=auth.uid() for update;
  if not found then raise exception 'Playlist not found' using errcode='42501'; end if;
  insert into public.music_playlist_tracks(playlist_id,track_id,position)
    select p_playlist_id,p_track_id,coalesce(max(position)+1,0)
    from public.music_playlist_tracks where playlist_id=p_playlist_id
    on conflict (playlist_id,track_id) do nothing;
end $$;
create or replace function public.music_playlist_reorder(p_playlist_id uuid, p_track_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  perform 1 from public.music_playlists where id=p_playlist_id and user_id=auth.uid() for update;
  if not found then raise exception 'Playlist not found' using errcode='42501'; end if;
  select count(*) into n from public.music_playlist_tracks where playlist_id=p_playlist_id;
  if p_track_ids is null or cardinality(p_track_ids)<>n
     or (select count(distinct id) from unnest(p_track_ids) id)<>n
     or exists (select 1 from unnest(p_track_ids) id where not exists (
       select 1 from public.music_playlist_tracks t where t.playlist_id=p_playlist_id and t.track_id=id
     )) then raise exception 'Track list has changed; reload it' using errcode='22023'; end if;
  update public.music_playlist_tracks t set position=s.ordinality-1
  from unnest(p_track_ids) with ordinality s(id,ordinality)
  where t.playlist_id=p_playlist_id and t.track_id=s.id;
end $$;
revoke all on function public.music_playlist_add_track(uuid,uuid), public.music_playlist_reorder(uuid,uuid[]) from public, anon;
grant execute on function public.music_playlist_add_track(uuid,uuid), public.music_playlist_reorder(uuid,uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
