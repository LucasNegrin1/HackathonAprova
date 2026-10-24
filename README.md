# PrefTech

**Desafio:** resolver mais tickets, mais rápido, com tickets melhores desde a abertura.

O PrefTech junta duas peças:

1. **Painel gerencial de operações do suporte** (página inicial): prioridades P1–P4, SLAs vencidos e em risco, chamados parados há mais de 10 dias, carga da equipe e pendências. Lê os chamados reais do Supabase.
2. **Bot de atendimento** (botão de chat no canto do painel): o usuário escreve o problema e o bot conversa até criar um ticket completo, que entra direto na fila do painel.

| Objetivo do desafio | Como o PrefTech ataca | Indicador |
|---|---|---|
| **Menos tickets** | O bot tenta resolver pela base de conhecimento antes de abrir chamado. | atendimentos resolvidos sem ticket |
| **Abertura melhor** | O bot segue um checklist por categoria (incluindo impacto e prazo) e só abre o ticket com tudo preenchido e confirmado. | pedidos de complemento, resolução na 1ª análise |

## Como rodar (passo a passo)

### 1. Pré-requisitos

- **Node.js 20.9 ou mais novo** (testado no Node 24): https://nodejs.org
- **Git**

### 2. Baixar e instalar

```bash
git clone https://github.com/LucasNegrin1/HackathonAprova.git
cd HackathonAprova
npm install
```

### 3. Escolher o modo

**Modo A, demonstração (sem nenhuma conta):** pule para o passo 6. O painel mostra chamados de exemplo, e o bot faz o roteiro completo com regras por palavras-chave. Os tickets recebem um protocolo, mas não aparecem no painel, porque não há banco.

**Modo B, completo (recomendado):** faça os passos 4 e 5. São duas contas gratuitas: Supabase (banco) e Groq (IA do bot).

### 4. Chave da IA (Groq, gratuita)

1. Crie uma conta em https://console.groq.com e gere uma chave em **API Keys**.
2. Copie o arquivo de configuração: `cp .env.example .env.local` (no Windows: `copy .env.example .env.local`).
3. Cole a chave em `GROQ_API_KEY` no `.env.local`.

Sem essa chave, o bot também funciona, mas define título e prioridade por palavras-chave e não sugere o texto melhorado.

### 5. Banco (Supabase, gratuito)

1. Crie um projeto em https://supabase.com/dashboard.
2. No `.env.local`, preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`: em **Project Settings > Data API** (ex.: `https://xxxx.supabase.co`);
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`: em **Project Settings > API Keys**;
   - `SUPABASE_ACCESS_TOKEN`: crie em https://supabase.com/dashboard/account/tokens.
3. Crie as tabelas, as regras e as prefeituras de exemplo:

```bash
node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/20261024120000_fluxo_triagem.sql supabase/migrations/20261024130000_sugestao_agente.sql supabase/migrations/20261024140000_rebaixar_somente_na_fila.sql supabase/migrations/20261024150000_tipo_ajuste.sql supabase/migrations/20261024160000_dominios_email.sql supabase/seed.sql
```

   Cada arquivo deve responder `OK`. Alternativa sem token: abra o **SQL Editor** do Supabase e rode cada arquivo de `supabase/migrations/`, na ordem do nome, e depois `supabase/seed.sql`.

4. (Opcional) Para o painel começar com 150 chamados fictícios, importe a planilha de exemplo:

```bash
node --env-file=.env.local scripts/importar-planilha.mjs tickets_suporte_150_balanceado.xlsx
```

### 6. Rodar

```bash
npm run dev
```

Abra **http://localhost:3000**.

### 7. O que testar

1. **Painel:** cards de P1, SLA vencido e parados; clique numa linha para ver os detalhes; **Matriz & Regras de SLA** muda os limites.
2. **Bot:** clique no botão verde no canto inferior direito e siga o roteiro (nome → funcionário ou proponente → prefeitura → descrição). Exemplo de descrição: *"O sistema de análise de processos está fora do ar desde as 9h e nenhum servidor consegue trabalhar"*. Escolha **Usar o texto sugerido**.
3. **Resultado:** o bot mostra número, título e prioridade (P1 nesse exemplo), e o painel filtra direto no ticket novo, com o selo **Novo**.

### Comandos úteis

| Comando | Para quê |
|---|---|
| `npm run dev` | Rodar em desenvolvimento |
| `npm run build` e `npm start` | Rodar a versão de produção |
| `npm run test:db` | Testar as regras do banco num Postgres em memória (não precisa de Supabase) |
| `npm run lint` | Verificar o código |

### Problemas comuns

- **"Porta 3000 em uso":** já há outro servidor rodando. Feche-o ou use o endereço que o terminal mostrar.
- **Painel com o aviso "exibindo dados de exemplo":** as chaves do Supabase no `.env.local` estão vazias ou erradas. Reinicie o `npm run dev` depois de editar o arquivo.
- **Bot demorando alguns segundos:** o plano gratuito da Groq tem limite por minuto. O bot espera e tenta de novo sozinho.

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
