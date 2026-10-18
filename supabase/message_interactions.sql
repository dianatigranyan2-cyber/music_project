begin;
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists is_message_reply boolean not null default false;
create index if not exists messages_reply_to_idx on public.messages(reply_to_id) where reply_to_id is not null;
create or replace function public.guard_message_reply() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent public.messages%rowtype;
begin
 if tg_op='UPDATE' then
  if new.is_message_reply is distinct from old.is_message_reply or
   (new.reply_to_id is distinct from old.reply_to_id and not
    (new.reply_to_id is null and not exists(select 1 from public.messages where id=old.reply_to_id)))
   then raise exception 'Нельзя изменить адресата ответа' using errcode='42501';end if;
  return new;
 end if;
 new.is_message_reply:=new.reply_to_id is not null;
 if new.reply_to_id is null then return new;end if;
 select * into parent from public.messages where id=new.reply_to_id for key share;
 if not found or new.reply_to_id=new.id or not
  ((parent.sender_id=new.sender_id and parent.receiver_id=new.receiver_id) or
   (parent.sender_id=new.receiver_id and parent.receiver_id=new.sender_id))
  then raise exception 'Сообщение для ответа недоступно' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_message_reply() from public,anon,authenticated;
create or replace trigger messages_guard_reply before insert or update on public.messages for each row execute function public.guard_message_reply();

create table if not exists public.message_reactions(
 message_id uuid not null references public.messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text check(emoji in('❤️','👍','😂','🔥','😮','😢','👏','🎵')),
 primary key(message_id,user_id)
);
alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from public,anon,authenticated;
grant select on public.message_reactions to authenticated;
drop policy if exists message_reactions_participants on public.message_reactions;
create policy message_reactions_participants on public.message_reactions for select to authenticated using(
 exists(select 1 from public.messages m where m.id=message_id and auth.uid() in(m.sender_id,m.receiver_id))
);
create or replace function public.set_message_reaction(p_message_id uuid,p_emoji text) returns public.message_reactions
language plpgsql security definer set search_path='' as $$
declare message public.messages%rowtype;result public.message_reactions%rowtype;
begin
 if auth.uid() is null or (p_emoji is not null and p_emoji not in('❤️','👍','😂','🔥','😮','😢','👏','🎵'))
  then raise exception 'Недопустимая реакция' using errcode='42501';end if;
 select * into message from public.messages where id=p_message_id for key share;
 if not found or auth.uid() not in(message.sender_id,message.receiver_id)
  then raise exception 'Сообщение недоступно' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(message.sender_id::text,message.receiver_id::text),0));
 perform pg_advisory_xact_lock(hashtextextended(greatest(message.sender_id::text,message.receiver_id::text),0));
 if public.users_blocked(message.sender_id,message.receiver_id) then raise exception 'Общение недоступно' using errcode='42501';end if;
 insert into public.message_reactions(message_id,user_id,emoji) values(p_message_id,auth.uid(),p_emoji)
 on conflict(message_id,user_id) do update set emoji=excluded.emoji returning * into result;
 return result;
end $$;
revoke all on function public.set_message_reaction(uuid,text) from public,anon;
grant execute on function public.set_message_reaction(uuid,text) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_reactions')
 then alter publication supabase_realtime add table public.message_reactions;end if;
end $$;
notify pgrst,'reload schema';
commit;
