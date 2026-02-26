interface Tab<T extends string> {
  key: T;
  label: string;
  disabled?: boolean;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export default function TabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: TabBarProps<T>) {
  return (
    <div className="flex items-center gap-1 -mb-px overflow-x-auto pb-0">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => !tab.disabled && onTabChange(tab.key)}
            disabled={tab.disabled}
            className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-widest transition-colors duration-150 border-b-2 whitespace-nowrap ${
              isActive
                ? "border-purple-500 text-purple-300"
                : tab.disabled
                  ? "border-transparent text-text-muted/40 cursor-not-allowed"
                  : "border-transparent text-text-muted hover:text-text-secondary hover:border-border-primary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
