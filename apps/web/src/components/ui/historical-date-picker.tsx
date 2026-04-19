"use client";

import * as React from "react";
import { format, getYear, setMonth, setYear, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigation } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface HistoricalDatePickerProps {
  value?: string; // ISO yyyy-MM-dd
  onChange: (iso: string) => void;
  minYear?: number;
  maxYear?: number;
  locale?: any;
  placeholder?: string;
}

function CustomCaption(props: { displayMonth: Date; fromYear?: number; toYear?: number }) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  
  const fromYear = props.fromYear || 1900;
  const toYear = props.toYear || getYear(new Date());

  const years = Array.from(
    { length: toYear - fromYear + 1 },
    (_, i) => (fromYear + i).toString()
  ).reverse();

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const handleMonthChange = (monthIndex: string) => {
    const newDate = setMonth(props.displayMonth, parseInt(monthIndex));
    goToMonth(newDate);
  };

  const handleYearChange = (year: string) => {
    const newDate = setYear(props.displayMonth, parseInt(year));
    goToMonth(newDate);
  };

  return (
    <div className="flex items-center justify-between px-2 py-2 border-b mb-2">
      <div className="flex gap-2">
        <Select
          value={props.displayMonth.getMonth().toString()}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs font-medium border-none bg-accent/50 hover:bg-accent focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month, index) => (
              <SelectItem key={month} value={index.toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={props.displayMonth.getFullYear().toString()}
          onValueChange={handleYearChange}
        >
          <SelectTrigger className="h-8 w-[80px] text-xs font-medium border-none bg-accent/50 hover:bg-accent focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 ml-4">
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => previousMonth && goToMonth(previousMonth)}
          disabled={!previousMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => nextMonth && goToMonth(nextMonth)}
          disabled={!nextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function HistoricalDatePicker({
  value,
  onChange,
  minYear = 1900,
  maxYear = getYear(new Date()),
  placeholder = "Selecione a data",
}: HistoricalDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  // Estado local para permitir selecionar antes de confirmar
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(
    value ? parseISO(value) : undefined
  );

  // Sincronizar estado interno quando o valor externo mudar ou o popover abrir
  React.useEffect(() => {
    if (open) {
      setInternalDate(value ? parseISO(value) : undefined);
    }
  }, [value, open]);

  const handleConfirm = () => {
    if (internalDate) {
      onChange(format(internalDate, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(parseISO(value), "dd/MM/yyyy", { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 overflow-hidden rounded-xl border-none shadow-2xl" align="start">
        <Calendar
          mode="single"
          selected={internalDate}
          onSelect={setInternalDate}
          initialFocus
          locale={ptBR}
          classNames={{
            caption: "hidden", 
          }}
          components={{
            // @ts-ignore
            Caption: (props) => <CustomCaption {...props} fromYear={minYear} toYear={maxYear} />
          }}
          fromDate={new Date(minYear, 0, 1)}
          toDate={new Date(maxYear, 11, 31)}
        />
        <div className="p-3 border-t bg-muted/20 flex items-center justify-between gap-2">
           <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => {
             setInternalDate(undefined);
             onChange("");
             setOpen(false);
           }}>
             Limpar
           </Button>
           
           <div className="flex gap-2">
             <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setInternalDate(new Date())}>
               Hoje
             </Button>
             <Button size="sm" className="text-xs h-8 px-4 bg-primary" onClick={handleConfirm}>
               Confirmar
             </Button>
           </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default HistoricalDatePicker;