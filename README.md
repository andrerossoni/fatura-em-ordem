# Fatura em Ordem

Organizador de fatura de cartão de crédito: lançamentos manuais, parcelamento
automático nas faturas seguintes, estornos, controle de limite e projeção dos
próximos meses.

Site estático puro — HTML, CSS e um módulo JavaScript. Sem build, sem
dependências instaladas. Os dados ficam no Supabase (Postgres), protegidos por
login e por Row Level Security.

## Rodar localmente

Módulos ES não funcionam via `file://`, então sirva a pasta:

```bash
python3 -m http.server 5173
```

Depois abra <http://localhost:5173>.

## Estrutura

| Arquivo | O que faz |
| --- | --- |
| `index.html` | Marcação: tela de acesso, painéis e diálogos |
| `styles.css` | Tokens de cor/tipografia e todo o visual, claro e escuro |
| `app.js` | Cálculo das faturas, render, acesso e leitura/escrita no Supabase |
| `config.js` | URL e chave publicável do projeto Supabase |
| `supabase/migrations/` | Schema do banco (tabelas + políticas RLS) |

A chave em `config.js` é a **publicável** — ela é feita para ficar no cliente.
Quem protege os dados é o login somado às políticas RLS: cada linha carrega o
`user_id` e só o dono a enxerga.

## Banco

Duas tabelas:

- **`entries`** — uma linha por *compra*, não por parcela. As parcelas são
  derivadas na hora de exibir, a partir da data e do número de parcelas. Isso
  mantém a edição simples: mudar uma compra ajusta todas as suas parcelas.
- **`settings`** — uma linha por usuário: nome do cartão, dias de fechamento e
  vencimento, categorias e o estado do limite.

Valores monetários são **inteiros em centavos**, para não haver erro de ponto
flutuante.

## Regras de negócio

**Ciclo da fatura.** Compra feita até o dia do fechamento entra na fatura que
fecha naquele mês; a partir do dia seguinte, vai para a próxima. Dias 29–31 são
ajustados para o último dia em meses curtos.

**Parcelamento.** O valor lançado é sempre o da *parcela*. Uma compra em N
parcelas ocupa N faturas seguidas a partir do ciclo da data.

**Limite.** Os números do app do banco (total e consumido) entram na íntegra —
eles já contemplam todos os lançamentos existentes. Só o que for lançado *depois*
da sincronização soma por cima. Ressincronize depois de pagar cada fatura.

## Backup

Ajustes → Backup exporta um JSON com tudo e reimporta depois. A importação faz
*upsert* por `id`, então reimportar o mesmo arquivo não duplica nada.
