import type { Metadata } from "next";
import { Manrope, Space_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import KBarWrapper from "@/components/KBarWrapper";

const manrope = Manrope({
  weight: ["300", "400", "500", "700", "800"],
  variable: "--font-manrope",
  subsets: ["latin"],
});

// const rubik = Rubik({
//   weight: ["300", "400", "500", "700"],
//   variable: "--font-recursive",
//   subsets: ["latin"],
// });

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-space-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio Manager",
  description: "Track your Indian investments — stocks, mutual funds, PPF, FD, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${spaceMono.variable} font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':true;if(t==='system'){d=window.matchMedia('(prefers-color-scheme: dark)').matches}document.documentElement.classList.add(d?'dark':'light')}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
        <ThemeProvider>
          <KBarWrapper>
            <AppShell>{children}</AppShell>
            <Toaster richColors position="top-center" />
          </KBarWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
