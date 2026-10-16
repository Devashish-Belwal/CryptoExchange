import { create } from "zustand";
import { AppendTerminalLog, TerminalLog } from "./terminal-types";
import { v4 as uuidv4 } from "uuid";

interface TerminalStore {
    logs: TerminalLog[];
    append: (log: AppendTerminalLog) => void;
    clear: () => void;
    remove: (id: string) => void

}

const MAX_LOGS = 500;

export const useTerminalStrore = create<TerminalStore>((set) => ({
    logs: [],

    append: (log) => set((state) => ({
        logs: [
            ...state.logs,
            {
                id: uuidv4(),
                timestamp: Date.now(),
                ...log
            }
        ].slice(-MAX_LOGS)
    })),

    clear: () => set({ logs: [] }),

    remove: (id) =>
        set((state) => ({
            logs: state.logs.filter((l) => l.id !== id)
        }))
}))

export function useTerminal() {
    const append = useTerminalStrore((s) => s.append);
    const logs = useTerminalStrore((s) => s.logs);
    const clear = useTerminalStrore((s) => s.clear);
    const remove = useTerminalStrore((s) => s.remove);

    return { append, logs, clear, remove }
}