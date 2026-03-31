import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE_LEAD, UPDATE_LEAD_STATUS } from "@/lib/queries";
import Leads from "@/pages/Leads";

const mocks = vi.hoisted(() => ({
  updateStatus: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: React.MouseEventHandler<HTMLButtonElement>; className?: string }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual<typeof import("@apollo/client")>("@apollo/client");

  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: {
        leads: {
          edges: [
            {
              node: {
                id: "lead-1",
                name: "Karina Araujaa",
                email: "karina.araujo9@email.com",
                phone: "(71) 92871-5677",
                cpf: "245.790.067-04",
                source: "TikTok",
                origin: "TikTok",
                procedure: "Mamoplastia + Abdominoplastia",
                whatsappActive: true,
                notes: "",
                status: "NEW",
                createdAt: "2026-03-06T07:42:59.126Z",
              },
              cursor: "cursor-1",
            },
          ],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: "cursor-1",
            endCursor: "cursor-1",
          },
          totalCount: 1,
        },
      },
      loading: false,
      refetch: mocks.refetch,
    })),
    useMutation: vi.fn((document) => {
      if (document === UPDATE_LEAD_STATUS) {
        return [mocks.updateStatus, { loading: false }];
      }

      if (document === DELETE_LEAD) {
        return [mocks.deleteLead, { loading: false }];
      }

      return [document ? vi.fn() : mocks.createLead, { loading: false }];
    }),
  };
});

describe("Leads drag/delete regression", () => {
  beforeEach(() => {
    mocks.updateStatus.mockReset();
    mocks.createLead.mockReset();
    mocks.updateLead.mockReset();
    mocks.deleteLead.mockReset().mockResolvedValue({
      data: { deleteLead: { success: true, message: "Lead excluído com sucesso" } },
    });
    mocks.refetch.mockReset();
  });

  it("should not update lead status while the delete dialog is open", async () => {
    render(
      <MemoryRouter>
        <Leads />
      </MemoryRouter>,
    );

    const card = screen.getByText("Karina Araujaa").closest('[draggable="true"]');
    expect(card).not.toBeNull();

    fireEvent.dragStart(card!);

    const menuButton = within(card as HTMLElement).getAllByRole("button")[0];
    fireEvent.click(menuButton);
    fireEvent.click(screen.getByText("Excluir"));

    expect(await screen.findByText("Confirmar Exclusão")).toBeInTheDocument();

    const contactedColumn = screen.getByText("Contato").closest("div")?.parentElement;
    expect(contactedColumn).not.toBeNull();

    fireEvent.drop(contactedColumn!);

    await waitFor(() => {
      expect(mocks.updateStatus).not.toHaveBeenCalled();
    });
  });
});
