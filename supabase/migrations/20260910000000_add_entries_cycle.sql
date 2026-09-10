-- A fatura de um lançamento passa a ser fixada no momento em que ele é criado,
-- em vez de recalculada pela data a cada renderização. Isso evita que compras
-- perto da virada do fechamento pulem de fatura sozinhas (o próprio banco já é
-- inconsistente nesses dias). Nula para linhas antigas: o app calcula pela data
-- como fazia antes até essas linhas serem editadas e ganharem um valor aqui.
alter table public.entries add column cycle integer;
