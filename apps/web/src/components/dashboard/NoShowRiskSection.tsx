import React from 'react';
import { Info, Clock, Activity, ArrowUpRight, ArrowDownRight, CircleX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
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
  const averageScore = totalCount > 0 
    ? Math.round(appointments.reduce((sum, a) => sum + a.riskScore, 0) / totalCount)
    : 100;

  const isHealthy = averageScore >= 80;
  const isCritical = averageScore < 50;

  return (
    <Card className="rounded-lg border bg-card text-card-foreground shadow-black/5 overflow-hidden shadow-none">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shadow-lg",
            isHealthy ? "bg-emerald-500" : isCritical ? "bg-red-500" : "bg-amber-500"
          )}>
            <Activity className="h-5 w-5 text-white" />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-primary transition-colors focus:outline-none">
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 shadow-2xl border-primary/10" align="end">
              <div className="p-3 bg-primary/[0.02]">
                <h4 className="text-xs font-bold flex items-center gap-1.5 text-primary">
                  <Info className="h-3.5 w-3.5" />
                  Metodologia
                </h4>
              </div>
              <Separator />
              <div className="p-3 space-y-3">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Fatores de Risco</span>
                  <ul className="space-y-0.5 text-[10px] text-muted-foreground font-medium">
                    <li className="flex justify-between"><span>Confirmação ignorada</span> <span className="font-bold">-40</span></li>
                    <li className="flex justify-between"><span>Fora do expediente</span> <span className="font-bold">-20</span></li>
                    <li className="flex justify-between"><span>SLA violado</span> <span className="font-bold">-30</span></li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Fatores de Confiança</span>
                  <ul className="space-y-0.5 text-[10px] text-muted-foreground font-medium">
                    <li className="flex justify-between"><span>Confirmado via Chatbot</span> <span className="font-bold text-emerald-600">+40</span></li>
                    <li className="flex justify-between"><span>Horário Prime</span> <span className="font-bold text-emerald-600">+10</span></li>
                  </ul>
                </div>
              </div>
              <Separator />
              <div className="p-2 flex justify-center bg-muted/10">
                <div className="flex items-center gap-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                  <Clock className="h-2.5 w-2.5" /> Atualizado em tempo real
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-2xl font-black tracking-tighter tabular-nums">
            {averageScore}%
          </p>
          {isHealthy ? (
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          )}
        </div>

        <p className="text-sm font-bold text-foreground/90">Score do Hospital</p>
        
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-1000",
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
      </CardContent>
    </Card>
  );
};
