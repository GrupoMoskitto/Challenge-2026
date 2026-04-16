import { toast } from "sonner";

interface UndoAction {
  undoFn: () => Promise<void>;
  message: string;
}

let lastUndoAction: UndoAction | null = null;

export function showUndoableToast(
  message: string,
  undoFn: () => Promise<void>,
  undoMessage: string = "Desfazer"
) {
  lastUndoAction?.undoFn().catch(console.error);
  
  lastUndoAction = { undoFn, message };
  
  toast(message, {
    action: {
      label: undoMessage,
      onClick: () => {
        if (lastUndoAction) {
          lastUndoAction.undoFn()
            .then(() => toast.success(lastUndoAction?.message || "Ação desfeita"))
            .catch((e) => toast.error(e.message || "Erro ao desfazer"))
            .finally(() => { lastUndoAction = null; });
        }
      },
    },
    duration: 5000,
  });
}

export function dismissUndoToast() {
  lastUndoAction = null;
}

export type { UndoAction };