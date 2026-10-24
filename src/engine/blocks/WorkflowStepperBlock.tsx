import React, { useState } from 'react';
import type { EngineNode } from '../types';
import { CheckCircle2, Circle, ArrowRight, Play, RefreshCw } from 'lucide-react';
import './blocks.css';

interface WorkflowStepperProps {
  node: EngineNode;
  onEvent: (eventType: string, payload?: any) => void;
}

export const WorkflowStepperBlock: React.FC<WorkflowStepperProps> = ({ node, onEvent }) => {
  const steps = node.props.steps || [
    { id: '1', name: 'Triagem Digital', desc: 'Validação e indexação inicial de dados' },
    { id: '2', name: 'Análise de Conformidade', desc: 'Verificação com regras de negócio e LGPD' },
    { id: '3', name: 'Parecer Técnico', desc: 'Despacho automatizado do motor de decisão' },
    { id: '4', name: 'Publicação & Notificação', desc: 'Envio ao cidadão e repositório oficial' }
  ];

  const [currentStepIndex, setCurrentStepIndex] = useState(node.props.currentStep ?? 1);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      onEvent('WORKFLOW_STEP_ADVANCED', {
        nodeId: node.id,
        currentStep: steps[nextIndex].name,
        index: nextIndex
      });
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    onEvent('WORKFLOW_RESET', { nodeId: node.id });
  };

  return (
    <div className="engine-card workflow-block">
      <div className="card-header">
        <div>
          <h4 className="card-title">{node.title || 'Pipeline de Execução Automática'}</h4>
          <p className="card-subtitle">Etapas orquestradas pelo Front Engine em tempo real</p>
        </div>
        <div className="workflow-actions">
          <button className="btn-icon" onClick={handleReset} title="Reiniciar fluxo">
            <RefreshCw size={15} />
          </button>
          <button 
            className="btn-primary-sm" 
            onClick={handleNext} 
            disabled={currentStepIndex >= steps.length - 1}
          >
            Avançar <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="stepper-track">
        {steps.map((step: any, index: number) => {
          const isDone = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <div 
              key={step.id} 
              className={`step-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              onClick={() => {
                setCurrentStepIndex(index);
                onEvent('WORKFLOW_STEP_SELECTED', { nodeId: node.id, stepIndex: index, stepName: step.name });
              }}
            >
              <div className="step-indicator">
                {isDone ? (
                  <CheckCircle2 size={20} className="step-icon-done" />
                ) : isCurrent ? (
                  <div className="step-current-ring">
                    <Play size={12} fill="currentColor" />
                  </div>
                ) : (
                  <Circle size={18} className="step-icon-idle" />
                )}
              </div>
              <div className="step-content">
                <span className="step-number">Etapa 0{index + 1}</span>
                <span className="step-title">{step.name}</span>
                <span className="step-desc">{step.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
