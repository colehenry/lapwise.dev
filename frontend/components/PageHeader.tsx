"use client";

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  leftContent?: ReactNode;
  children?: ReactNode; // For actions like JumpToRace, search, etc.
  bottomContent?: ReactNode; // For tabs or other bottom elements
}

export default function PageHeader({
  title,
  subtitle,
  onBack,
  backLabel = "BACK",
  leftContent,
  children,
  bottomContent,
}: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-40">
      <div className="px-4">
        <div className="mx-auto w-full max-w-full md:max-w-[calc(72rem+40px)]">
          <div className="bg-bg-secondary/95 backdrop-blur-xl border-x border-b border-border-primary rounded-b-3xl rounded-t-none shadow-[0_10px_36px_rgba(0,0,0,0.35)]">
            <div
              className={`h-16 px-6 flex items-center relative ${bottomContent ? "border-b border-border-primary/60" : ""}`}
            >
              {/* Left: Back Button or Custom Content */}
              <div className="flex-1 flex items-center gap-4">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-4 py-2 rounded-sm hover:border-purple-500 hover:text-purple-300 transition-colors duration-150 cursor-pointer flex items-center gap-2"
                  >
                    <span>←</span>
                    <span className="hidden sm:inline uppercase">
                      {backLabel}
                    </span>
                  </button>
                ) : (
                  leftContent
                )}
              </div>

              {/* Center: Title & Subtitle */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center w-full max-w-[40%] pointer-events-none">
                <div className="text-text-primary font-mono text-sm font-bold leading-none uppercase tracking-tight pointer-events-auto truncate w-full">
                  {title}
                </div>
                {subtitle && (
                  <span className="text-text-muted text-[10px] tracking-widest uppercase font-bold mt-1 pointer-events-auto truncate w-full">
                    {subtitle}
                  </span>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex-1 flex items-center justify-end gap-2">
                {children}
              </div>
            </div>

            {/* Bottom Content (e.g., Tabs) */}
            {bottomContent && <div className="px-4 pb-2">{bottomContent}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
