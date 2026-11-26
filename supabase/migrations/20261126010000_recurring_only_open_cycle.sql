-- A marcação automática de recorrente pegou a última cobrança de cada assinatura,
-- mesmo quando ela era de meses atrás — assinatura encerrada voltava a aparecer.
-- Só o que foi lançado na fatura aberta deve se repetir. Linhas em que o usuário já
-- mexeu (fim definido ou mês pulado) ficam como estão.
with cfg as (
  select user_id, closing_day from public.settings
), hoje as (
  select
    cfg.user_id,
    cfg.closing_day,
    (extract(year from current_date)::int * 12 + extract(month from current_date)::int - 1)
      + case when extract(day from current_date)::int >
                  least(cfg.closing_day,
                        extract(day from (date_trunc('month', current_date) + interval '1 month' - interval '1 day'))::int)
             then 1 else 0 end as ciclo_atual
  from cfg
)
update public.entries e
set recurring = false
from hoje
where e.user_id = hoje.user_id
  and e.recurring
  and e.category = 'Assinaturas/Streaming'
  and e.end_cycle is null
  and e.skips = '[]'::jsonb
  and coalesce(
        e.cycle,
        (extract(year from e.date)::int * 12 + extract(month from e.date)::int - 1)
          + case when extract(day from e.date)::int >
                      least(hoje.closing_day,
                            extract(day from (date_trunc('month', e.date) + interval '1 month' - interval '1 day'))::int)
                 then 1 else 0 end
      ) <> hoje.ciclo_atual;
