-- "Ajustes" (correção pontual de dados ou configuração existente) é atendido pelo suporte,
-- diferente de "nova parametrização", que vai para o backlog de produto.
alter type tipo_chamado add value if not exists 'ajuste' after 'duvida';
