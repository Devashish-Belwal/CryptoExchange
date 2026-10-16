import { MarketPanel } from "@/components/ui/market-components";
import { Terminal } from "@/components/ui/terminal";

export default function Market() {

    return (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-border lg:grid-cols-[1.4fr_1fr_1fr]">
            <MarketPanel />
            <Terminal title="stdout · asset.service" />
        </main>
    )
}