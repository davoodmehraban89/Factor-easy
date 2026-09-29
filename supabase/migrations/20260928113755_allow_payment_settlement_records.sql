alter table public.records drop constraint if exists records_collection_check;
alter table public.records add constraint records_collection_check
check (collection = any (array[
  'companies'::text,'contacts'::text,'products'::text,'invoices'::text,
  'cheques'::text,'expenses'::text,'settings'::text,'purchases'::text,'payments'::text
]));\n