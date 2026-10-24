import React from 'react';
import type { EngineNode } from '../types';
import { TrendingUp, TrendingDown, Activity, ArrowUpRight } from 'lucide-react';
import './blocks.css';

interface MetricsCardProps {
  node: EngineNode;
  onEvent: (eventType: string, payload?: any) => void;
}

export const MetricsCardBlock: React.FC<MetricsCardProps> = ({ node, onEvent }) => {
  const { props } = node;
  const value = props.value ?? '1,280';
  const label = props.label ?? 'Processos Ativos';
  const change = props.change ?? '+14.2%';
  const isPositive = props.isPositive !== false;

  const handleClick = () => {
    onEvent('METRIC_INSPECTED', { nodeId: node.id, label, value });
  };

  return (
    <div className="engine-card metric-block" onClick={handleClick}>
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        <div className="metric-icon-wrap">
          <Activity size={18} className="icon-pulse" />
        </div>
      </div>
      <div className="metric-body">
        <h3 className="metric-value">{value}</h3>
        <div className={`metric-trend ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>{change} vs. mês anterior</span>
        </div>
      </div>
      <div className="metric-footer">
        <span className="metric-hint">Clique para detalhar métrica</span>
        <ArrowUpRight size={14} className="metric-arrow" />
      </div>
    </div>
  );
};
