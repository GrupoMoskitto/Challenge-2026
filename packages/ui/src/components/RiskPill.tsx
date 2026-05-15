import React from 'react';

export interface RiskPillProps {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  customLabel?: string;
  hideDot?: boolean;
  minimal?: boolean;
}

export const RiskPill: React.FC<RiskPillProps> = ({ score, level, customLabel, hideDot, minimal }) => {
  const isHigh = level === 'HIGH';
  
  const ariaLabel = customLabel || (level === 'LOW' 
    ? `Risco baixo, score ${score}` 
    : level === 'MEDIUM' 
    ? `Risco moderado, score ${score}` 
    : `Risco alto, score ${score} — requer atenção`);


  if (minimal) {
    const label = level === 'LOW' ? 'BAIXO' : level === 'MEDIUM' ? 'MÉDIO' : 'ALTO';
    return (
      <div 
        className={`risk-indicator risk-minimal-${level.toLowerCase()} risk-pill-${level.toLowerCase()}`}
        aria-label={ariaLabel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 900,
          padding: '2px 6px',
          gap: '4px',
          border: '1px solid var(--risk-border)',
          background: 'var(--risk-bg)',
          color: 'var(--risk-color)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          letterSpacing: '0.025em',
          textTransform: 'uppercase'
        }}
      >
        <div style={{ 
          width: '3px', 
          height: '3px', 
          borderRadius: '50%', 
          background: 'var(--risk-dot)'
        }} />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div 
      className={`risk-pill risk-pill-${level.toLowerCase()}`}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 500,
        padding: '3px 10px',
        gap: '6px',
        border: '0.5px solid var(--risk-border)',
        background: 'var(--risk-bg)',
        color: 'var(--risk-color)',
        animation: (isHigh && !customLabel) ? 'risk-pill-pulse 2s infinite' : 'none',
        whiteSpace: 'nowrap',
        width: 'fit-content'
      }}
    >
      <style>{`
        :root {
          --risk-low-bg: #E1F5EE;
          --risk-low-color: #085041;
          --risk-low-border: #5DCAA5;
          --risk-low-dot: #0F6E56;

          --risk-medium-bg: #FAEEDA;
          --risk-medium-color: #633806;
          --risk-medium-border: #EF9F27;
          --risk-medium-dot: #BA7517;

          --risk-high-bg: #FCEBEB;
          --risk-high-color: #791F1F;
          --risk-high-border: #E24B4A;
          --risk-high-dot: #A32D2D;
        }

        .dark, [data-theme="dark"] {
          --risk-low-bg: #04342C;
          --risk-low-color: #9FE1CB;
          --risk-low-border: #1D9E75;

          --risk-medium-bg: #412402;
          --risk-medium-color: #FAC775;
          --risk-medium-border: #BA7517;

          --risk-high-bg: #501313;
          --risk-high-color: #F7C1C1;
          --risk-high-border: #A32D2D;
        }

        .risk-pill-low {
          --risk-bg: var(--risk-low-bg);
          --risk-color: var(--risk-low-color);
          --risk-border: var(--risk-low-border);
          --risk-dot: var(--risk-low-dot);
        }
        .risk-pill-medium {
          --risk-bg: var(--risk-medium-bg);
          --risk-color: var(--risk-medium-color);
          --risk-border: var(--risk-medium-border);
          --risk-dot: var(--risk-medium-dot);
        }
        .risk-pill-high {
          --risk-bg: var(--risk-high-bg);
          --risk-color: var(--risk-high-color);
          --risk-border: var(--risk-high-border);
          --risk-dot: var(--risk-high-dot);
        }

        @keyframes risk-dot-ping {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes risk-pill-pulse {
          0% { box-shadow: 0 0 0 0 rgba(226,75,74,0.35); }
          70% { box-shadow: 0 0 0 6px rgba(226,75,74,0); }
          100% { box-shadow: 0 0 0 0 rgba(226,75,74,0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .risk-pill, .risk-dot {
            animation: none !important;
          }
        }
      `}</style>
      {!hideDot && (
        <span 
          className="risk-dot"
          aria-hidden="true"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--risk-dot)',
            animation: (isHigh && !customLabel) ? 'risk-dot-ping 1.5s ease-in-out infinite' : 'none'
          }}
        />
      )}
      <span>
        {customLabel || `${level === 'LOW' ? 'Baixo risco' : level === 'MEDIUM' ? 'Risco moderado' : 'Alto risco'} · ${score}`}
      </span>
    </div>
  );
};

export const RiskBadge: React.FC<RiskPillProps> = ({ score, level }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <RiskPill score={score} level={level} />
      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', paddingLeft: '4px' }}>
        {level === 'HIGH' ? 'Intervenção urgente necessária' : level === 'MEDIUM' ? 'Monitoramento recomendado' : 'Situação estável'}
      </div>
    </div>
  );
};
