import { ResetPasswordForm } from "@/components/forms/reset-password";
import { SignupForm } from "@/components/forms/signup";
import { VerifyOTPForm } from "@/components/forms/verify-otp.tsx";
import { ResponsePanel } from "@/components/ui/response-panel";
import { Terminal } from "@/components/ui/terminal";
import { ResponseEntry } from "@/lib/response-client.ts/response-viewer";

export default async function Signup({
    searchParams,
}: {
    searchParams: Promise<{ token?: string, action?: string }>
}) {
    const history: ResponseEntry[] = [];

    const { token, action } = await searchParams;

    return (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-border lg:grid-cols-[1fr_1fr_1fr]">

            <div className="flex min-h-0 flex-col gap-px bg-border h-full">

                <SignupForm />

                <VerifyOTPForm token={action === "verify-otp" ? token : undefined} />

                <ResetPasswordForm token={action === "reset-password" ? token : undefined} />
            </div>

            {/* Response panel */}
            <ResponsePanel data={history} title={`auth.request_history · ${history.length ?? 0} calls`} />

            {/* Terminal */}
            < Terminal title="stdout · auth.signup" />
        </main>
    )
}
