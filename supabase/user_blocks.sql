begin;
create table if not exists public.user_blocks(
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index if not exists user_blocks_reverse on public.user_blocks(blocked_id,blocker_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public,anon,authenticated;
grant select on public.user_blocks to authenticated;
drop policy if exists blocks_self on public.user_blocks;
create policy blocks_self on public.user_blocks for select to authenticated using(blocker_id=auth.uid());
create or replace function public.users_blocked(p_first uuid,p_second uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_blocks where (blocker_id=p_first and blocked_id=p_second) or(blocker_id=p_second and blocked_id=p_first));
$$;
revoke all on function public.users_blocked(uuid,uuid) from public,anon,authenticated;
-- Only reveal the caller's own interaction restrictions.
create or replace function public.social_blocks() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('userId',auth.uid(),'peerIds',coalesce((select jsonb_agg(case when blocker_id=auth.uid() then blocked_id else blocker_id end) from public.user_blocks where auth.uid() in(blocker_id,blocked_id)),'[]'::jsonb),'outgoing',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name)) from public.user_blocks b join public.profiles p on p.id=b.blocked_id where b.blocker_id=auth.uid()),'[]'::jsonb));
$$;
create or replace function public.set_user_block(p_peer uuid,p_blocked boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_peer is null or p_peer=auth.uid() or p_blocked is null or not exists(select 1 from public.profiles where id=p_peer) then raise exception 'Некорректный пользователь' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid()::text,p_peer::text),0));
 perform pg_advisory_xact_lock(hashtextextended(greatest(auth.uid()::text,p_peer::text),0));
 if p_blocked then
  insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),p_peer) on conflict do nothing;
  delete from public.friend_requests where (sender_id=auth.uid() and receiver_id=p_peer) or(sender_id=p_peer and receiver_id=auth.uid());
  delete from public.friend_music_follows where (listener_id=auth.uid() and host_id=p_peer) or(listener_id=p_peer and host_id=auth.uid());
 else delete from public.user_blocks where blocker_id=auth.uid() and blocked_id=p_peer;end if;
 return public.social_blocks();
end $$;
revoke all on function public.social_blocks(),public.set_user_block(uuid,boolean) from public,anon;
grant execute on function public.social_blocks(),public.set_user_block(uuid,boolean) to authenticated;
create or replace function public.guard_blocked_interaction() returns trigger language plpgsql security definer set search_path='' as $$
declare first_id uuid;second_id uuid;row_data jsonb:=to_jsonb(new);
begin
 if tg_table_name='friend_music_follows' then first_id:=(row_data->>'listener_id')::uuid;second_id:=(row_data->>'host_id')::uuid;
 else first_id:=(row_data->>'sender_id')::uuid;second_id:=(row_data->>'receiver_id')::uuid;end if;
 if tg_table_name='messages' then
  if tg_op='UPDATE' then
   if new.sender_id<>old.sender_id or new.receiver_id<>old.receiver_id or new.created_at<>old.created_at or new.story_id is distinct from old.story_id or new.is_story_reply is distinct from old.is_story_reply then raise exception 'Нельзя изменить участников или источник сообщения' using errcode='42501';end if;
   if auth.uid()=old.receiver_id and (new.content<>old.content or new.edited_at is distinct from old.edited_at) then raise exception 'Нельзя редактировать чужое сообщение' using errcode='42501';end if;
   -- Read receipts remain available for old chats, even after blocking.
   if new.content=old.content and new.edited_at is not distinct from old.edited_at then return new;end if;
  end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(least(first_id::text,second_id::text),0));
 perform pg_advisory_xact_lock(hashtextextended(greatest(first_id::text,second_id::text),0));
 if public.users_blocked(first_id,second_id) then raise exception 'Общение с пользователем недоступно' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_blocked_interaction() from public,anon,authenticated;
drop trigger if exists guard_blocked_interaction on public.messages;
create trigger guard_blocked_interaction before insert or update on public.messages for each row execute function public.guard_blocked_interaction();
drop trigger if exists guard_blocked_interaction on public.friend_requests;
create trigger guard_blocked_interaction before insert or update on public.friend_requests for each row execute function public.guard_blocked_interaction();
drop trigger if exists guard_blocked_interaction on public.friend_music_follows;
create trigger guard_blocked_interaction before insert or update on public.friend_music_follows for each row execute function public.guard_blocked_interaction();
create or replace function public.music_are_friends(p_first uuid,p_second uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() in(p_first,p_second) and p_first<>p_second and not public.users_blocked(p_first,p_second) and exists(select 1 from public.friend_requests where status='accepted' and ((sender_id=p_first and receiver_id=p_second) or(sender_id=p_second and receiver_id=p_first)));
$$;
notify pgrst,'reload schema';
commit;
