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
  compactMobile?: boolean;
}

export default function PageHeader({
  title,
  subtitle,
  onBack,
  backLabel = "BACK",
  leftContent,
  children,
  bottomContent,
  compactMobile = false,
}: PageHeaderProps) {
  const hasLeftContent = Boolean(onBack || leftContent);

  return (
    <div className="sticky top-0 z-40">
      <div className="px-2 md:px-4">
        <div className="mx-auto w-full max-w-full md:max-w-[calc(72rem+40px)]">
          <div className="bg-bg-secondary/95 backdrop-blur-xl border-x border-b border-border-primary rounded-b-lg md:rounded-b-3xl rounded-t-none shadow-[0_10px_36px_rgba(0,0,0,0.35)]">
            <div
              className={`px-3 py-2 md:h-16 md:px-6 md:py-0 ${compactMobile ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3" : "grid grid-cols-[auto_minmax(0,1fr)] gap-2"} md:flex md:items-center relative ${bottomContent ? "border-b border-border-primary/60" : ""}`}
            >
              {/* Left: Back Button or Custom Content */}
              {hasLeftContent && (
                <div
                  className={`${compactMobile ? "order-2 justify-end" : "order-2"} md:order-1 min-w-0 md:w-full md:flex-1 flex items-center gap-4`}
                >
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
              )}

              {/* Center: Title & Subtitle */}
              <div
                className={`${compactMobile ? "order-1 items-start text-left" : "order-1 col-span-2 items-center text-center"} md:col-span-1 md:order-2 md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 flex flex-col w-full md:max-w-[40%] md:items-center md:text-center pointer-events-none`}
              >
                <div className="text-text-primary font-mono text-xs md:text-sm font-bold leading-none uppercase tracking-tight pointer-events-auto truncate w-full">
                  {title}
                </div>
                {subtitle && (
                  <span className="text-text-muted text-[9px] md:text-[10px] tracking-widest uppercase font-bold mt-0.5 md:mt-1 pointer-events-auto truncate w-full">
                    {subtitle}
                  </span>
                )}
              </div>

              {/* Right: Actions */}
              {children && (
                <div
                  className={`${compactMobile && hasLeftContent ? "order-3 col-span-2 w-full justify-stretch [&>*]:w-full sm:[&>*]:w-auto" : compactMobile ? "order-2 justify-end" : "order-3 justify-end"} min-w-0 md:flex-1 flex items-stretch md:items-center md:justify-end gap-2`}
                >
                  {children}
                </div>
              )}
            </div>

            {/* Bottom Content (e.g., Tabs) */}
            {bottomContent && (
              <div className="px-2 pb-2 md:px-4">{bottomContent}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
