
-- Remove duplicate C7 API surface created by an abandoned concurrent branch.
-- Canonical C7 on main uses office_record_ocr_evidence / office_correct_ocr_evidence / office_archive_search_v2.
drop function if exists public.office_archive_full_text_search(uuid,text,text,text,text);
drop function if exists private.office_archive_full_text_search_impl(uuid,text,text,text,text);
drop function if exists public.office_latest_ocr_text(uuid,text);
drop function if exists private.office_latest_ocr_text_impl(uuid,text);
drop function if exists public.office_record_ocr_text(uuid,text,text,text,text,text,text,numeric);
drop function if exists private.office_record_ocr_text_impl(uuid,text,text,text,text,text,text,numeric);
