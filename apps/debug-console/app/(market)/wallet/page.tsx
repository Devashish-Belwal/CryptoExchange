import { ResponsePanel } from "@/components/ui/response-panel";
import { Terminal } from "@/components/ui/terminal";
import { WalletPanels } from "@/components/ui/wallet-components";
import { ResponseEntry } from "@/lib/response-client.ts/response-viewer";

export default function Wallet() {
    const history: ResponseEntry[] = [];
    return (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-border lg:grid-cols-[1.4fr_1fr_1fr]">
            <WalletPanels />
            <ResponsePanel data={history} title={`wallet.request_history · ${history.length} calls`} />
            <Terminal title="stdout · wallet.service" />
        </main>
    )
}