import React, { useState } from 'react';
import { useEngine } from '../../engine/EngineContext';
import { Code2, Check, RefreshCw, Copy, CheckCheck, AlertCircle } from 'lucide-react';
import './views.css';

export const SchemaDesigner: React.FC = () => {
  const { schema, updateSchema, resetSchema } = useEngine();
  const [jsonText, setJsonText] = useState(JSON.stringify(schema, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error('O schema deve conter um array válido de "nodes".');
      }
      updateSchema(parsed);
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || 'JSON inválido');
    }
  };

  const handleReset = () => {
    resetSchema();
    setJsonText(JSON.stringify(schema, null, 2));
    setError(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="view-container animate-fade-in">
      <div className="view-header">
        <div>
          <h2 className="view-title">Editor Declarativo de Schema</h2>
          <p className="view-subtitle">
            Estrutura JSON do Front Engine. Qualquer alteração aqui reflete em tempo real na árvore de nós.
          </p>
        </div>
        <div className="view-actions">
          <button className="btn-secondary-view" onClick={handleCopy}>
            {copied ? <CheckCheck size={14} className="text-emerald" /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar JSON'}
          </button>
          <button className="btn-secondary-view" onClick={handleReset} title="Restaurar padrão">
            <RefreshCw size={14} /> Restaurar Padrão
          </button>
          <button className="btn-primary" onClick={handleApply}>
            {saved ? <Check size={15} /> : <Code2 size={15} />}
            {saved ? 'Aplicado com Sucesso!' : 'Salvar & Compilar Schema'}
          </button>
        </div>
      </div>

      {error && (
        <div className="schema-error-banner">
          <AlertCircle size={18} />
          <span>Erro de Sintaxe no Schema: {error}</span>
        </div>
      )}

      <div className="code-editor-wrapper">
        <div className="editor-top-bar">
          <span className="editor-file-tab">schema.preftech.json</span>
          <span className="editor-stats font-mono">
            Nós ativos: {schema.nodes.length} | Versão: {schema.version}
          </span>
        </div>
        <textarea
          className="schema-textarea font-mono"
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setError(null);
          }}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
