"use client";

import { ReactNode, useEffect, useState } from "react"
import { Panel } from "../ui/Shell";
import { Button } from "@workspace/ui/components/button";
import { useTerminal } from "@/lib/terminal-client.ts/terminal-store";
import { toast } from "@workspace/ui/components/toast";
import { LoginUserSchema } from "@workspace/shared";
import { loginUser } from "@/lib/api-client/auth-manager";
import { AuthSession, clearAuthSession, getAuthession, saveAuthSession } from "@/lib/auth-client";

export function SigninForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [storedUsername, setStoredUsername] = useState<string | null>(null);
    const { append } = useTerminal();
    // const { history, capture, recordError } = useResponseCapture();

    function validateUserSignin(): boolean {
        const validateRequest = LoginUserSchema.safeParse({ username, password });
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

    function resetForm() {
        setUsername("");
        setPassword("");
    }

    useEffect(() => {
        const timer = setTimeout(() => setStoredUsername(getAuthession()?.user.username ?? null), 0);
        return () => clearTimeout(timer);
    }, [])

    async function submit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        event.stopPropagation();
        setLoading(true);

        const isValid = validateUserSignin();

        if (!isValid) return;

        append({
            requestType: "REQ",
            requestMethod: "POST",
            endpoint: "/api/v1/auth/signin",
            message: `Sending user register request`,
        });

        try {
            const res = await loginUser({ username, password });

            if (res.success) {
                saveAuthSession(res.data as AuthSession);
                setStoredUsername(username);
            }

            append(res);
            toast.add({
                title: res.success === false ? "Backend Response Error" : "Backend Response",
                description: res.message,
            })

        } catch {

            append({
                requestType: "REQ",
                requestMethod: "POST",
                endpoint: "/api/vi/signin",
                message: `Something went wrong`,
            });

        } finally {
            resetForm();
            setLoading(false);
        }
    }

    return (
        <Panel
            title="auth.signin"
            right={
                <Button
                    onClick={() => void resetForm()}
                    disabled={loading}
                    className="hover:text-term-yellow border-0 disabled:opacity-50"
                >
                    {loading ? "[checking]" : "[reset]"}
                </Button>
            }
        >
            <form onSubmit={submit} className="space-y-3 p-4 text-[12px]">
                <Field
                    label="username"
                >
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={inputStyle}
                    />
                </Field>

                <Field label="password">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputStyle} />
                </Field>

                <div className="flex items-center gap-2 pt-2">
                    <button className={buttonStyle}>
                        {loading ? "submitting..." : "$ ./signin"}
                    </button>
                    <span className="text-term-dim">POST /api/v1/auth/signin</span>
                </div>

                <pre className="mt-4 border border-border bg-secondary p-2 text-term-dim">{`// payload
{
  "username": ${JSON.stringify(username)},
  "password": "${"*".repeat(password.length)}"
}`}</pre>
                <div className="flex items-center justify-between border-t border-border pt-2 text-term-dim">
                    <span>{storedUsername ? `stored session: ${storedUsername}` : "stored session: none"}</span>
                    <button
                        type="button"
                        className="hover:text-term-yellow"
                        onClick={() => {
                            clearAuthSession();
                            setStoredUsername(null);
                        }}
                    >
                        [clear token]
                    </button>
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