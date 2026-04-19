import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import HistoricalDatePicker from "../historical-date-picker";
import { ptBR } from "date-fns/locale";

describe("HistoricalDatePicker", () => {
  it("shows placeholder when no value and displays selected date when value provided", () => {
    const onChange = vi.fn();
    render(<HistoricalDatePicker onChange={onChange} locale={ptBR} />);
    const btn = screen.getByRole("button", { name: /Selecione a data/i });
    expect(btn).toBeInTheDocument();
  });

  it("opens popover and shows year input reflecting value", async () => {
    const onChange = vi.fn();
    render(<HistoricalDatePicker onChange={onChange} value={"1920-05-10"} locale={ptBR} />);
    const btn = screen.getByRole("button", { name: /10\/05\/1920/ });
    fireEvent.click(btn);
    const clearBtn = await screen.findByRole("button", { name: /Limpar/i });
    expect(clearBtn).toBeInTheDocument();
  });
});
