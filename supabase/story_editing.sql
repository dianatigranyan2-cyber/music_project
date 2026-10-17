begin;
alter table public.stories add column if not exists caption text not null default '';
alter table public.stories add column if not exists music_track_id uuid references public.music_tracks(id) on delete set null;
alter table public.stories add column if not exists music_start_seconds integer not null default 0;
alter table public.stories add column if not exists music_duration_seconds integer not null default 15;
create or replace function public.validate_story_edit() returns trigger language plpgsql set search_path='' as $$
declare track_duration integer;
begin
  if length(new.caption)>300 then raise exception 'Story caption too long' using errcode='22023';end if;
  if new.media_path is null or split_part(new.media_path,'/',1)<>new.user_id::text or new.media_path ~ '(^|/)\.\.?(/|$)' then raise exception 'Invalid story media owner' using errcode='22023';end if;
  if new.music_track_id is null then new.music_start_seconds:=0;new.music_duration_seconds:=15;
  else
    select duration_seconds into track_duration from public.music_tracks where id=new.music_track_id and is_published;
    if track_duration is null or new.music_start_seconds<0 or new.music_duration_seconds not between 1 and 15 or new.music_start_seconds+new.music_duration_seconds>track_duration then raise exception 'Invalid story music fragment' using errcode='22023';end if;
  end if;
  return new;
end $$;
drop trigger if exists stories_validate_edit on public.stories;
create trigger stories_validate_edit before insert or update on public.stories for each row execute function public.validate_story_edit();
revoke update on public.stories from authenticated;
grant update(caption,music_track_id,music_start_seconds,music_duration_seconds,media_path,media_type,media_url) on public.stories to authenticated;
drop policy if exists stories_author_edit on public.stories;
create policy stories_author_edit on public.stories for update to authenticated using(user_id=(select auth.uid()) and expires_at>now()) with check(user_id=(select auth.uid()) and expires_at>now());
drop policy if exists stories_author_edit_guard on public.stories;
create policy stories_author_edit_guard on public.stories as restrictive for update to authenticated using(user_id=(select auth.uid()) and expires_at>now()) with check(user_id=(select auth.uid()) and expires_at>now());
update storage.buckets set file_size_limit=52428800,allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm'] where id='stories';
notify pgrst,'reload schema';
commit;
