create table if not exists public.records(
  owner_id uuid not null references public.profiles(id),
  organization_id uuid not null references public.organizations(id),
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  primary key(owner_id,collection,id)
);

insert into public.profiles(id) values
 ('11111111-1111-1111-1111-111111111111'),
 ('22222222-2222-2222-2222-222222222222')
on conflict do nothing;
insert into public.organizations(id,owner_user_id) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222')
on conflict do nothing;

insert into public.records(owner_id,organization_id,collection,id,data) values
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','requestTypes','RT_LEGACY_A',jsonb_build_object('id','RT_LEGACY_A','code','PURCHASE','title','درخواست خرید','active',true,'category','تدارکات','fields',jsonb_build_array(jsonb_build_object('key','f1','label','شرح','type','text','required',true)),'workflow',jsonb_build_object('mode','single_owner','steps','[]'::jsonb),'createdAt','2026-09-30T05:48:59.655Z')),
 ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','requestTypes','RT_LEGACY_B',jsonb_build_object('id','RT_LEGACY_B','code','LEAVE','title','درخواست مرخصی','active',true,'category','منابع انسانی','fields','[]'::jsonb,'workflow',jsonb_build_object('mode','single_owner','steps','[]'::jsonb),'createdAt','2026-09-30T06:00:00Z')),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','requests','REQ_LEGACY_A',jsonb_build_object('id','REQ_LEGACY_A','number','REQ-2026-00001','status','submitted','values',jsonb_build_object('f1','لپ‌تاپ'),'requestTypeId','RT_LEGACY_A','createdAt','2026-09-30T05:49:11.099Z','submittedAt','2026-09-30T05:49:11.099Z')),
 ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','requests','REQ_LEGACY_B',jsonb_build_object('id','REQ_LEGACY_B','number','REQ-2026-00001','status','submitted','values','{}'::jsonb,'requestTypeId','RT_LEGACY_B','createdAt','2026-09-30T06:01:00Z','submittedAt','2026-09-30T06:01:00Z'))
on conflict do nothing;
