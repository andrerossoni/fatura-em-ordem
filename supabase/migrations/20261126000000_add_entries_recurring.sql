-- Cobrança recorrente: o lançamento se repete todo mês, sem fim definido, a partir da
-- fatura em que foi lançado. Três colunas bastam:
--   recurring  — liga a repetição;
--   end_cycle  — último ciclo em que ela vale (ao excluir "esta e as próximas");
--   skips      — ciclos pulados (ao excluir só o mês).
-- Nulo/vazio nas linhas antigas: elas seguem como compras comuns.
alter table public.entries add column recurring boolean not null default false;
alter table public.entries add column end_cycle integer;
alter table public.entries add column skips jsonb not null default '[]'::jsonb;
