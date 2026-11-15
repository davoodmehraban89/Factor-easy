-- Read-only API removal; all financial records and prior APIs remain unchanged.
DROP FUNCTION public.finora_journal_read_graph(uuid,text);
DROP FUNCTION private.finora_journal_graph_accessible(uuid,text);
