-- Contas fictícias usadas na planilha de exemplo (tickets_suporte_150_balanceado.xlsx).
-- Os chamados são importados com: node --env-file=.env.local scripts/importar-planilha.mjs <arquivo.xlsx>
insert into contas (nome, cota_p1, csa_responsavel) values
  ('O Condado', 2, 'CSA Sul'),
  ('Valfenda', 2, 'CSA Sudeste'),
  ('Minas Tirith', 2, 'CSA Sudeste'),
  ('Mordor', 1, 'CSA Centro-Oeste'),
  ('Conta não identificada', 1, null)
on conflict (nome) do nothing;
