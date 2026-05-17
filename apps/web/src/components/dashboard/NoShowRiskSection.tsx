import React from 'react';
import { Info, Clock, Activity, ArrowUpRight, ArrowDownRight, CircleX, ShieldAlert, ShieldCheck, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface AppointmentShort {
  id: string;
  riskScore: number;
}

interface NoShowRiskSectionProps {
  appointments: AppointmentShort[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const riskFactors = [
  { label: 'Confirmação ignorada', delta: -40 },
  { label: 'Cancelamentos prévios', delta: -25 },
  { label: 'SLA violado (>24h)', delta: -30 },
  { label: 'Fora do expediente', delta: -20 },
  { label: 'Lead não qualificado', delta: -15 },
];

const trustFactors = [
  { label: 'Confirmado via Chatbot', delta: +40 },
  { label: 'Comparecimentos prévios', delta: +25 },
  { label: 'Lead convertido', delta: +15 },
  { label: 'Horário prime', delta: +10 },
  { label: 'Antecedência > 7 dias', delta: +10 },
];

export const NoShowRiskSection: React.FC<NoShowRiskSectionProps> = ({
  appointments,
  isLoading,
  error,
  onRetry
}) => {
  if (isLoading) {
    return (
      <Card className="shadow-none border border-border/40 bg-card/50 overflow-hidden animate-pulse">
        <CardContent className="p-4 h-[120px]" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 shadow-md shadow-black/5 hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
          <CircleX className="h-8 w-8 text-destructive opacity-50" />
          <p className="text-[10px] font-black text-destructive uppercase">Erro no Score</p>
          <button onClick={onRetry} className="text-[9px] underline uppercase font-bold text-destructive">Tentar</button>
        </CardContent>
      </Card>
    );
  }

  const totalCount = appointments.length;
  const hasData = totalCount > 0;
  const averageScore = hasData
    ? Math.round(appointments.reduce((sum, a) => sum + a.riskScore, 0) / totalCount)
    : null;

  const isHealthy = averageScore !== null && averageScore >= 80;
  const isCritical = averageScore !== null && averageScore < 50;

  const scoreColor = averageScore === null
    ? 'bg-zinc-500'
    : isHealthy ? 'bg-emerald-500' : isCritical ? 'bg-red-500' : 'bg-amber-500';

  const glowColor = averageScore === null
    ? 'shadow-zinc-500/20'
    : isHealthy ? 'shadow-emerald-500/20' : isCritical ? 'shadow-red-500/20' : 'shadow-amber-500/20';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shadow-lg",
            scoreColor,
            glowColor
          )}>
            <Activity className="h-5 w-5 text-white" />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-primary transition-colors focus:outline-none">
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80 p-0 border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl rounded-xl overflow-hidden" 
              align="end"
              sideOffset={8}
            >
              <div className="px-4 py-3 border-b border-border/40">
                <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Info className="h-4 w-4 text-primary" />
                  Metodologia do Score
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Score de 0 a 100 por agendamento
                </p>
              </div>

              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-red-500">Fatores de Risco</span>
                  </div>
                  <div className="space-y-1">
                    {riskFactors.map((f) => (
                      <div key={f.label} className="flex justify-between items-center py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
                        <span className="text-xs text-muted-foreground">{f.label}</span>
                        <span className="text-xs font-bold text-red-500 tabular-nums">{f.delta}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-border/40" />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Fatores de Confiança</span>
                  </div>
                  <div className="space-y-1">
                    {trustFactors.map((f) => (
                      <div key={f.label} className="flex justify-between items-center py-1 px-2 rounded-md hover:bg-muted/50 transition-colors">
                        <span className="text-xs text-muted-foreground">{f.label}</span>
                        <span className="text-xs font-bold text-emerald-500 tabular-nums">+{f.delta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 py-2.5 border-t border-border/40 bg-muted/30">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <Clock className="h-3 w-3" /> Atualizado em tempo real
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-2xl font-black tracking-tighter tabular-nums">
            {averageScore !== null ? `${averageScore}%` : '—'}
          </p>
          {averageScore !== null && (
            isHealthy ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )
          )}
          {averageScore === null && (
            <Minus className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>

        <p className="text-sm font-bold text-foreground/90">Score do Hospital</p>
        
        {hasData ? (
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-1000 rounded-full",
                  isHealthy ? "bg-emerald-500" : isCritical ? "bg-red-500" : "bg-amber-500"
                )} 
                style={{ width: `${averageScore}%` }} 
              />
            </div>
            <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
              <span className="text-muted-foreground/40">Crítico</span>
              <span className="text-muted-foreground/40">Excelente</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            Sem agendamentos nos próximos 7 dias
          </p>
        )}
      </CardContent>
    </Card>
  );
};
