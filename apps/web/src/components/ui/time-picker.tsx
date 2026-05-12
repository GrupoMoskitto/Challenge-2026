import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, disabled = false }: TimePickerProps) {
  // Value is expected to be "HH:mm"
  const [hour, minute] = value ? value.split(":") : ["", ""];

  return (
    <div className="flex items-center gap-2">
      <Select
        disabled={disabled}
        value={hour}
        onValueChange={(val) => {
          const m = minute || "00";
          onChange(`${val}:${m}`);
        }}
      >
        <SelectTrigger className="w-full flex-1">
          <SelectValue placeholder="Hora" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 16 }, (_, i) => i + 8).map((h) => {
            const hStr = h.toString().padStart(2, "0");
            return (
              <SelectItem key={hStr} value={hStr}>
                {hStr}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground font-bold">:</span>
      <Select
        disabled={disabled}
        value={minute}
        onValueChange={(val) => {
          const h = hour || "08";
          onChange(`${h}:${val}`);
        }}
      >
        <SelectTrigger className="w-full flex-1">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => {
            const mStr = m.toString().padStart(2, "0");
            return (
              <SelectItem key={mStr} value={mStr}>
                {mStr}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
