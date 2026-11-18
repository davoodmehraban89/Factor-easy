-- Read-only preflight for ADR 0216. Run on a disposable restored database first.
-- No production mutations; aggregate output only.
BEGIN TRANSACTION READ ONLY;
SELECT organization_id, data->>'companyId' AS company_id,
       coalesce(data->>'status','missing') AS status,
       coalesce(data->>'sourceType','manual') AS source_type,
       count(*) AS vouchers,
       count(*) FILTER (WHERE nullif(btrim(data->>'attachmentNumber'),'') IS NULL) AS missing_attachment,
       count(*) FILTER (WHERE nullif(btrim(data->>'companyId'),'') IS NULL) AS missing_company
FROM public.records WHERE collection='journalVouchers'
GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;

-- Duplicate existing attachment identities, including across fiscal years.
SELECT organization_id, data->>'companyId' AS company_id,
       btrim(data->>'attachmentNumber') AS attachment_number, count(*) AS duplicates
FROM public.records WHERE collection='journalVouchers'
AND nullif(btrim(data->>'attachmentNumber'),'') IS NOT NULL
GROUP BY 1,2,3 HAVING count(*)>1;

-- Source-linked journals and missing source identity (sale/purchase only).
SELECT v.organization_id,v.data->>'companyId' AS company_id,
       v.data->>'sourceType' AS source_type,count(*) AS broken_links
FROM public.records v
WHERE v.collection='journalVouchers' AND v.data->>'sourceType' IN ('sale','purchase')
AND NOT EXISTS (
 SELECT 1 FROM public.records s WHERE s.organization_id=v.organization_id
 AND s.collection=CASE v.data->>'sourceType' WHEN 'sale' THEN 'invoices' ELSE 'purchases' END
 AND s.id=v.data->>'sourceId' AND s.data->>'companyId'=v.data->>'companyId')
GROUP BY 1,2,3;
ROLLBACK;
