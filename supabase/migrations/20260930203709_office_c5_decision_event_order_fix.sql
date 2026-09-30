create or replace function private.office_act_on_approval_impl(
 p_organization_id uuid,p_approval_id text,p_action text,p_note text
) returns text language plpgsql security definer set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid()); v_req public.records%rowtype; v_source public.records%rowtype; v_member_id uuid;
 v_event_id text; v_event text; v_current_digest text; v_aal text:=coalesce((select auth.jwt()->>'aal'),'aal1');
begin
 if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_action not in ('approved','rejected') then raise exception 'invalid approval action' using errcode='22023'; end if;
 if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
 then raise exception 'office automation entitlement required' using errcode='42501'; end if;
 select * into v_req from public.records r
  where r.organization_id=p_organization_id and r.collection='correspondenceAudit'
    and r.data->>'event'='approval_requested' and r.data->>'approvalId'=p_approval_id
  order by nullif(r.data->>'at','')::timestamptz desc limit 1;
 if not found then raise exception 'approval request not found' using errcode='42501'; end if;
 if v_req.data->>'approverUserId' is distinct from v_uid::text
 then raise exception 'only assigned approver may decide' using errcode='42501'; end if;
 begin v_member_id:=(v_req.data->>'approverMemberId')::uuid;
 exception when others then raise exception 'invalid approver member' using errcode='42501'; end;
 if not exists(select 1 from public.organization_members m
   where m.id=v_member_id and m.organization_id=p_organization_id and m.user_id=v_uid and m.status='active')
 then raise exception 'approver membership inactive' using errcode='42501'; end if;
 select * into v_source from public.records r
  where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=v_req.data->>'correspondenceId';
 if not found
    or not private.member_can_access_record(v_member_id,'office_automation',v_source.owner_id,v_source.data,'approve')
    or not private.member_can_access_record(v_member_id,'office_automation',v_source.owner_id,v_source.data,'read')
 then raise exception 'approver no longer authorized' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':office-approval:'||p_approval_id,0));
 if exists(select 1 from public.records a
   where a.organization_id=p_organization_id and a.collection='correspondenceAudit'
     and a.data->>'approvalId'=p_approval_id and a.data->>'event' in ('approval_approved','approval_rejected'))
 then raise exception 'approval already decided' using errcode='22023'; end if;
 v_current_digest:=private.office_correspondence_digest(v_source.data);
 if v_current_digest is distinct from v_req.data->>'contentDigest'
 then raise exception 'approval content changed; create a new approval request' using errcode='40001'; end if;
 v_event:=case when p_action='approved' then 'approval_approved' else 'approval_rejected' end;
 v_event_id:='APE_'||replace(gen_random_uuid()::text,'-','');
 insert into public.records(organization_id,owner_id,collection,id,data)
 values(p_organization_id,v_uid,'correspondenceAudit',v_event_id,
   jsonb_build_object('event',v_event,'approvalId',p_approval_id,'correspondenceId',v_req.data->>'correspondenceId',
    'actorUserId',v_uid,'contentDigest',v_current_digest,'note',coalesce(p_note,''),'aal',v_aal,'at',clock_timestamp(),
    'attestationType','internal_approval','qualifiedDigitalSignature',false));
 return v_event_id;
end $$;
revoke all on function private.office_act_on_approval_impl(uuid,text,text,text) from public,anon;
grant execute on function private.office_act_on_approval_impl(uuid,text,text,text) to authenticated;
