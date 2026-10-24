-- Sugestão do agente de abertura para a triagem. Quem decide impacto e urgência continua sendo o suporte
-- (triar_chamado); estes campos só pré-preenchem o formulário de triagem.
alter table chamados
  add column impacto_sugerido  smallint check (impacto_sugerido between 1 and 3),
  add column urgencia_sugerida smallint check (urgencia_sugerida between 1 and 3),
  add column motivo_sugestao   text;
