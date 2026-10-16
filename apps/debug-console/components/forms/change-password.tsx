"use client";

import { ReactNode, useState } from "react"
import { Panel } from "../ui/Shell";
import { Button } from "@workspace/ui/components/button";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { changePassword } from "@/lib/api-client/auth-manager";
import { ChangePasswordSchema } from "@workspace/shared";
import { toast } from "@workspace/ui/components/toast";
import { getAuthession } from "@/lib/auth-client";

export function ChangePasswordForm() {
    const [oldPassword, setOldPassword] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { append } = useTerminal();

    function resetForm() {
        setOldPassword("");
        setPassword("");
        setConfirmPassword("");
    }

    function validateChangePassword(): boolean {
        const validateRequest = ChangePasswordSchema.safeParse({ oldPassword, password, confirmPassword });
        if (!validateRequest.success) {
            toast.add({
                title: "Request Validation Error",
                description: validateRequest.error.message,
            })
            setLoading(false);
            return false;
        }

        return true;
    }

    async function submit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        event.stopPropagation();
        setLoading(true);

        const isValid = validateChangePassword();

        if (!isValid) return;

        const token = getAuthession()?.token;

        if (!token) {
            toast.add({
                title: "Request Validation Error",
                description: "No stored session, please signin first",
            })
            setLoading(false);
            return;
        }

        append({
            requestType: "REQ",
            requestMethod: "POST",
            endpoint: "/api/v1/auth/change-password",
            message: `Sending change password request`,
        });

        try {
            const res = await changePassword({ token, oldPassword, password, confirmPassword });
            append(res);

            toast.add({
                title: res.success === false ? "Backend Response Error" : "Backend Response",
                description: res.message,
            })

        } catch {

            append({
                requestType: "REQ",
                requestMethod: "POST",
                endpoint: "/api/vi/change-password",
                message: `Something went wrong`,
            });

        } finally {
            resetForm();
            setLoading(false);
        }
    }

    return (
        <Panel
            title="auth.change-password" className="flex-1"
            right={
                <Button
                    onClick={() => void resetForm()}
                    className="hover:text-term-yellow border-0 disabled:opacity-50"
                >
                    {"[reset]"}
                </Button>
            }
        >
            <form onSubmit={submit} className="space-y-3 p-4 text-[12px]">
                <Field label="old password">
                    <input
                        className={inputStyle}
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                    />
                </Field>
                <Field label="new password">
                    <input
                        className={inputStyle}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </Field>
                <Field label="confirm password">
                    <input
                        className={inputStyle}
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                </Field>
                <div className="flex items-center gap-2 pt-2">
                    <button
                        type="submit"
                        className={buttonStyle}
                        disabled={loading}>
                        {loading ? "submitting..." : "$ ./change-password"}
                    </button>
                    <span className="text-term-dim">POST /api/v1/auth/change-password</span>
                </div>
            </form>
        </Panel>
    )
}

const inputStyle = "w-full border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green";

const buttonStyle = "border border-term-green bg-secondary px-3 py-1 text-term-green hover:bg-term-green hover:text-background disabled:opacity-50";

function Field(
    { label, children }:
        { label: string, children: ReactNode }
) {
    return (
        <label className="block">
            <div className="mb-1 text-term-dim">{label}</div>
            {children}
        </label>

    )
}
