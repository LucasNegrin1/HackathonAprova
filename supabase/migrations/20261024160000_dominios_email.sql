-- Domínios de e-mail de cada conta: o bot reconhece a prefeitura pelo e-mail de quem abre o chamado.
alter table contas add column dominios_email text[] not null default '{}';

-- Contas fictícias da demo.
update contas set dominios_email = array['ocondado.gov.br'] where nome = 'O Condado';
update contas set dominios_email = array['valfenda.gov.br'] where nome = 'Valfenda';
update contas set dominios_email = array['minastirith.gov.br'] where nome = 'Minas Tirith';
update contas set dominios_email = array['mordor.gov.br'] where nome = 'Mordor';
