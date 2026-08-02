"use client";

import { KBarProvider, Action } from "kbar";
import { useRouter } from "next/navigation";
import KBarSearchModal from "./KBarSearchModal";

export default function KBarWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    // Define static shortcut actions
    const actions: Action[] = [
        {
            id: "home",
            name: "Home",
            shortcut: ["h"],
            keywords: "back home index",
            section: "Navigation",
            perform: () => router.push("/"),
        },
        {
            id: "dashboard",
            name: "Dashboard",
            shortcut: ["d"],
            keywords: "admin dashboard metrics",
            section: "Navigation",
            perform: () => router.push("/dashboard"),
        },
        {
            id: "theme",
            name: "Toggle Dark Mode",
            shortcut: ["t"],
            keywords: "light dark appearance theme",
            section: "Settings",
            perform: () => {
                document.documentElement.classList.toggle("dark");
            },
        },
    ];

    return (
        <KBarProvider actions={actions}>
            <KBarSearchModal />
            {children}
        </KBarProvider>
    );
}
