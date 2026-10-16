import { ChangePasswordForm } from "@/components/forms/change-password";
import { SigninForm } from "@/components/forms/signin";
import { ResponsePanel } from "@/components/ui/response-panel";
import { Terminal } from "@/components/ui/terminal";
import { ResponseEntry } from "@/lib/response-client.ts/response-viewer";

export default function Signin() {
    const history: ResponseEntry[] = [];
    return (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-border lg:grid-cols-[1fr_1fr_1fr]">

            <div className="flex min-h-0 flex-col gap-px bg-border h-full">
                <SigninForm />

                <ChangePasswordForm />
            </div>

            <ResponsePanel data={history} title={`auth.request_history · ${history.length ?? 0} calls`} />

            < Terminal title="stdout · auth.signup" />
        </main>
    )
}