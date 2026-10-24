import React, { useState } from 'react';
import type { EngineNode } from '../types';
import { Send, Check, ShieldCheck, Sparkles } from 'lucide-react';
import './blocks.css';

interface FormBuilderProps {
  node: EngineNode;
  onEvent: (eventType: string, payload?: any) => void;
}

export const FormBuilderBlock: React.FC<FormBuilderProps> = ({ node, onEvent }) => {
  const [formData, setFormData] = useState({
    protocolName: 'Alvará Digital 2026',
    department: 'secretaria-urbanismo',
    urgentPriority: true,
    requesterNotes: 'Solicitação prioritária para aprovação de implantação tecnológica.'
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    onEvent('FORM_SUBMITTED', {
      nodeId: node.id,
      timestamp: new Date().toISOString(),
      data: formData
    });
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="engine-card form-block">
      <div className="card-header">
        <div>
          <h4 className="card-title">{node.title || 'Formulário Reativo Dinâmico'}</h4>
          <p className="card-subtitle">Entradas tipadas integradas com o motor de validação</p>
        </div>
        <span className="badge badge-primary">
          <Sparkles size={12} /> Auto-validável
        </span>
      </div>

      <form onSubmit={handleSubmit} className="engine-form">
        <div className="form-group">
          <label className="form-label">Identificador do Protocolo</label>
          <input
            type="text"
            className="engine-input"
            value={formData.protocolName}
            onChange={(e) => setFormData({ ...formData, protocolName: e.target.value })}
            placeholder="Ex: Alvará de Funcionamento"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label className="form-label">Departamento Destino</label>
            <select
              className="engine-select"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            >
              <option value="secretaria-urbanismo">Secretaria de Urbanismo & Obras</option>
              <option value="fazenda-tributaria">Fazenda & Arrecadação</option>
              <option value="meio-ambiente">Meio Ambiente & Sustentabilidade</option>
              <option value="inovacao-tecnologia">Tecnologia & Governança Digital</option>
            </select>
          </div>

          <div className="form-group form-switch-wrap">
            <label className="form-label">Regime de Urgência</label>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={formData.urgentPriority}
                onChange={(e) => setFormData({ ...formData, urgentPriority: e.target.checked })}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Despacho / Observações Técnicas</label>
          <textarea
            rows={3}
            className="engine-textarea"
            value={formData.requesterNotes}
            onChange={(e) => setFormData({ ...formData, requesterNotes: e.target.value })}
            placeholder="Insira detalhes pertinentes à execução..."
          />
        </div>

        <div className="form-actions">
          <div className="form-feedback-info">
            <ShieldCheck size={16} className="text-emerald" />
            <span>Assinatura digital e hash ICP-Brasil validados</span>
          </div>
          <button type="submit" className="btn-primary" disabled={submitted}>
            {submitted ? (
              <>
                <Check size={16} /> Protocolado com Sucesso!
              </>
            ) : (
              <>
                <Send size={16} /> Submeter ao Engine
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
