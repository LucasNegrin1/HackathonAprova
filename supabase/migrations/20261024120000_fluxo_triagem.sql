-- =============================================================================
-- Fluxo de triagem de chamados — Aprova
--
--  Chamado aberto (cliente informa impacto e prazo)
--    └─ Triagem do suporte ............................ triar_chamado()
--         ├─ Sugestão ou nova parametrização? ......... sim → backlog de produto (sai da fila)
--         ├─ Parecido com um chamado aberto? .......... sim → vincular_chamado(): vira filho do
--         │                                              chamado-pai e o volume do grupo soma ao impacto
--         └─ Classificar impacto e urgência (1 a 3)
--              └─ Calcular prioridade ................. impacto × urgência → P1 a P4 (matriz_prioridade)
--                   └─ Conta acima da cota de P1? ..... sim → rebaixar_p1() em outro P1
--                                                        ou registrar justificativa_p1
--  Fila de atendimento ordenada por prioridade ......... view fila_atendimento
--    └─ Parado há mais de 10 dias? ..................... escalar_parados() / view chamados_parados
--  Resolver o chamado .................................. resolver_chamado(): fecha os vinculados em lote
--
-- As regras ficam no banco (triggers), então valem para qualquer cliente: app, agente ou SQL direto.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type tipo_chamado as enum ('problema', 'duvida', 'sugestao', 'parametrizacao');

create type status_chamado as enum (
  'aberto',             -- aguardando triagem
  'na_fila',            -- triado, aguardando analista
  'em_atendimento',
  'aguardando_cliente',
  'vinculado',          -- duplicado de um chamado-pai; segue o pai
  'backlog_produto',    -- sugestão/parametrização: saiu da fila de suporte
  'resolvido'
);

-- A ordem do enum é a ordem da fila: P1 vem primeiro.
create type prioridade_chamado as enum ('P1', 'P2', 'P3', 'P4');

-- ---------------------------------------------------------------------------
-- Configuração (editável sem migration)
-- ---------------------------------------------------------------------------
create table parametros (
  chave text primary key,
  valor integer not null,
  descricao text not null
);

insert into parametros (chave, valor, descricao) values
  ('dias_parado', 10, 'Dias sem movimentação para o chamado ser considerado parado e escalado.');

-- Matriz impacto × urgência. Produto 9 → P1; 6 → P2; 3 ou 4 → P3; 1 ou 2 → P4.
create table matriz_prioridade (
  impacto    smallint not null check (impacto between 1 and 3),
  urgencia   smallint not null check (urgencia between 1 and 3),
  prioridade prioridade_chamado not null,
  primary key (impacto, urgencia)
);

insert into matriz_prioridade (impacto, urgencia, prioridade) values
  (3, 3, 'P1'), (3, 2, 'P2'), (2, 3, 'P2'),
  (3, 1, 'P3'), (1, 3, 'P3'), (2, 2, 'P3'),
  (2, 1, 'P4'), (1, 2, 'P4'), (1, 1, 'P4');

-- Quantos chamados vinculados elevam o impacto do chamado-pai.
create table faixas_volume (
  min_vinculados integer primary key check (min_vinculados > 0),
  bonus_impacto  smallint not null check (bonus_impacto between 1 and 2)
);

insert into faixas_volume (min_vinculados, bonus_impacto) values (3, 1), (10, 2);

-- ---------------------------------------------------------------------------
-- Contas (prefeituras/clientes) e cota de P1
-- ---------------------------------------------------------------------------
create table contas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null unique,
  cota_p1         integer not null default 2 check (cota_p1 >= 0),
  csa_responsavel text,
  criado_em       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------------
create sequence protocolo_seq;

create table chamados (
  id                     uuid primary key default gen_random_uuid(),
  protocolo              text not null unique
                         default 'APV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('protocolo_seq')::text, 5, '0'),
  conta_id               uuid not null references contas (id),

  -- Abertura: o que o cliente informa
  requerente             text,
  canal                  text not null default 'chat' check (canal in ('whatsapp', 'chat', 'pylon', 'email', 'telefone')),
  perfil                 text check (perfil in ('municipe', 'analista_prefeitura')),
  categoria              text,
  titulo                 text not null,
  descricao              text,
  campos                 jsonb not null default '{}'::jsonb,  -- checklist coletado pelo agente
  impacto_informado      text,                                -- nas palavras do cliente
  prazo_informado        date,

  -- Triagem
  tipo                   tipo_chamado,
  impacto                smallint check (impacto between 1 and 3),
  urgencia               smallint check (urgencia between 1 and 3),
  chamado_pai_id         uuid references chamados (id),
  volume_grupo           integer not null default 0,          -- chamados vinculados a este (mantido por trigger)
  impacto_efetivo        smallint,                            -- impacto + bônus de volume, limitado a 3
  prioridade_calculada   prioridade_chamado,
  prioridade_manual      prioridade_chamado,                  -- preenchida ao rebaixar um P1
  motivo_ajuste          text,
  prioridade             prioridade_chamado generated always as (coalesce(prioridade_manual, prioridade_calculada)) stored,
  justificativa_p1       text,                                -- permite P1 acima da cota

  -- Atendimento
  status                 status_chamado not null default 'aberto',
  responsavel            text,
  solucao                text,

  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  ultima_movimentacao_em timestamptz not null default now(),
  triado_em              timestamptz,
  escalado_em            timestamptz,
  resolvido_em           timestamptz,

  constraint pai_diferente check (chamado_pai_id is distinct from id),
  constraint vinculado_tem_pai check ((status = 'vinculado') = (chamado_pai_id is not null and status <> 'resolvido') or status = 'resolvido')
);

create index chamados_fila_idx on chamados (prioridade, escalado_em, prazo_informado, criado_em)
  where status in ('na_fila', 'em_atendimento', 'aguardando_cliente');
create index chamados_pai_idx on chamados (chamado_pai_id) where chamado_pai_id is not null;
create index chamados_conta_idx on chamados (conta_id, status);

create table eventos_chamado (
  id          bigint generated always as identity primary key,
  chamado_id  uuid not null references chamados (id) on delete cascade,
  tipo        text not null,
  detalhe     jsonb not null default '{}'::jsonb,
  autor       text not null default 'sistema',
  criado_em   timestamptz not null default now()
);

create index eventos_chamado_idx on eventos_chamado (chamado_id, criado_em);

-- Status que contam como "na fila de atendimento" (e para a cota de P1).
create function status_em_fila(s status_chamado) returns boolean
language sql immutable as $$
  select s in ('na_fila', 'em_atendimento', 'aguardando_cliente')
$$;

-- ---------------------------------------------------------------------------
-- Regra: impacto efetivo, prioridade e cota de P1
-- ---------------------------------------------------------------------------
create function tg_chamados_prioridade() returns trigger
language plpgsql set search_path = public as $$
declare
  v_bonus      smallint;
  v_final      prioridade_chamado;
  v_cota       integer;
  v_p1_abertos integer;
begin
  -- Volume do grupo soma ao impacto
  select coalesce(max(bonus_impacto), 0) into v_bonus
    from faixas_volume where new.volume_grupo >= min_vinculados;
  new.impacto_efetivo := case when new.impacto is null then null else least(3, new.impacto + v_bonus) end;

  -- Impacto × urgência → P1..P4
  select prioridade into new.prioridade_calculada
    from matriz_prioridade
   where impacto = new.impacto_efetivo and urgencia = new.urgencia;

  -- O rebaixamento manual só vale enquanto a prioridade calculada continuar P1.
  if new.prioridade_calculada is distinct from 'P1' then
    new.prioridade_manual := null;
  end if;

  v_final := coalesce(new.prioridade_manual, new.prioridade_calculada);

  -- Cota de P1 por conta: checada quando o chamado entra em P1 na fila.
  if v_final = 'P1' and status_em_fila(new.status) and new.justificativa_p1 is null
     and (tg_op = 'INSERT'
          or coalesce(old.prioridade_manual, old.prioridade_calculada) is distinct from 'P1'
          or not status_em_fila(old.status)) then
    select cota_p1 into v_cota from contas where id = new.conta_id;
    select count(*) into v_p1_abertos
      from chamados
     where conta_id = new.conta_id and id <> new.id
       and prioridade = 'P1' and status_em_fila(status);
    if v_p1_abertos >= v_cota then
      raise exception 'COTA_P1_EXCEDIDA'
        using detail = format('A conta já tem %s P1 abertos (cota %s).', v_p1_abertos, v_cota),
              hint   = 'Rebaixe outro P1 com rebaixar_p1() ou registre justificativa_p1 neste chamado.';
    end if;
  end if;

  new.atualizado_em := now();
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or coalesce(new.prioridade_manual, new.prioridade_calculada) is distinct from coalesce(old.prioridade_manual, old.prioridade_calculada)
     or new.responsavel is distinct from old.responsavel then
    new.ultima_movimentacao_em := now();
  end if;

  return new;
end;
$$;

create trigger chamados_prioridade
  before insert or update on chamados
  for each row execute function tg_chamados_prioridade();

-- Mantém volume_grupo do chamado-pai quando filhos entram ou saem.
create function tg_chamados_volume() returns trigger
language plpgsql set search_path = public as $$
declare
  v_pais uuid[];
begin
  v_pais := array_remove(array[
    case when tg_op <> 'INSERT' then old.chamado_pai_id end,
    case when tg_op <> 'DELETE' then new.chamado_pai_id end
  ], null);

  update chamados p
     set volume_grupo = (select count(*) from chamados f where f.chamado_pai_id = p.id and f.status = 'vinculado')
   where p.id = any (v_pais);

  return null;
end;
$$;

create trigger chamados_volume
  after insert or delete or update of chamado_pai_id, status on chamados
  for each row execute function tg_chamados_volume();

-- Interações registradas como evento também contam como movimentação.
create function tg_eventos_movimentacao() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.tipo in ('interacao', 'resposta_cliente', 'resposta_suporte') then
    update chamados set ultima_movimentacao_em = new.criado_em where id = new.chamado_id;
  end if;
  return null;
end;
$$;

create trigger eventos_movimentacao
  after insert on eventos_chamado
  for each row execute function tg_eventos_movimentacao();

-- ---------------------------------------------------------------------------
-- Ações do fluxo
-- ---------------------------------------------------------------------------

-- Parecido com um chamado aberto? → vincular ao chamado-pai.
create function vincular_chamado(
  p_filho uuid,
  p_pai uuid,
  p_justificativa_p1 text default null,
  p_autor text default 'suporte'
) returns chamados
language plpgsql set search_path = public as $$
declare
  v_raiz  chamados;
  v_filho chamados;
begin
  -- Sempre vincula à raiz do grupo (sem cadeias pai → filho → neto).
  select * into v_raiz from chamados where id = p_pai;
  if v_raiz.chamado_pai_id is not null then
    select * into v_raiz from chamados where id = v_raiz.chamado_pai_id;
  end if;
  if v_raiz.id is null then raise exception 'Chamado-pai não encontrado'; end if;
  if v_raiz.id = p_filho then raise exception 'Um chamado não pode ser vinculado a si mesmo'; end if;
  if v_raiz.status in ('resolvido', 'backlog_produto') then
    raise exception 'Chamado-pai % não está na fila (status %)', v_raiz.protocolo, v_raiz.status;
  end if;

  if p_justificativa_p1 is not null then
    update chamados set justificativa_p1 = p_justificativa_p1 where id = v_raiz.id;
  end if;

  -- Se o filho já tinha vinculados, eles passam para a raiz.
  update chamados set chamado_pai_id = v_raiz.id where chamado_pai_id = p_filho;

  update chamados
     set chamado_pai_id = v_raiz.id, status = 'vinculado', triado_em = coalesce(triado_em, now())
   where id = p_filho
  returning * into v_filho;
  if v_filho.id is null then raise exception 'Chamado % não encontrado', p_filho; end if;

  insert into eventos_chamado (chamado_id, tipo, detalhe, autor) values
    (v_filho.id, 'vinculado', jsonb_build_object('chamado_pai', v_raiz.protocolo), p_autor),
    (v_raiz.id, 'recebeu_vinculo', jsonb_build_object('chamado_filho', v_filho.protocolo), p_autor);

  return v_filho;
end;
$$;

-- Triagem do suporte: decide o caminho do chamado.
create function triar_chamado(
  p_id uuid,
  p_tipo tipo_chamado,
  p_impacto integer default null,
  p_urgencia integer default null,
  p_chamado_pai uuid default null,
  p_justificativa_p1 text default null,
  p_autor text default 'suporte'
) returns chamados
language plpgsql set search_path = public as $$
declare
  v chamados;
begin
  -- Sugestão ou nova parametrização → backlog de produto (sai da fila de suporte)
  if p_tipo in ('sugestao', 'parametrizacao') then
    update chamados set tipo = p_tipo, status = 'backlog_produto', triado_em = now()
     where id = p_id returning * into v;
    insert into eventos_chamado (chamado_id, tipo, detalhe, autor)
    values (p_id, 'enviado_backlog', jsonb_build_object('tipo', p_tipo), p_autor);
    return v;
  end if;

  -- Parecido com um chamado aberto → vincular ao pai
  if p_chamado_pai is not null then
    update chamados set tipo = p_tipo where id = p_id;
    return vincular_chamado(p_id, p_chamado_pai, p_justificativa_p1, p_autor);
  end if;

  -- Classificar impacto e urgência → prioridade calculada pelo trigger
  if p_impacto is null or p_urgencia is null then
    raise exception 'Informe impacto e urgência (1 a 3) para colocar o chamado na fila';
  end if;

  update chamados
     set tipo = p_tipo, impacto = p_impacto, urgencia = p_urgencia,
         justificativa_p1 = coalesce(p_justificativa_p1, justificativa_p1),
         status = 'na_fila', triado_em = now()
   where id = p_id
  returning * into v;
  if v.id is null then raise exception 'Chamado % não encontrado', p_id; end if;

  insert into eventos_chamado (chamado_id, tipo, detalhe, autor)
  values (p_id, 'triado', jsonb_build_object('impacto', p_impacto, 'urgencia', p_urgencia, 'prioridade', v.prioridade), p_autor);
  return v;
end;
$$;

-- Conta acima da cota → rebaixar outro P1.
create function rebaixar_p1(
  p_id uuid,
  p_motivo text,
  p_nova prioridade_chamado default 'P2',
  p_autor text default 'suporte'
) returns chamados
language plpgsql set search_path = public as $$
declare
  v chamados;
begin
  if p_nova = 'P1' then raise exception 'A nova prioridade precisa ser P2, P3 ou P4'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo do rebaixamento'; end if;

  update chamados set prioridade_manual = p_nova, motivo_ajuste = p_motivo
   where id = p_id and prioridade = 'P1'
  returning * into v;
  if v.id is null then raise exception 'Chamado % não é P1', p_id; end if;

  insert into eventos_chamado (chamado_id, tipo, detalhe, autor)
  values (p_id, 'p1_rebaixado', jsonb_build_object('para', p_nova, 'motivo', p_motivo), p_autor);
  return v;
end;
$$;

-- Resolver o chamado → fecha os vinculados em lote. Devolve quantos chamados foram fechados.
create function resolver_chamado(
  p_id uuid,
  p_solucao text,
  p_autor text default 'suporte'
) returns integer
language plpgsql set search_path = public as $$
declare
  v_pai     chamados;
  v_filhos  integer;
begin
  update chamados set status = 'resolvido', solucao = p_solucao, resolvido_em = now()
   where id = p_id and status <> 'resolvido'
  returning * into v_pai;
  if v_pai.id is null then raise exception 'Chamado % não encontrado ou já resolvido', p_id; end if;

  with fechados as (
    update chamados
       set status = 'resolvido', resolvido_em = now(),
           solucao = format('Resolvido em lote com o chamado-pai %s: %s', v_pai.protocolo, p_solucao)
     where chamado_pai_id = p_id and status = 'vinculado'
    returning id
  ), eventos as (
    insert into eventos_chamado (chamado_id, tipo, detalhe, autor)
    select id, 'resolvido_em_lote', jsonb_build_object('chamado_pai', v_pai.protocolo), p_autor from fechados
  )
  select count(*) into v_filhos from fechados;

  insert into eventos_chamado (chamado_id, tipo, detalhe, autor)
  values (p_id, 'resolvido', jsonb_build_object('vinculados_fechados', v_filhos), p_autor);

  return 1 + v_filhos;
end;
$$;

-- Parado há mais de N dias → escalar. Não muda a prioridade (não fura a cota de P1):
-- marca escalado_em, que coloca o chamado na frente dos demais da mesma prioridade, e avisa por evento.
-- Devolve quantos chamados foram escalados.
create function escalar_parados(p_autor text default 'sistema') returns integer
language plpgsql set search_path = public as $$
declare
  v_dias integer;
  v_qtd  integer;
begin
  select valor into v_dias from parametros where chave = 'dias_parado';

  with escalados as (
    update chamados
       set escalado_em = now()
     where status_em_fila(status)
       and ultima_movimentacao_em < now() - make_interval(days => v_dias)
       and (escalado_em is null or escalado_em < ultima_movimentacao_em)
    returning id, ultima_movimentacao_em
  ), eventos as (
    insert into eventos_chamado (chamado_id, tipo, detalhe, autor)
    select id, 'escalado_parado',
           jsonb_build_object('dias_parado', extract(day from now() - ultima_movimentacao_em)::int), p_autor
      from escalados
  )
  select count(*) into v_qtd from escalados;

  return v_qtd;
end;
$$;

-- ---------------------------------------------------------------------------
-- Visões
-- ---------------------------------------------------------------------------

-- Fila de atendimento ordenada por prioridade.
-- Na mesma prioridade: escalados primeiro, depois prazo informado pelo cliente, depois ordem de chegada.
create view fila_atendimento with (security_invoker = true) as
select
  row_number() over w                                          as posicao,
  c.id, c.protocolo, c.prioridade, c.titulo, c.status, c.responsavel,
  ct.nome                                                      as conta,
  c.tipo, c.impacto, c.urgencia, c.impacto_efetivo,
  c.volume_grupo,
  c.prazo_informado,
  c.escalado_em is not null and c.escalado_em >= c.ultima_movimentacao_em as escalado,
  extract(day from now() - c.ultima_movimentacao_em)::int      as dias_sem_movimentacao,
  c.justificativa_p1, c.motivo_ajuste,
  c.criado_em
from chamados c
join contas ct on ct.id = c.conta_id
where status_em_fila(c.status) and c.chamado_pai_id is null
window w as (
  order by c.prioridade nulls last,
           (c.escalado_em is not null and c.escalado_em >= c.ultima_movimentacao_em) desc,
           c.prazo_informado nulls last,
           c.criado_em
)
order by posicao;

create view chamados_parados with (security_invoker = true) as
select c.id, c.protocolo, c.prioridade, c.titulo, ct.nome as conta, c.responsavel, c.ultima_movimentacao_em,
       extract(day from now() - c.ultima_movimentacao_em)::int as dias_sem_movimentacao, c.escalado_em
from chamados c
join contas ct on ct.id = c.conta_id
where status_em_fila(c.status)
  and c.ultima_movimentacao_em < now() - make_interval(days => (select valor from parametros where chave = 'dias_parado'))
order by c.ultima_movimentacao_em;

create view uso_cota_p1 with (security_invoker = true) as
select ct.id as conta_id, ct.nome as conta, ct.cota_p1,
       count(c.id) filter (where c.prioridade = 'P1' and status_em_fila(c.status)) as p1_abertos,
       count(c.id) filter (where c.prioridade = 'P1' and status_em_fila(c.status)) >= ct.cota_p1 as cota_esgotada
from contas ct
left join chamados c on c.conta_id = ct.id
group by ct.id;

create view backlog_produto with (security_invoker = true) as
select c.id, c.protocolo, c.tipo, c.titulo, c.descricao, ct.nome as conta, c.requerente, c.triado_em
from chamados c
join contas ct on ct.id = c.conta_id
where c.status = 'backlog_produto'
order by c.triado_em;

-- ---------------------------------------------------------------------------
-- Segurança: RLS ligado e sem políticas. Só o backend (service_role) acessa.
-- Para expor ao navegador, crie políticas específicas por perfil.
-- ---------------------------------------------------------------------------
alter table parametros        enable row level security;
alter table matriz_prioridade enable row level security;
alter table faixas_volume     enable row level security;
alter table contas            enable row level security;
alter table chamados          enable row level security;
alter table eventos_chamado   enable row level security;

revoke execute on function triar_chamado, vincular_chamado, rebaixar_p1, resolver_chamado, escalar_parados
  from public, anon, authenticated;
