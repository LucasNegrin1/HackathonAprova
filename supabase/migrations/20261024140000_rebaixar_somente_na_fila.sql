-- Rebaixar P1 só vale para chamados na fila de atendimento (não para resolvidos, vinculados ou backlog).
create or replace function rebaixar_p1(
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
   where id = p_id and prioridade = 'P1' and status_em_fila(status)
  returning * into v;
  if v.id is null then raise exception 'Chamado % não é um P1 na fila de atendimento', p_id; end if;

  insert into eventos_chamado (chamado_id, tipo, detalhe, autor)
  values (p_id, 'p1_rebaixado', jsonb_build_object('para', p_nova, 'motivo', p_motivo), p_autor);
  return v;
end;
$$;

revoke execute on function rebaixar_p1 from public, anon, authenticated;
