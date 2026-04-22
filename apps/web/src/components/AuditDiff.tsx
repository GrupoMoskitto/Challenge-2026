import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditDiffProps {
  oldValue: any;
  newValue: any;
  className?: string;
}

export const AuditDiff: React.FC<AuditDiffProps> = ({ oldValue, newValue, className }) => {
  if (!newValue || typeof newValue !== 'object' || Object.keys(newValue).length === 0) {
    return null;
  }

  const formatValue = (v: any) => {
    if (v === null || v === undefined) return <span className="italic opacity-30 text-[9px]">vazio</span>;
    if (typeof v === 'boolean') return v ? "Sim" : "Não";
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const diffItems = Object.entries(newValue).map(([key, val]: [string, any]) => {
    const isObject = val && typeof val === 'object' && !Array.isArray(val);
    const fromValue = isObject ? val.from : (oldValue?.[key]);
    const toValue = isObject ? val.to : val;
    
    if (fromValue === toValue && fromValue !== undefined) return null;
    
    return { key, fromValue, toValue };
  }).filter(Boolean);

  if (diffItems.length === 0) return null;

  return (
    <div className={cn("mt-3 space-y-2 p-2.5 bg-background/50 rounded border border-border/40", className)}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">
        Modificações Realizadas
      </div>
      <div className="grid grid-cols-1 gap-1">
        {diffItems.map((item: any) => (
          <div key={item.key} className="text-[10px] grid grid-cols-[70px_1fr] items-start gap-2 py-0.5 border-b border-border/10 last:border-0">
            <span className="font-semibold text-muted-foreground/80 truncate">{item.key}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.fromValue !== undefined && (
                <>
                  <span className="text-red-500/70 bg-red-500/5 px-1 py-0 rounded border border-red-500/10 line-through">
                    {formatValue(item.fromValue)}
                  </span>
                  <ChevronRight className="h-2 w-2 text-muted-foreground/30" />
                </>
              )}
              <span className="text-green-600 font-bold bg-green-500/5 px-1 py-0 rounded border border-green-500/20">
                {formatValue(item.toValue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
