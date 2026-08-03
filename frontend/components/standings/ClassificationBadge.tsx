export default function ClassificationBadge({ status }: { status: string }) {
  if (status === "classified" || status === "provisional") return null;
  return (
    <span className="mt-1 w-fit rounded-sm border border-border-secondary px-1 py-0.5 font-mono text-[8px] uppercase text-text-muted">
      {status.replace("_", " ")}
    </span>
  );
}
