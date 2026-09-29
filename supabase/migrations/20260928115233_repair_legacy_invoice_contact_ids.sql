update public.records i
set data = jsonb_set(i.data,'{contactId}',to_jsonb(c.id),true)
from public.records c
where i.collection='invoices'
  and c.collection='contacts'
  and c.owner_id=i.owner_id
  and lower(trim(c.data->>'name'))=lower(trim(i.data->>'contactName'))
  and not exists (
    select 1 from public.records x
    where x.owner_id=i.owner_id and x.collection='contacts' and x.id=i.data->>'contactId'
  );\n