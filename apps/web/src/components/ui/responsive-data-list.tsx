import * as React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  label: string;
  /** Optional class for the header cell */
  headerClassName?: string;
  /** Optional class for each data cell */
  cellClassName?: string;
  /** How to render this column's data */
  render: (item: T, index: number) => React.ReactNode;
}

interface ResponsiveDataListProps<T> {
  data: T[];
  /** Column definitions for the desktop table view */
  columns: Column<T>[];
  /** Card renderer for mobile view */
  mobileCard: (item: T, index: number) => React.ReactNode;
  /** Unique key extractor */
  keyExtractor: (item: T) => string;
  /** Message when data is empty */
  emptyMessage?: string;
  /** Additional class for the root container */
  className?: string;
  /** Additional class for the table wrapper (enables overflow-x-auto) */
  tableClassName?: string;
}

/**
 * ResponsiveDataList — adaptively renders:
 * - **Desktop (≥ 768px):** Full `<Table>` with columns
 * - **Mobile (< 768px):** Stacked cards
 *
 * Uses pure CSS breakpoints (`hidden md:block` / `md:hidden`) for zero-JS layout switching.
 */
export function ResponsiveDataList<T>({
  data,
  columns,
  mobileCard,
  keyExtractor,
  emptyMessage = "Nenhum dado encontrado",
  className,
  tableClassName,
}: ResponsiveDataListProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn("py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Desktop: Table */}
      <div className={cn("hidden md:block", tableClassName)}>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.headerClassName}>
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, i) => (
                <TableRow key={keyExtractor(item)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.cellClassName}>
                      {col.render(item, i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile: Stacked cards */}
      <div className="md:hidden space-y-3">
        {data.map((item, i) => (
          <div key={keyExtractor(item)}>
            {mobileCard(item, i)}
          </div>
        ))}
      </div>
    </div>
  );
}
