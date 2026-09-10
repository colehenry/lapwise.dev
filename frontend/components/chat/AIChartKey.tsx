interface AIChartKeyItem {
  color: string;
  label: string;
  value?: string;
}

export default function AIChartKey({
  items,
  vertical = false,
}: {
  items: AIChartKeyItem[];
  vertical?: boolean;
}) {
  return (
    <ul
      className={
        vertical ? "grid gap-2" : "flex min-w-0 flex-wrap gap-x-4 gap-y-2"
      }
      aria-label="Chart key"
    >
      {items.map((item) => (
        <li
          key={item.label}
          className="flex min-w-0 items-center gap-2 text-xs"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span className="truncate font-semibold text-text-secondary">
            {item.label}
          </span>
          {item.value && (
            <span className="ml-auto shrink-0 tabular-nums text-text-muted">
              {item.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
