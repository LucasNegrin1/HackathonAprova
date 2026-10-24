import React, { useState } from 'react';
import type { EngineNode } from '../types';
import { Server, Wifi, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import './blocks.css';

interface ApiConnectorProps {
  node: EngineNode;
  onEvent: (eventType: string, payload?: any) => void;
}

export const ApiConnectorBlock: React.FC<ApiConnectorProps> = ({ node, onEvent }) => {
  const [isPinging, setIsPinging] = useState(false);
  const [latency, setLatency] = useState(24);
  const [status, setStatus] = useState<'healthy' | 'warning'>('healthy');
  const [lastCheck, setLastCheck] = useState('Agora mesmo');

  const handlePing = () => {
    setIsPinging(true);
    setTimeout(() => {
      const simulatedLatency = Math.floor(Math.random() * 35) + 12;
      setLatency(simulatedLatency);
      setStatus(simulatedLatency > 40 ? 'warning' : 'healthy');
      setIsPinging(false);
      setLastCheck(new Date().toLocaleTimeString('pt-BR'));
      onEvent('API_HEALTHCHECK_COMPLETED', {
        nodeId: node.id,
        latencyMs: simulatedLatency,
        gateway: 'https://api.preftech.gov.br/v2/engine'
      });
    }, 600);
  };

  return (
    <div className="engine-card api-connector-block">
      <div className="card-header">
        <div className="flex-center gap-10">
          <div className={`status-ping-dot ${status}`} />
          <div>
            <h4 className="card-title">{node.title || 'Gateway Conector & Microserviços'}</h4>
            <p className="card-subtitle">Endpoint: https://api.preftech.gov.br/v2/engine</p>
          </div>
        </div>
        <button 
          className="btn-icon" 
          onClick={handlePing} 
          disabled={isPinging}
          title="Executar Ping de Diagnóstico"
        >
          <RefreshCw size={15} className={isPinging ? 'spin' : ''} />
        </button>
      </div>

      <div className="api-stats-grid">
        <div className="api-stat-box">
          <span className="api-stat-label"><Clock size={12} /> Latência Média</span>
          <span className="api-stat-value text-cyan">{latency} ms</span>
        </div>
        <div className="api-stat-box">
          <span className="api-stat-label"><CheckCircle size={12} /> Disponibilidade</span>
          <span className="api-stat-value text-emerald">99.98%</span>
        </div>
        <div className="api-stat-box">
          <span className="api-stat-label"><Server size={12} /> Protocolo</span>
          <span className="api-stat-value font-mono">HTTP/2 + gRPC</span>
        </div>
        <div className="api-stat-box">
          <span className="api-stat-label"><Wifi size={12} /> Última Sondagem</span>
          <span className="api-stat-value font-mono text-muted">{lastCheck}</span>
        </div>
      </div>
    </div>
  );
};
