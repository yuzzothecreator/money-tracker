-- MoneyFlow normalized, user-isolated cloud store. Run once in Supabase SQL editor.
begin;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', settings jsonb not null default '{}', created_at timestamptz not null default now());
create table public.workspaces(user_id uuid primary key references auth.users(id) on delete cascade, version bigint not null default 0, mutation_id uuid, settings jsonb not null default '{}', updated_at timestamptz not null default now());
create table public.accounts(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 500),type text not null,opening numeric(20,0) not null default 0,currency char(3) not null default 'TZS',color text not null default '#6254e8',archived boolean not null default false,unique(id,user_id));
create table public.categories(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,parent_id uuid,unique(user_id,name),unique(id,user_id),foreign key(parent_id,user_id) references public.categories(id,user_id));
create table public.transactions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,type text not null check(type in('expense','income','transfer','refund','loan given','loan received','debt repayment','savings contribution','savings withdrawal','adjustment')),amount numeric(20,0) not null check(amount>0 and amount<=900000000000),account_id uuid not null,destination_id uuid,category text not null,party text not null default '',notes text not null default '',date date not null,status text not null check(status in('posted','pending','cancelled')),tags text not null default '',interest numeric(20,0) not null default 0 check(interest>=0 and interest<=amount),metadata jsonb not null default '{}',updated_at timestamptz not null default now(),unique(id,user_id),foreign key(account_id,user_id) references public.accounts(id,user_id),foreign key(destination_id,user_id) references public.accounts(id,user_id),check(type not in('transfer','savings contribution','savings withdrawal') or (destination_id is not null and destination_id<>account_id)));
create table public.ledger_entries(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,transaction_id uuid not null,account_id uuid not null,amount numeric(20,0) not null,currency char(3) not null,revision bigint not null,created_at timestamptz not null default now(),foreign key(account_id,user_id) references public.accounts(id,user_id));
create table public.plans(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,kind text not null check(kind in('budgets','goals','debts','recurring')),name text not null,amount numeric(20,0) not null check(amount>0),category text not null,date date not null,account_id uuid,metadata jsonb not null default '{}',foreign key(account_id,user_id) references public.accounts(id,user_id));
create table public.audit_logs(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,revision bigint not null,action text not null,created_at timestamptz not null default now());
create table public.receipts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,transaction_id uuid not null,object_path text not null,mime_type text not null check(mime_type in('image/jpeg','image/png','application/pdf')),size_bytes bigint not null check(size_bytes between 1 and 5242880),foreign key(transaction_id,user_id) references public.transactions(id,user_id));
create index transactions_user_date on public.transactions(user_id,date desc);
create index ledger_user_account on public.ledger_entries(user_id,account_id,revision);
create index plans_user_kind on public.plans(user_id,kind);
do $$ declare t text; begin foreach t in array array['profiles','workspaces','accounts','categories','transactions','ledger_entries','plans','audit_logs','receipts'] loop execute format('alter table public.%I enable row level security',t);if t='profiles' then execute format('create policy owner_read on public.%I for select to authenticated using (id=auth.uid())',t);else execute format('create policy owner_read on public.%I for select to authenticated using (user_id=auth.uid())',t);end if;execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
-- All writes go through one atomic, ownership-checked function. Direct writes are denied.
create function public.save_workspace(payload jsonb,expected_version bigint,mutation_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); current_version bigint; last_mutation uuid; a jsonb; t jsonb; p jsonb; k text; src public.accounts; dst public.accounts; n bigint;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if octet_length(payload::text)>8000000 or jsonb_typeof(payload->'accounts')<>'array' or jsonb_typeof(payload->'transactions')<>'array' or jsonb_array_length(payload->'transactions')>20000 then raise exception 'INVALID_PAYLOAD';end if;
 insert into workspaces(user_id) values(u) on conflict do nothing;
 select version,w.mutation_id into current_version,last_mutation from workspaces w where user_id=u for update;
 if last_mutation=save_workspace.mutation_id then return jsonb_build_object('version',current_version,'mutationId',last_mutation);end if;
 if current_version<>expected_version then raise exception 'VERSION_CONFLICT';end if;
 n:=current_version+1;
 -- Reject IDs already owned by another user. Composite foreign keys additionally enforce ownership.
 if exists(select 1 from accounts where id in(select (value->>'id')::uuid from jsonb_array_elements(payload->'accounts')) and user_id<>u) or exists(select 1 from transactions where id in(select (value->>'id')::uuid from jsonb_array_elements(payload->'transactions')) and user_id<>u) or exists(select 1 from plans where id in(select (value->>'id')::uuid from jsonb_array_elements(payload->'budgets') union all select (value->>'id')::uuid from jsonb_array_elements(payload->'goals') union all select (value->>'id')::uuid from jsonb_array_elements(payload->'debts') union all select (value->>'id')::uuid from jsonb_array_elements(payload->'recurring')) and user_id<>u) then raise exception 'INVALID_OWNER';end if;
 -- Append inverse movements for the previous projection, retaining an auditable correction trail.
 insert into ledger_entries(user_id,transaction_id,account_id,amount,currency,revision) select u,transaction_id,account_id,-sum(amount),currency,n from ledger_entries where user_id=u group by transaction_id,account_id,currency having sum(amount)<>0;
 delete from receipts where user_id=u and transaction_id not in(select (value->>'id')::uuid from jsonb_array_elements(payload->'transactions'));
 delete from transactions where user_id=u;
 delete from plans where user_id=u;
 for a in select value from jsonb_array_elements(payload->'accounts') loop
 if jsonb_typeof(a->'opening')<>'number' or (a->>'opening')::numeric<>trunc((a->>'opening')::numeric) or abs((a->>'opening')::numeric)>900000000000 or (a->>'currency')!~'^[A-Z]{3}$' then raise exception 'INVALID_ACCOUNT';end if;
 insert into accounts(id,user_id,name,type,opening,currency,color,archived) values((a->>'id')::uuid,u,a->>'name',a->>'type',(a->>'opening')::numeric,a->>'currency',a->>'color',coalesce((a->>'archived')::boolean,false)) on conflict(id) do update set name=excluded.name,type=excluded.type,opening=excluded.opening,currency=excluded.currency,color=excluded.color,archived=excluded.archived where accounts.user_id=u;
 end loop;
 -- Accounts with ledger history are retained if omitted; the client archives rather than deletes them.
 for t in select value from jsonb_array_elements(payload->'transactions') loop
 if jsonb_typeof(t->'amount')<>'number' or (t->>'amount')::numeric<>trunc((t->>'amount')::numeric) or coalesce((t->>'interest')::numeric,0)<>trunc(coalesce((t->>'interest')::numeric,0)) then raise exception 'INVALID_AMOUNT';end if;
 select * into strict src from accounts where id=(t->>'account')::uuid and user_id=u;
 if t->>'type' in('transfer','savings contribution','savings withdrawal') then select * into strict dst from accounts where id=(t->>'destination')::uuid and user_id=u;if src.currency<>dst.currency then raise exception 'CURRENCY_MISMATCH';end if;end if;
 insert into transactions(id,user_id,type,amount,account_id,destination_id,category,party,notes,date,status,tags,interest,metadata,updated_at) values((t->>'id')::uuid,u,t->>'type',(t->>'amount')::numeric,src.id,case when t->>'type' in('transfer','savings contribution','savings withdrawal') then dst.id else null end,t->>'category',coalesce(t->>'party',''),coalesce(t->>'notes',''),(t->>'date')::date,t->>'status',coalesce(t->>'tags',''),coalesce((t->>'interest')::numeric,0),t-'amount'-'account'-'destination'-'id', (t->>'updated')::timestamptz);
 if t->>'status'='posted' then
 insert into ledger_entries(user_id,transaction_id,account_id,amount,currency,revision) values(u,(t->>'id')::uuid,src.id,(t->>'amount')::numeric*case when t->>'type' in('income','refund','loan received','adjustment') or (t->>'type'='debt repayment' and t->>'repaymentDirection'='in') then 1 else -1 end,src.currency,n);
 if t->>'type' in('transfer','savings contribution','savings withdrawal') then insert into ledger_entries(user_id,transaction_id,account_id,amount,currency,revision) values(u,(t->>'id')::uuid,dst.id,(t->>'amount')::numeric,dst.currency,n);end if;
 end if;
 end loop;
 foreach k in array array['budgets','goals','debts','recurring'] loop for p in select value from jsonb_array_elements(payload->k) loop insert into plans(id,user_id,kind,name,amount,category,date,account_id,metadata) values((p->>'id')::uuid,u,k,p->>'name',(p->>'amount')::numeric,p->>'category',(p->>'date')::date,(p->>'account')::uuid,p-'id'-'name'-'amount'-'category'-'date'-'account');end loop;end loop;
 delete from categories where user_id=u;
 insert into categories(user_id,name) select u,value#>>'{}' from jsonb_array_elements(payload->'categories');
 update workspaces set version=n,mutation_id=save_workspace.mutation_id,settings=jsonb_build_object('audit',payload->'audit'),updated_at=now() where user_id=u;
 insert into audit_logs(user_id,revision,action) values(u,n,'Workspace synchronized atomically');
 return jsonb_build_object('version',n,'mutationId',save_workspace.mutation_id);
end $$;
create function public.read_workspace() returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); result jsonb; k text;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 select jsonb_build_object('version',version,'mutationId',mutation_id,'data',jsonb_build_object('audit',coalesce(settings->'audit','[]'::jsonb))) into result from workspaces where user_id=u;
 if result is null then return jsonb_build_object('version',0,'data',null);end if;
 result:=jsonb_set(result,'{data,accounts}',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'type',type,'opening',opening,'currency',trim(currency),'color',color,'archived',archived)) from accounts where user_id=u),'[]'::jsonb));
 result:=jsonb_set(result,'{data,transactions}',coalesce((select jsonb_agg(metadata||jsonb_build_object('id',id,'type',type,'amount',amount,'account',account_id,'destination',destination_id,'category',category,'party',party,'notes',notes,'date',date,'status',status,'tags',tags,'interest',interest,'updated',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) from transactions where user_id=u),'[]'::jsonb));
 -- Remove null destination fields to preserve the client schema.
 result:=jsonb_set(result,'{data,transactions}',coalesce((select jsonb_agg(jsonb_strip_nulls(value)) from jsonb_array_elements(result#>'{data,transactions}')),'[]'::jsonb));
 foreach k in array array['budgets','goals','debts','recurring'] loop result:=jsonb_set(result,array['data',k],coalesce((select jsonb_agg(jsonb_strip_nulls(metadata||jsonb_build_object('id',id,'name',name,'amount',amount,'category',category,'date',date,'account',account_id))) from plans where user_id=u and kind=k),'[]'::jsonb));end loop;
 result:=jsonb_set(result,'{data,categories}',coalesce((select jsonb_agg(name) from categories where user_id=u),'[]'::jsonb));
 return result;
end $$;
revoke all on function public.save_workspace(jsonb,bigint,uuid),public.read_workspace() from public,anon;
grant execute on function public.save_workspace(jsonb,bigint,uuid),public.read_workspace() to authenticated;
commit;
