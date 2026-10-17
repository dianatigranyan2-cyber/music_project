-- Apply after profile_music.sql. Existing accounts remain public until their owner changes this setting.
begin;
alter table public.profiles add column if not exists is_private boolean not null default false;

create or replace function public.can_view_profile_details(p_owner uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=p_owner and (
    not p.is_private or p.id=auth.uid() or exists(select 1 from public.friend_requests f
      where f.status='accepted' and ((f.sender_id=p.id and f.receiver_id=auth.uid()) or (f.receiver_id=p.id and f.sender_id=auth.uid())))
  ));
$$;
revoke all on function public.can_view_profile_details(uuid) from public;
grant execute on function public.can_view_profile_details(uuid) to anon,authenticated;

-- Public identity can be queried directly. Bio and other details require the checked functions below.
revoke select on public.profiles from public,anon,authenticated;
revoke select(bio,created_at) on public.profiles from public,anon,authenticated;
grant select(id,username,display_name,avatar_url,is_private) on public.profiles to anon,authenticated;
drop policy if exists profiles_owner_update_guard on public.profiles;
create policy profiles_owner_update_guard on public.profiles as restrictive for update to authenticated
  using(id=(select auth.uid())) with check(id=(select auth.uid()));

create or replace function public.account_profile()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,
    'avatar_url',p.avatar_url,'created_at',p.created_at,'is_private',p.is_private)
  from public.profiles p where p.id=auth.uid();
$$;
revoke all on function public.account_profile() from public,anon;
grant execute on function public.account_profile() to authenticated;

create or replace function public.update_account_profile(p_updates jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); key_name text;
begin
  if caller is null then raise exception 'Authentication required' using errcode='28000';end if;
  if jsonb_typeof(p_updates) is distinct from 'object' or p_updates='{}'::jsonb
    or exists(select 1 from jsonb_object_keys(p_updates) k where k not in ('username','display_name','bio','avatar_url','is_private')) then
    raise exception 'Invalid profile fields' using errcode='22023';
  end if;
  if p_updates ? 'username' and (jsonb_typeof(p_updates->'username') is distinct from 'string' or coalesce(p_updates->>'username','') !~ '^[a-zA-Z0-9_]{3,100}$') then
    raise exception 'Invalid username' using errcode='22023';end if;
  foreach key_name in array array['display_name','bio','avatar_url'] loop
    if p_updates ? key_name and jsonb_typeof(p_updates->key_name) not in ('string','null') then
      raise exception 'Invalid profile text' using errcode='22023';end if;
  end loop;
  if length(coalesce(p_updates->>'display_name',''))>50 or length(coalesce(p_updates->>'bio',''))>300 or length(coalesce(p_updates->>'avatar_url',''))>2048
    or (p_updates ? 'is_private' and jsonb_typeof(p_updates->'is_private') is distinct from 'boolean') then
    raise exception 'Invalid profile values' using errcode='22023';end if;
  update public.profiles p set
    username=case when p_updates ? 'username' then p_updates->>'username' else p.username end,
    display_name=case when p_updates ? 'display_name' then p_updates->>'display_name' else p.display_name end,
    bio=case when p_updates ? 'bio' then p_updates->>'bio' else p.bio end,
    avatar_url=case when p_updates ? 'avatar_url' then p_updates->>'avatar_url' else p.avatar_url end,
    is_private=case when p_updates ? 'is_private' then (p_updates->>'is_private')::boolean else p.is_private end
  where p.id=caller;
  if not found then raise exception 'Profile not found' using errcode='P0002';end if;
  return public.account_profile();
end $$;
revoke all on function public.update_account_profile(jsonb) from public,anon;
grant execute on function public.update_account_profile(jsonb) to authenticated;

-- Search and friends lists get the same checked description as the full profile.
create or replace function public.profile_directory()
returns table(id uuid,username text,display_name text,avatar_url text,bio text,is_private boolean)
language sql stable security definer set search_path='' as $$
  select p.id,p.username::text,p.display_name::text,p.avatar_url::text,
    case when public.can_view_profile_details(p.id) then p.bio::text else null end,p.is_private
  from public.profiles p;
$$;
revoke all on function public.profile_directory() from public;
grant execute on function public.profile_directory() to anon,authenticated;

create or replace function public.music_public_profile(p_username text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'profile',jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'avatar_url',p.avatar_url,'is_private',p.is_private,
      'bio',case when public.can_view_profile_details(p.id) then p.bio else null end),
    'canViewDetails',public.can_view_profile_details(p.id),
    'friendCount',case when public.can_view_profile_details(p.id) then (select count(distinct case when f.sender_id=p.id then f.receiver_id else f.sender_id end)
      from public.friend_requests f where f.status='accepted' and (f.sender_id=p.id or f.receiver_id=p.id) and f.sender_id<>f.receiver_id) else null end,
    'favoriteIds',case when public.can_view_profile_details(p.id) then coalesce((select jsonb_agg(f.track_id order by f.created_at desc)
      from public.music_favorites f join public.music_tracks t on t.id=f.track_id and t.is_published where f.user_id=p.id),'[]'::jsonb) else '[]'::jsonb end,
    'playlists',case when public.can_view_profile_details(p.id) then coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'description',l.description,'coverPath',l.cover_path,'showOnProfile',true,
      'trackIds',coalesce((select jsonb_agg(t.track_id order by t.position) from public.music_playlist_tracks t
        join public.music_tracks m on m.id=t.track_id and m.is_published where t.playlist_id=l.id),'[]'::jsonb)) order by l.created_at desc)
      from public.music_playlists l where l.user_id=p.id and l.show_on_profile),'[]'::jsonb) else '[]'::jsonb end
  ) from public.profiles p where lower(p.username)=lower(btrim(p_username)) order by p.id limit 1;
$$;
revoke all on function public.music_public_profile(text) from public;
grant execute on function public.music_public_profile(text) to anon,authenticated;

create or replace function public.music_cover_shared(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.music_playlists l where l.cover_path=p_path
    and (l.is_shared or (l.show_on_profile and public.can_view_profile_details(l.user_id))));
$$;
revoke all on function public.music_cover_shared(text) from public;
grant execute on function public.music_cover_shared(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
