import TagPill from "@/components/discussions/TagPill";
import type { DiscussionTag } from "@/lib/types";

interface TagFilterProps {
  tags: DiscussionTag[];
  activeTag: string | null;
  onChange: (tag: string | null) => void;
}

export default function TagFilter({
  tags,
  activeTag,
  onChange,
}: TagFilterProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <TagPill label="All" active={!activeTag} onClick={() => onChange(null)} />
      {tags.map((tag) => (
        <TagPill
          key={tag.id}
          label={tag.name}
          color={tag.color}
          active={activeTag === tag.slug}
          onClick={() => onChange(tag.slug)}
        />
      ))}
    </div>
  );
}
