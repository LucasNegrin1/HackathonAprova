# Aprova Triagem

**Desafio:** resolver mais tickets, mais rápido, com tickets melhores desde a abertura.

Este projeto ataca **2 objetivos**, de propósito:

| Objetivo | O que a solução faz | Indicador que mexe |
|---|---|---|
| **Menos tickets** | Antes de abrir chamado, o agente busca na base de conhecimento e resolve dúvidas comuns direto no WhatsApp. | % de atendimentos resolvidos sem ticket |
| **Abertura melhor** | Quando precisa abrir, o agente segue um checklist por categoria e só abre com tudo preenchido. Cada dado coletado antes da abertura é um pedido de complemento a menos depois. | Complementos evitados por ticket · completude na abertura · % resolvidos na 1ª análise |

## Como funciona

```
WhatsApp (Meta Cloud API) ─┐
                           ├─► agente Claude ──► ferramentas (código clássico) ──► ticket completo ──► painel do suporte
Simulador web ─────────────┘     INSTRUCTIONS.md     busca · checklist · prioridade/SLA
```

- **Agente** (`lib/agent.ts`): Claude Opus 5.5 com 5 ferramentas. O prompt de sistema é o [`INSTRUCTIONS.md`](INSTRUCTIONS.md), legível e com o indicador que cada instrução mexe.
- **Código clássico decide** (`lib/tools.ts`, `lib/knowledge.ts`, `lib/priority.ts`): o agente não consegue abrir um ticket incompleto, porque `abrir_chamado` recusa. Prioridade e prazo vêm de regras, não do modelo.
- **Checklists e base** (`data/categorias.json`, `data/base-conhecimento.json`): editáveis sem tocar em código.
- **Medição** (`lib/metrics.ts`): cada campo marca em que mensagem chegou. O que não veio no primeiro relato conta como complemento evitado. O analista avalia no painel se precisou pedir complemento, o que mede a resolução na 1ª análise de verdade.

## Rodar

```bash
npm install
cp .env.example .env.local   # coloque ANTHROPIC_API_KEY
npm run dev
```

- `http://localhost:3000`: simulador de WhatsApp com os bastidores (checklist sendo preenchido ao vivo).
- `http://localhost:3000/painel`: triagem com as regras do banco e indicadores do agente.
- `http://localhost:3000/gestao`: painel gerencial PrefTech com os chamados reais.
- `http://localhost:3000/site`: exemplo de site com o bot instalado.

**Sem `ANTHROPIC_API_KEY`**, o app roda em **modo demonstração**: um roteiro fixo usa as mesmas ferramentas. É o plano B da apresentação, junto com o vídeo.

### WhatsApp de verdade

1. Crie um app na Meta for Developers com o produto WhatsApp e preencha `WHATSAPP_*` no `.env.local`.
2. Exponha o servidor (ex.: `npx vercel deploy` ou um túnel) e configure o webhook em `https://SEU_HOST/api/whatsapp` com o mesmo `WHATSAPP_VERIFY_TOKEN`.
3. Assine o campo `messages`. Textos e imagens (prints) são aceitos.

## Roteiro de demo (3 min)

1. **Munícipe:** "Paguei a taxa do alvará faz 5 dias e o processo continua aguardando pagamento". O agente sugere o artigo. Responda que não resolveu e veja o checklist preencher. Mande a foto do comprovante.
2. **Analista da prefeitura:** "A tela de análise dá erro 500 desde ontem e a equipe toda está parada". O ticket sai **urgente (4h)** pela regra de bloqueio.
3. **Munícipe:** "Esqueci minha senha", depois "sim". Resolvido sem ticket.
4. **Painel:** os indicadores mudaram. Clique em "Resolvi sem pedir complemento".

## Painel gerencial PrefTech (`/gestao`)

Painel de operações do suporte criado no projeto **PrefTech Front Engine** (React + Vite) e trazido para este app. Os componentes e o CSS são os originais. A diferença é a origem dos dados: antes eram mock (`data/mockSupportData.ts`), agora vêm do Supabase por `/api/gestao` (`lib/gestao.ts`). Se a API falhar, o painel volta para o mock e mostra um aviso.

| Painel | Supabase |
|---|---|
| Prioridade, conta, categoria, status, responsável | colunas de `chamados` |
| Parado há X dias | dias desde `ultima_movimentacao_em` |
| SLA restante | prazo da próxima ação desde a última movimentação: P1 4h, P2 8h, P3 24h, P4 72h (`SLA_HORAS` em `lib/gestao.ts`) |
| Backlog de produto / Vinculado a pai | status `backlog_produto` (sem SLA) / `vinculado` com o protocolo do pai |
| Revisão do gestor | P1 acima da cota (com justificativa) ou chamado escalado por estar parado |
| Equipe | nomes, cargos e capacidade do cadastro do painel; contagens calculadas da fila real |

```
app/gestao/
├── layout.tsx, page.tsx         # rota Next; fontes via next/font e escopo .preftech-root
├── App.tsx                      # casca do painel (ranking gerencial e filtros)
├── components/support/          # Sidebar, MetricsTopCards, PriorityTable, TeamWorkloadPanel, PendingIssuesSection
├── data/mockSupportData.ts      # tipos do painel + dados de exemplo (fallback)
├── styles/tokens.css, index.css # design system; tokens e resets escopados em .preftech-root
├── engine/, components/views/   # Front Engine (Canvas, Schema JSON, Telemetria): ainda não roteado
```

Os estilos do Vite (`:root`, `html`, `body`, `button`) foram escopados em `.preftech-root` para não alterar as outras páginas, que usam Tailwind. O **Front Engine** (`engine/` e `components/views/`) veio intacto, mas ainda não tem rota. Como no projeto original o lint era o oxlint, essas pastas estão fora do `eslint` até serem integradas.

## Bot no site

O widget de atendimento entra em qualquer site com uma linha:

```html
<script src="https://SEU_HOST/widget.js" data-conta="Valfenda" async></script>
```

- `data-conta` fixa a prefeitura do chamado. Sem ele, o bot pergunta a cidade quando for abrir chamado.
- **Ninguém se identifica para conversar.** O visitante abre o chat e escreve. O bot responde e tenta resolver pela base de conhecimento. Só se precisar abrir chamado ele segue o checklist (incluindo **impacto** e **prazo**) e, no fim, pede **nome** e **e-mail** para retorno. O e-mail é validado no código.
- O chamado entra no Supabase como `aberto`, com conta, requerente, tipo sugerido, prazo em data e sugestão de impacto × urgência para a triagem.
- Exemplo funcionando em `/site` (portal fictício da Prefeitura de Valfenda). O chat sozinho fica em `/widget`.

**Modelo:** o bot usa o primeiro provedor com chave: `XAI_API_KEY` (Grok, xAI), `GROQ_API_KEY` (Groq: `openai/gpt-oss-120b`, com `gpt-oss-20b` e `qwen3.8-27b` de reserva quando estoura o limite gratuito de 8 mil tokens/min) ou `ANTHROPIC_API_KEY` (Claude). As regras são as mesmas para todos: o `INSTRUCTIONS.md` é o prompt, e o código garante o que não pode falhar:

- só abre chamado com checklist completo e com um "sim" do usuário na última mensagem;
- "não sabe" só é aceito se o usuário disse que não sabe;
- número de processo, e-mail e CPF escritos pelo usuário entram no checklist sem depender do modelo;
- protocolo e prazo da confirmação vêm do banco, nunca do texto do modelo; texto que cita um protocolo inexistente ou sai quebrado é descartado, e no lugar o código mostra o resumo ou a próxima pergunta.

## Banco (Supabase): fluxo de triagem

A migration [`supabase/migrations/20261024120000_fluxo_triagem.sql`](supabase/migrations/20261024120000_fluxo_triagem.sql) implementa o fluxo do suporte no Postgres. As regras rodam em triggers, então valem para o app, para o agente e para SQL direto.

| Etapa do fluxo | No banco |
|---|---|
| Chamado aberto (cliente informa impacto e prazo) | `chamados.impacto_informado`, `prazo_informado`, status `aberto` |
| Sugestão ou nova parametrização → backlog de produto | `triar_chamado(id, 'sugestao' \| 'parametrizacao')` → status `backlog_produto`, view `backlog_produto` |
| Parecido com um chamado aberto → vincular ao pai | `vincular_chamado(filho, pai)`. O volume do grupo soma ao impacto (`faixas_volume`: 3+ vinculados = +1, 10+ = +2) |
| Classificar impacto e urgência (1 a 3) | `triar_chamado(id, 'problema', impacto, urgencia)` |
| Calcular prioridade impacto × urgência → P1 a P4 | trigger + tabela `matriz_prioridade` (editável) |
| Conta acima da cota de P1 | erro `COTA_P1_EXCEDIDA`. Resolve com `rebaixar_p1(outro, motivo)` ou `justificativa_p1` |
| Fila ordenada por prioridade | view `fila_atendimento` (prioridade, depois escalados, prazo do cliente e chegada) |
| Parado há mais de 10 dias | view `chamados_parados` + `escalar_parados()` (`parametros.dias_parado`) |
| Resolver fecha os vinculados em lote | `resolver_chamado(id, solucao)` |

Teste o fluxo inteiro sem precisar do Supabase: `npm run test:db` (Postgres em memória).

**No app:** quando o agente abre um chamado, ele é gravado no Supabase com status `aberto` e uma sugestão de impacto × urgência. Na aba **Triagem e fila** do `/painel`, o suporte escolhe o tipo, vincula a um chamado parecido (o painel sugere candidatos), classifica, rebaixa P1 quando a cota estoura, atende e resolve em lote.

**Dados de exemplo:** `node --env-file=.env.local scripts/importar-planilha.mjs tickets_suporte_150_balanceado.xlsx` importa os 150 chamados fictícios da planilha passando pelas regras do banco (pode rodar de novo: substitui a importação anterior). Nova parametrização e Sugestões vão ao backlog; Problema, Ajuda e Ajustes, à fila. A prioridade de 1 a 9 da planilha vira impacto × urgência (9 → P1, 6–8 → P2, 3–5 → P3, 1–2 → P4), e "Sem prioridade definida" fica aguardando triagem. A data de última movimentação é gerada, porque a planilha não tem.

Aplicar as migrations num projeto novo: `node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/*.sql supabase/seed.sql` (precisa de `SUPABASE_ACCESS_TOKEN`).

## Limitações conhecidas

- As conversas do agente e os indicadores ainda ficam em `data/db.json`. Os chamados e a triagem já estão no Supabase.
- Prazo em horas corridas, sem calendário útil.
- A linha "antes" do painel (`data/baseline.json`) traz **valores de exemplo**. Troque pelos números reais do Pylon.
- A base de conhecimento e os checklists são exemplos montados para a demo.
