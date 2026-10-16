import { HealthCheckPanel } from "@/components/ui/home-component";
import { Panel } from "@/components/ui/Shell";
import { Terminal } from "@/components/ui/terminal";
import { BASE_MODULES } from "@/lib/site-data";
import { ClientConfig } from "@/utils/config/client";
import Link from "next/link";

export default function Page() {

  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-border lg:grid-cols-[1fr_1fr]">
      {/* <main className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-border"> */}
      <div className="flex min-h-0 flex-col gap-px bg-border h-full">
        <Panel title="system.overview">
          <div className="grid grid-cols-[1fr_auto] gap-4 p-3 text-[12px]">
            <div>
              <pre className="text-term-dim">{`
 ████████╗██████╗ ██████╗
 ╚══██╔══╝██╔══██╗██╔══██╗
    ██║   ██████╔╝██║  ██║   trading-engine v0.1.0-dev
    ██║   ██╔══██╗██║  ██║   simulated debug surface
    ██║   ██║  ██║██████╔╝   build a3f1c · ${new Date().getFullYear()}
    ╚═╝   ╚═╝  ╚═╝╚═════╝
`}
              </pre>
              <pre className="text-term-dim">{` CEX DEBUG CONSOLE
 ├─ http  ${ClientConfig.CORE_BACKEND_URL}
 └─ ws    ${ClientConfig.CORE_WS_URL}`}</pre>
              <p className="mt-3 text-foreground">Every page calls the core-backend routes directly. Market and trade views merge HTTP snapshots with live WebSocket frames.</p>
            </div>

          </div>

        </Panel>

        <HealthCheckPanel />

        <Panel title="modules">
          <ul className="divide-y divide-border text-[12px]">
            {BASE_MODULES.map((m) => (
              <li
                key={m.href}
                className="flex items-center gap-3 px-3 py-1.5"
              >
                <Link
                  href={m.href}
                  className="text-term-green hover:underline"
                >
                  {m.name}
                </Link>
                <span className="text-term-dim">{m.description}</span>
                <span className="ml-auto text-term-dim">{m.href}</span>

              </li>
            ))}

          </ul>

        </Panel>

      </div>
      <Terminal title="stdout · health.monitor" />
    </main>
  )
}
