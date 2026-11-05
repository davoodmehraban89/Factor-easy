-- CLI-generated additive read prerequisite; G1 HOLD, no production activation.
-- Only a boolean completeness decision runs as definer. Every row is checked
-- through the existing record policy; no hidden row or count is returned.
CREATE FUNCTION private.finora_journal_graph_accessible(p_organization_id uuid,p_voucher_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $access$
 WITH h AS MATERIALIZED (
  SELECT r.id FROM public.records r WHERE r.organization_id=p_organization_id
   AND r.collection='journalVouchers' AND r.id=p_voucher_id AND auth.uid() IS NOT NULL
   AND private.can_access_record(r.organization_id,r.collection,r.owner_id,r.data,'read')
 ), voucher_ids AS MATERIALIZED (
  SELECT id FROM h UNION SELECT r.id FROM public.records r JOIN h ON r.data->>'sourceId'=h.id
   WHERE r.organization_id=p_organization_id AND r.collection='journalVouchers'
    AND r.data->>'sourceType'='reversal' AND r.data->>'status'='posted'
 ), lines AS MATERIALIZED (
  SELECT r.* FROM public.records r WHERE r.organization_id=p_organization_id
   AND r.collection='journalLines' AND r.data->>'voucherId' IN (SELECT id FROM voucher_ids)
 ), related AS (
  SELECT r.* FROM public.records r WHERE r.organization_id=p_organization_id AND (
   (r.collection='journalVouchers' AND r.id IN (SELECT id FROM voucher_ids))
   OR (r.collection='journalLines' AND r.id IN (SELECT id FROM lines))
   OR (r.collection='journalLineDimensions' AND (r.data->>'voucherId' IN (SELECT id FROM voucher_ids)
      OR r.data->>'journalLineId' IN (SELECT id FROM lines))))
 )
 SELECT EXISTS(SELECT FROM h) AND NOT EXISTS(SELECT FROM related r
  WHERE NOT coalesce(private.can_access_record(r.organization_id,r.collection,r.owner_id,r.data,'read'),false));
$access$;
REVOKE ALL ON FUNCTION private.finora_journal_graph_accessible(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.finora_journal_graph_accessible(uuid,text) TO authenticated;

CREATE FUNCTION public.finora_journal_read_graph(p_organization_id uuid,p_voucher_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $graph$
DECLARE graph jsonb; allowed boolean; invalid boolean;
BEGIN
 -- One statement and STABLE helpers share one snapshot. RLS applies to every
 -- returned row. Reuse materialized rows for status instead of rereading them.
 WITH h AS MATERIALIZED (
  SELECT r.* FROM public.records r WHERE r.organization_id=p_organization_id
   AND r.collection='journalVouchers' AND r.id=p_voucher_id
 ), vouchers AS MATERIALIZED (
  SELECT * FROM h UNION ALL SELECT r.* FROM public.records r JOIN h ON r.data->>'sourceId'=h.id
   WHERE r.organization_id=p_organization_id AND r.collection='journalVouchers'
    AND r.data->>'sourceType'='reversal' AND r.data->>'status'='posted' AND r.id<>h.id
 ), lines AS MATERIALIZED (
  SELECT r.* FROM public.records r WHERE r.organization_id=p_organization_id
   AND r.collection='journalLines' AND r.data->>'voucherId' IN (SELECT id FROM vouchers)
 ), dimensions AS MATERIALIZED (
  SELECT r.* FROM public.records r WHERE r.organization_id=p_organization_id
   AND r.collection='journalLineDimensions' AND (r.data->>'voucherId' IN (SELECT id FROM vouchers)
      OR r.data->>'journalLineId' IN (SELECT id FROM lines))
 ), related AS MATERIALIZED (
  SELECT * FROM vouchers UNION ALL SELECT * FROM lines UNION ALL SELECT * FROM dimensions
 ), inverse AS (
  SELECT l.data->>'reversesLineId' line_id,
   sum(greatest((l.data->>'debit')::numeric,(l.data->>'credit')::numeric)) amount
  FROM lines l JOIN vouchers v ON l.data->>'voucherId'=v.id
  WHERE v.id<>p_voucher_id GROUP BY l.data->>'reversesLineId'
 ), reversal_status AS (
  -- Same aggregate semantics as finora_journal_reversal_status, using the
  -- already selected graph. Never rewrite the original header or revision.
  SELECT CASE WHEN sum(coalesce(i.amount,0))=0 THEN 'posted'
   WHEN bool_and(coalesce(i.amount,0)=greatest((l.data->>'debit')::numeric,(l.data->>'credit')::numeric))
    THEN 'reversed' ELSE 'partially_reversed' END status
  FROM lines l LEFT JOIN inverse i ON i.line_id=l.id
  WHERE l.data->>'voucherId'=p_voucher_id HAVING count(*)>0
 )
 SELECT jsonb_build_object('organization_id',p_organization_id,'voucher_id',h.id,
   'effective_status',CASE WHEN h.data->>'status'='posted' AND coalesce(h.data->>'sourceType','')<>'reversal'
    THEN coalesce((SELECT status FROM reversal_status),h.data->>'status') ELSE h.data->>'status' END,
   'records',(SELECT jsonb_agg(jsonb_build_object('collection',r.collection,'id',r.id,'data',r.data,'version',r.version)
     ORDER BY r.collection,r.id) FROM related r WHERE
     (r.collection='journalVouchers' AND r.id=h.id)
     OR (r.collection IN ('journalLines','journalLineDimensions') AND r.data->>'voucherId'=h.id))),
  private.finora_journal_graph_accessible(p_organization_id,h.id),
  nullif(h.data->>'companyId','') IS NULL OR EXISTS(SELECT FROM related r WHERE
    r.data->>'companyId' IS DISTINCT FROM h.data->>'companyId'
    OR (r.collection='journalLineDimensions' AND NOT EXISTS(SELECT FROM lines l
       WHERE l.id=r.data->>'journalLineId' AND l.data->>'voucherId'=r.data->>'voucherId')))
 INTO graph,allowed,invalid FROM h;
 IF graph IS NULL THEN RETURN NULL; END IF;
 IF NOT coalesce(allowed,false) THEN
  RAISE EXCEPTION 'FINORA_JOURNAL_GRAPH_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF invalid THEN RAISE EXCEPTION 'FINORA_JOURNAL_GRAPH_INVALID' USING ERRCODE='23514'; END IF;
 RETURN graph;
END $graph$;
REVOKE ALL ON FUNCTION public.finora_journal_read_graph(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finora_journal_read_graph(uuid,text) TO authenticated;
