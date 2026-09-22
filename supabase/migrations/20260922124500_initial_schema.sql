create extension if not exists "pgcrypto";

create type public.message_type as enum ('text', 'gif', 'sticker');
create type public.moderation_status as enum ('normal', 'flagged', 'under_review', 'removed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 32),
  avatar text not null default 'A',
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  icon text not null default '🌎',
  category text not null default 'General',
  language text not null default 'English',
  region text not null default 'Global',
  is_public boolean not null default true,
  rules text[] not null default array['Be respectful and curious', 'No spam or harassment', 'Keep it safe for everyone'],
  member_count integer not null default 0 check (member_count >= 0),
  online_count integer not null default 0 check (online_count >= 0),
  created_at timestamptz not null default now()
);

create table public.anonymous_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 40),
  avatar text not null default '✦',
  created_at timestamptz not null default now(),
  unique (user_id, group_id)
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  anonymous_identity_id uuid not null references public.anonymous_identities(id) on delete restrict,
  type public.message_type not null,
  text text check (type <> 'text' or (text is not null and char_length(text) between 1 and 4000)),
  gif_provider text check (type <> 'gif' or gif_provider is not null),
  gif_id text,
  gif_url text check (type <> 'gif' or gif_url is not null),
  sticker_id uuid,
  moderation_status public.moderation_status not null default 'normal',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_payload_check check (
    (type = 'text' and text is not null and gif_url is null and sticker_id is null)
    or (type = 'gif' and gif_url is not null and text is null and sticker_id is null)
    or (type = 'sticker' and sticker_id is not null and text is null and gif_url is null)
  )
);

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (char_length(reaction) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  description text check (char_length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'investigating', 'resolved', 'rejected')),
  created_at timestamptz not null default now()
);

create index messages_group_created_idx on public.messages (group_id, created_at desc);
create index groups_discovery_idx on public.groups (is_public, member_count desc, created_at desc);
create index reports_status_idx on public.reports (status, created_at desc);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.anonymous_identities enable row level security;
alter table public.group_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "Public groups are discoverable" on public.groups for select using (is_public or owner_id = auth.uid());
create policy "Authenticated users create groups" on public.groups for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners update groups" on public.groups for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Users read their own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users create their own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Members can read memberships" on public.group_members for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.groups where id = group_id and is_public));
create policy "Users join groups as themselves" on public.group_members for insert to authenticated with check (user_id = auth.uid());
create policy "Users leave groups as themselves" on public.group_members for delete to authenticated using (user_id = auth.uid());
create policy "Members read messages without private identity fields" on public.messages for select to authenticated using (
  exists (select 1 from public.group_members where group_id = messages.group_id and user_id = auth.uid())
  and not exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = messages.user_id)
);
create policy "Members send their own messages" on public.messages for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.group_members where group_id = messages.group_id and user_id = auth.uid())
  and exists (select 1 from public.anonymous_identities where id = anonymous_identity_id and user_id = auth.uid() and group_id = messages.group_id)
);
create policy "Users manage their reactions" on public.message_reactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their own blocks" on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "Users create reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

create or replace view public.public_messages
with (security_invoker = false)
as
select
  m.id, m.group_id, ai.display_name as anonymous_display_name, ai.avatar as anonymous_avatar,
  m.type, case when m.type = 'text' then m.text else null end as text,
  case when m.type = 'gif' then m.gif_url else null end as gif_url,
  case when m.type = 'sticker' then m.sticker_id else null end as sticker_id,
  m.created_at,
  coalesce((select jsonb_object_agg(reaction, count) from (
    select reaction, count(*)::integer as count from public.message_reactions mr where mr.message_id = m.id group by reaction
  ) reaction_counts), '{}'::jsonb) as reactions
from public.messages m
join public.anonymous_identities ai on ai.id = m.anonymous_identity_id
join public.groups g on g.id = m.group_id
where m.deleted_at is null
  and m.moderation_status = 'normal'
  and (g.is_public or exists (
    select 1 from public.group_members gm
    where gm.group_id = m.group_id and gm.user_id = auth.uid()
  ));

grant select on public.public_messages to anon, authenticated;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
