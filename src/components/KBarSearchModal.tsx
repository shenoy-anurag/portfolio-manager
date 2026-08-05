"use client";

import {
    KBarPortal,
    KBarPositioner,
    KBarAnimator,
    KBarSearch,
    KBarResults,
    useMatches
} from "kbar";

export default function KBarSearchModal() {
    return (
        <KBarPortal>
            {/* Background overlay */}
            <KBarPositioner className="bg-black/40 backdrop-blur-sm fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
                <KBarAnimator className="w-full max-w-xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">

                    {/* Input field */}
                    <KBarSearch className="w-full px-4 py-4 text-base bg-transparent border-b border-zinc-200 dark:border-zinc-800 outline-none placeholder-zinc-400 text-zinc-900 dark:text-zinc-100" placeholder="Type a command or search..." />

                    {/* Results List */}
                    <div className="p-2">
                        <RenderResults />
                    </div>

                </KBarAnimator>
            </KBarPositioner>
        </KBarPortal>
    );
}

// Subcomponent to list out the available actions
function RenderResults() {
    const { results } = useMatches();

    return (
        <KBarResults
            items={results}
            onRender={({ item, active }) =>
                typeof item === "string" ? (
                    // Renders group headers (e.g., "Navigation", "Actions")
                    <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        {item}
                    </div>
                ) : (
                    // Renders individual action items
                    <div
                        className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${active
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-600 dark:text-zinc-400"
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            {item.icon && <span>{item.icon}</span>}
                            <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        {item.shortcut?.length ? (
                            <div className="flex gap-1">
                                {item.shortcut.map((sc) => (
                                    <kbd key={sc} className="px-1.5 py-0.5 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-500 rounded border border-zinc-300 dark:border-zinc-600">
                                        {sc}
                                    </kbd>
                                ))}
                            </div>
                        ) : null}
                    </div>
                )
            }
        />
    );
}
