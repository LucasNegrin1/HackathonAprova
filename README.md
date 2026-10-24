# PrefTech Front Engine

Motor reativo e modular de interface front-end construído em **React 19** e **TypeScript** com **Vite** e sistema de design em **Vanilla CSS**.

---

## 🚀 Visão Geral da Arquitetura

O **PrefTech Front Engine** foi estruturado em camadas desacopladas para permitir orquestração dinâmica de interfaces baseadas em schemas declarativos:

```
src/
├── engine/                      # Núcleo do motor de renderização e estado
│   ├── types.ts                 # Schemas, tipos de nós, barramento de eventos
│   ├── initialSchema.ts         # Schema padrão com blocos municipais/GovTech
│   ├── registry.ts              # Catálogo e registro de componentes de bloco
│   ├── EngineContext.tsx        # Provedor de estado, telemetria e despacho de eventos
│   ├── EngineRenderer.tsx       # Renderizador dinâmico de nós do schema
│   ├── EngineRenderer.css       # Estilos da grade responsiva e controles de nós
│   └── blocks/                  # Blocos prontos do motor
│       ├── MetricsCardBlock.tsx # KPI consolidado com comparação temporal
│       ├── WorkflowStepperBlock.tsx # Orquestrador de etapas sequenciais
│       ├── FormBuilderBlock.tsx # Formulários tipados com validação reativa
│       ├── DataTableBlock.tsx   # Grid de dados com busca e ações
│       ├── ApiConnectorBlock.tsx# Diagnóstico de rede e latência de gateway
│       └── blocks.css           # Estilos e microinterações dos blocos
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Barra superior, navegação por modos e temas
│   │   └── layout.css
│   └── views/
│       ├── SchemaDesigner.tsx   # Editor JSON declarativo em tempo real
│       ├── ComponentRegistryView.tsx # Catálogo visual de blocos para inserção
│       ├── TelemetryView.tsx    # Barramento de eventos e inspetor de payload
│       └── views.css
├── styles/
│   ├── tokens.css               # Design system com tokens HSL e modos Dark/Light
│   └── index.css                # Resets, tipografia e animações
├── App.tsx                      # Casca principal e alternância de views
├── App.css
└── main.tsx                     # Ponto de entrada React
```

---

## 🛠️ Modos do Front Engine

1. **Canvas Studio**: Visualização dos blocos renderizados com ordenação dinâmica, remoção e interação direta.
2. **Schema JSON**: Editor declarativo ao vivo do `schema.preftech.json` com compilação e validação instantânea.
3. **Catálogo de Blocos**: Inserção de novos blocos (`analytics`, `workflow`, `input`, `data`, `system`) com um clique.
4. **Telemetria & Eventos**: Monitoramento do barramento reativo com medição de latência, ciclos de render e inspeção de payloads.

---

## 💻 Como Rodar Localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Compilar para produção
npm run build
```

O servidor local é iniciado por padrão em `http://127.0.0.1:5173/`.
# HackathonAprova
