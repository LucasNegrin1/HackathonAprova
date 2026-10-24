# PrefTech

**Desafio:** resolver mais tickets, mais rápido, com tickets melhores desde a abertura.

O PrefTech junta duas peças:

1. **Painel gerencial de operações do suporte** (página inicial): prioridades P1–P4, SLAs vencidos e em risco, chamados parados há mais de 10 dias, carga da equipe e pendências. Lê os chamados reais do Supabase.
2. **Bot de atendimento** (botão de chat no canto do painel): o usuário escreve o problema e o bot conversa até criar um ticket completo, que entra direto na fila do painel.

| Objetivo do desafio | Como o PrefTech ataca | Indicador |
|---|---|---|
| **Menos tickets** | O bot tenta resolver pela base de conhecimento antes de abrir chamado. | atendimentos resolvidos sem ticket |
| **Abertura melhor** | O bot segue um checklist por categoria (incluindo impacto e prazo) e só abre o ticket com tudo preenchido e confirmado. | pedidos de complemento, resolução na 1ª análise |

## Rodar

```bash
npm install
cp .env.example .env.local   # Supabase + chave de um modelo (Groq, Grok ou Claude)
npm run dev
```

Abra `http://localhost:3000`. Sem chave de modelo, o bot roda em **modo demonstração** (roteiro fixo, com as mesmas regras). Sem Supabase, o painel mostra os dados de exemplo.

## Bot: roteiro do chamado

Roteiro fixo, conduzido pelo código (`lib/fluxo.ts`):

1. **Nome.**
2. **Funcionário da prefeitura ou proponente**, com botões.
3. **Prefeitura:** o funcionário escolhe numa lista vinda do Supabase; o proponente informa a cidade do processo. Com `data-conta` no widget, esta etapa é pulada.
4. **Descrição do problema**, em texto livre. Com menos de 12 palavras, o bot pede "me conte mais" uma vez e junta os dois textos.
5. O modelo lê a descrição e define o **título** e a **prioridade**. Sem modelo, valem palavras-chave (`lib/catalogo.ts`):
   - **P1 Crítico:** mexer na hora (operação parada);
   - **P2 Alto:** precisa de atenção logo;
   - **P3 Médio;**
   - **P4 Solicitação nova** no sistema.
6. **Texto sugerido:** o modelo reescreve o relato em linhas curtas (o que acontece, onde, mensagem de erro, desde quando, quem é afetado), só com o que o usuário disse, e lista até 3 informações que faltam. O usuário escolhe **Usar o texto sugerido**, **Manter o meu texto** ou **Quero completar** (acrescenta e o bot sugere de novo). O relato original fica guardado no ticket.
7. O ticket é **registrado na hora** no Supabase e passa pelas regras do banco: parecido com chamado aberto → vinculado ao pai; cota de P1 por prefeitura → revisão do gestor. O bot mostra número, título e prioridade, e o painel exibe o ticket novo na hora.

O prompt do modelo é o [`INSTRUCTIONS.md`](INSTRUCTIONS.md), com a definição de cada prioridade.

**Modelo:** usa o primeiro provedor com chave: `XAI_API_KEY` (Grok), `GROQ_API_KEY` (Groq, `openai/gpt-oss-120b`, com `gpt-oss-20b` e `qwen3.8-27b` de reserva quando estoura o limite gratuito) ou `ANTHROPIC_API_KEY` (Claude).

**Em outros sites:** o mesmo bot pode ser instalado no site de uma prefeitura com uma linha. `data-conta` fixa a conta do ticket:

```html
<script src="https://SEU_HOST/widget.js" data-conta="Valfenda" async></script>
```

## Painel gerencial

Componentes e CSS do projeto **PrefTech Front Engine** (React + Vite), trazidos para o Next.js. Os dados vêm de `/api/gestao` (`lib/gestao.ts`). Se a API falhar, o painel volta para o mock (`data/mockSupportData.ts`) e avisa.

| Painel | Supabase |
|---|---|
| Prioridade, conta, categoria, status, responsável | colunas de `chamados` |
| Parado há X dias | dias desde `ultima_movimentacao_em` |
| SLA restante | prazo da próxima ação desde a última movimentação: P1 4h, P2 8h, P3 24h, P4 72h (`SLA_HORAS` em `lib/gestao.ts`) |
| Backlog de produto / Vinculado a pai | status `backlog_produto` (sem SLA) / `vinculado` com o protocolo do pai |
| Revisão do gestor | P1 acima da cota (com justificativa) ou chamado escalado por estar parado |
| Sem prioridade (—) | chamado que veio sem prioridade definida da origem |
| Equipe | nomes, cargos e capacidade do cadastro do painel; contagens calculadas da fila real |

```
app/(preftech)/                  # página inicial (/)
├── layout.tsx, page.tsx         # fontes via next/font, escopo .preftech-root e o script do bot
├── App.tsx                      # casca do painel (ranking gerencial e filtros)
├── components/support/          # Sidebar, MetricsTopCards, PriorityTable, TeamWorkloadPanel, PendingIssuesSection
├── data/mockSupportData.ts      # tipos do painel + dados de exemplo (fallback)
├── styles/tokens.css, index.css # design system; tokens e resets escopados em .preftech-root
└── engine/, components/views/   # Front Engine (Canvas, Schema JSON, Telemetria): ainda não roteado
app/widget/                      # chat do bot (aberto pelo public/widget.js)
app/api/chat, app/api/gestao     # bot e dados do painel
```

Os estilos do Vite (`:root`, `html`, `body`, `button`) foram escopados em `.preftech-root`. O **Front Engine** veio intacto, mas ainda sem rota. Como o lint dele era o oxlint, essas pastas estão fora do `eslint`.

## Banco (Supabase): regras de triagem

As migrations em [`supabase/migrations/`](supabase/migrations/) implementam o fluxo do suporte no Postgres. As regras rodam em triggers e valem para qualquer cliente.

| Etapa | No banco |
|---|---|
| Chamado aberto (cliente informa impacto e prazo) | `chamados.impacto_informado`, `prazo_informado` |
| Sugestão ou nova parametrização → backlog | `triar_chamado(id, 'sugestao' \| 'parametrizacao')` |
| Parecido com chamado aberto → vincular ao pai | `vincular_chamado(filho, pai)`. O volume do grupo soma ao impacto (3+ vinculados = +1, 10+ = +2) |
| Impacto × urgência → P1 a P4 | trigger + tabela `matriz_prioridade` (editável) |
| Conta acima da cota de P1 | erro `COTA_P1_EXCEDIDA`, resolvido com `rebaixar_p1()` ou `justificativa_p1` |
| Fila ordenada por prioridade | view `fila_atendimento` |
| Parado há mais de 10 dias | view `chamados_parados` + `escalar_parados()` |
| Resolver fecha os vinculados em lote | `resolver_chamado(id, solucao)` |

- **Testar o fluxo sem Supabase:** `npm run test:db` (Postgres em memória).
- **Aplicar num projeto novo:** `node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/*.sql supabase/seed.sql` (precisa de `SUPABASE_ACCESS_TOKEN`).
- **Dados de exemplo:** `node --env-file=.env.local scripts/importar-planilha.mjs tickets_suporte_150_balanceado.xlsx`. Importa os 150 chamados fictícios pelas regras do banco e pode rodar de novo, porque substitui a importação anterior.

## Limitações conhecidas

- As conversas do bot ficam em `data/db.json` (memória + arquivo). Os tickets já ficam no Supabase.
- Os modelos gratuitos da Groq têm limite de 8 mil tokens por minuto e não leem imagens: um print entra como anexo, mas o bot não vê o conteúdo.
- O painel ainda não tem ações (triar, vincular, rebaixar, resolver). As funções existem no banco.
- A base de conhecimento e os checklists são exemplos montados para a demo.
