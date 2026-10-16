"use client";

import { ReactNode, useState } from "react"
import { Panel } from "../ui/Shell";
import { Button } from "@workspace/ui/components/button";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { registerUser } from "@/lib/api-client/auth-manager";
import { RegisterUserSchema } from "@workspace/shared";
import { toast } from "@workspace/ui/components/toast";

export function SignupForm() {
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [adminKey, setAdminKey] = useState("");

    const [loading, setLoading] = useState(false);
    const { append } = useTerminal();

    function resetForm() {
        setEmail("");
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        setAdminKey("");
    }

    function validateUserSignup(): boolean {
        const validateRequest = RegisterUserSchema.safeParse({ email, username, password, confirmPassword });
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

        const isValid = validateUserSignup();

        if (!isValid) return;

        append({
            requestType: "REQ",
            requestMethod: "POST",
            endpoint: "/api/v1/auth/signup",
            message: `Sending user register request`,
        });

        try {
            const res = await registerUser({ username, email, password, confirmPassword, adminKey });
            append(res);

            toast.add({
                title: res.success === false ? "Backend Response Error" : "Backend Response",
                description: res.message,
            })

        } catch {

            append({
                requestType: "REQ",
                requestMethod: "POST",
                endpoint: "/api/vi/signup",
                message: `Something went wrong`,
            });

        } finally {
            resetForm();
            setLoading(false);
        }
    }

    return (
        <Panel
            title="auth.signup"
            right={
                <Button
                    onClick={() => void resetForm()}
                    className="hover:text-term-yellow border-0 disabled:opacity-50"
                >
                    {"[reset]"}
                </Button>
            }
        >
            {/* <form className="space-y-3 p-4 text-[12px]"> */}
            <form onSubmit={submit} className="grid grid-cols-1 gap-2 p-3 text-[12px] md:grid-cols-2">

                <Field label="email" classname="col-span-2">
                    <input
                        className={inputStyle}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </Field>

                <Field label="username">
                    <input
                        className={inputStyle}
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </Field>

                <Field label="admin key (optional)">
                    <input
                        className={`${inputStyle} flex-1`}
                        type="password"
                        value={adminKey}
                        placeholder="try this key... c5f22fdf"
                        onChange={(e) => setAdminKey(e.target.value)}
                    />
                </Field>

                <Field label="password">
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

                <div className="flex items-center gap-2 pt-2 col-span-2">
                    <button
                        type="submit"
                        className={buttonStyle}
                        disabled={loading}>
                        {loading ? "submitting..." : "$ ./register"}
                    </button>
                    <span className="text-term-dim">POST /api/v1/auth/signup</span>
                </div>
            </form>
        </Panel>
    )
}

const inputStyle = "w-full border border-border bg-input px-2 py-1 font-mono text-foreground outline-none focus:border-term-green";

const buttonStyle = "border border-term-green bg-secondary px-3 py-1 text-term-green hover:bg-term-green hover:text-background disabled:opacity-50";

function Field(
    { label, children, classname }:
        { label: string, children: ReactNode, classname?: string }
) {
    return (
        <label className={`block ${classname}`}>
            <div className="mb-1 text-term-dim">{label}</div>
            {children}
        </label>

    )
}