import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/debug.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils";
import { Toaster } from "@workspace/ui/components/toast";
import { Shell } from "@/components/ui/Shell";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>
          <Shell >
            {children}
            <Toaster />
          </Shell>
        </ThemeProvider>
      </body>
    </html>
  )
}
