"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function useTabSync<T extends string>(basePath: string, defaultTab: T) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlTab = searchParams.get("tab") as T | null;
  const [activeTab, setActiveTab] = useState<T>(urlTab || defaultTab);

  useEffect(() => {
    if (urlTab) setActiveTab(urlTab);
  }, [urlTab]);

  const switchTab = (tab: T) => {
    setActiveTab(tab);
    const url = tab === defaultTab ? basePath : `${basePath}?tab=${tab}`;
    router.replace(url, { scroll: false });
  };

  return { activeTab, switchTab };
}
