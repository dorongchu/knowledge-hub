-- ============================================================================
-- AI 호출 레이트리밋 (CLAUDE.md 절대 규칙 7, PRD 5장)
-- - ai_usage: Edge Function 이 Claude 를 호출할 때마다 한 행. 사용자/워크스페이스별 횟수 집계의 근거
-- - 쓰기는 Edge Function 의 service_role 만 (RLS 로 일반 사용자의 insert/update/delete 정책을 두지 않음)
-- - consume_ai_quota: "한도 확인 + 기록"을 한 트랜잭션에서 처리 (동시 요청으로 한도를 넘기지 못하게 사용자별 advisory lock)
-- ============================================================================

create table public.ai_usage (
  id            bigint      generated always as identity primary key,
  user_id       uuid        not null references auth.users(id)        on delete cascade,
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  function_name text        not null check (char_length(function_name) between 1 and 50),
  created_at    timestamptz not null default now()
);

create index ai_usage_user_created_idx      on public.ai_usage (user_id, created_at desc);
create index ai_usage_workspace_created_idx on public.ai_usage (workspace_id, created_at desc);

alter table public.ai_usage enable row level security;

-- 본인 사용 내역 조회만 허용 (남은 횟수 표시 등). insert/update/delete 정책 없음 → service_role 만 쓸 수 있다
create policy "ai_usage: user can select own rows"
  on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- 한도 확인 + 기록. 허용되면 usage 행을 만들고 그 id 를 돌려준다 (호출 실패 시 환불용).
create or replace function public.consume_ai_quota(
  p_user_id            uuid,
  p_workspace_id       uuid,
  p_function_name      text,
  p_user_per_minute    integer,
  p_user_per_day       integer,
  p_workspace_per_day  integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_minute   integer;
  v_user_day      integer;
  v_ws_day        integer;
  v_oldest_minute timestamptz;
  v_oldest_day    timestamptz;
  v_usage_id      bigint;
begin
  -- 같은 사용자의 동시 요청을 직렬화 (트랜잭션 종료 시 자동 해제)
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) filter (where created_at > now() - interval '1 minute'),
         min(created_at) filter (where created_at > now() - interval '1 minute'),
         count(*),
         min(created_at)
    into v_user_minute, v_oldest_minute, v_user_day, v_oldest_day
    from public.ai_usage
   where user_id = p_user_id
     and created_at > now() - interval '1 day';

  if v_user_minute >= p_user_per_minute then
    return jsonb_build_object(
      'allowed', false, 'reason', 'user_per_minute',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_oldest_minute + interval '1 minute' - now())))::integer));
  end if;

  if v_user_day >= p_user_per_day then
    return jsonb_build_object(
      'allowed', false, 'reason', 'user_per_day',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_oldest_day + interval '1 day' - now())))::integer));
  end if;

  select count(*), min(created_at)
    into v_ws_day, v_oldest_day
    from public.ai_usage
   where workspace_id = p_workspace_id
     and created_at > now() - interval '1 day';

  if v_ws_day >= p_workspace_per_day then
    return jsonb_build_object(
      'allowed', false, 'reason', 'workspace_per_day',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_oldest_day + interval '1 day' - now())))::integer));
  end if;

  insert into public.ai_usage (user_id, workspace_id, function_name)
  values (p_user_id, p_workspace_id, p_function_name)
  returning id into v_usage_id;

  return jsonb_build_object(
    'allowed', true,
    'usage_id', v_usage_id,
    'remaining_user_minute', p_user_per_minute - v_user_minute - 1,
    'remaining_user_day', p_user_per_day - v_user_day - 1);
end;
$$;

-- Edge Function(service_role)만 호출 가능. 일반 사용자가 직접 부르면 남의 user_id 로 기록할 수 있으므로 막는다
revoke execute on function public.consume_ai_quota(uuid, uuid, text, integer, integer, integer) from public, anon, authenticated;
grant  execute on function public.consume_ai_quota(uuid, uuid, text, integer, integer, integer) to service_role;
