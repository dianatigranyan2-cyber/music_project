-- Apply after music_features.sql. Public profile music; personal tables keep their RLS.
begin;
alter table public.music_playlists add column if not exists show_on_profile boolean not null default false;
create or replace function public.music_public_profile(p_username text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'profile', jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'avatar_url',p.avatar_url),
    'friendCount', (select count(distinct case when f.sender_id=p.id then f.receiver_id else f.sender_id end)
      from public.friend_requests f where f.status='accepted' and (f.sender_id=p.id or f.receiver_id=p.id) and f.sender_id<>f.receiver_id),
    'favoriteIds', coalesce((select jsonb_agg(f.track_id order by f.created_at desc) from public.music_favorites f
      join public.music_tracks t on t.id=f.track_id and t.is_published where f.user_id=p.id),'[]'::jsonb),
    'playlists', coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'description',l.description,'coverPath',l.cover_path,'showOnProfile',true,
      'trackIds',coalesce((select jsonb_agg(t.track_id order by t.position) from public.music_playlist_tracks t
        join public.music_tracks m on m.id=t.track_id and m.is_published where t.playlist_id=l.id),'[]'::jsonb)) order by l.created_at desc)
      from public.music_playlists l where l.user_id=p.id and l.show_on_profile),'[]'::jsonb)
  ) from public.profiles p where lower(p.username)=lower(btrim(p_username)) order by p.id limit 1;
$$;
revoke all on function public.music_public_profile(text) from public;
grant execute on function public.music_public_profile(text) to anon,authenticated;
-- Profile visibility is independent from sharing by an unlisted link.
create or replace function public.music_cover_shared(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.music_playlists where cover_path=p_path and (is_shared or show_on_profile));
$$;
revoke all on function public.music_cover_shared(text) from public;
grant execute on function public.music_cover_shared(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
