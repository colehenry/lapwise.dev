"use client";

import { useCallback, useEffect, useState } from "react";
import { GridPattern } from "@/components/Patterns";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { createTag, deleteTag, updateTag } from "@/lib/admin";
import { fetchTags } from "@/lib/discussions";
import { DEFAULT_TAG_COLOR } from "@/lib/palette";
import type { DiscussionTag } from "@/lib/types";

export default function AdminTagsPage() {
  const [tags, setTags] = useState<DiscussionTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<number | null>(null);

  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_TAG_COLOR);
  const [category, setCategory] = useState("");

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTags();
      setTags(data);
    } catch (_err) {
      setError("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const resetForm = () => {
    setIsEditing(null);
    setName("");
    setColor(DEFAULT_TAG_COLOR);
    setCategory("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateTag(isEditing, {
          name,
          color,
          category: category || undefined,
        });
      } else {
        await createTag({ name, color, category: category || undefined });
      }
      resetForm();
      loadTags();
    } catch (_err) {
      alert("Failed to save tag");
    }
  };

  const handleEdit = (tag: DiscussionTag) => {
    setIsEditing(tag.id);
    setName(tag.name);
    setColor(tag.color);
    setCategory(tag.category || "");
  };

  const handleDelete = (tagId: number) => {
    setDeleteDialog(tagId);
  };

  const handleConfirmDelete = async () => {
    if (deleteDialog === null) return;
    try {
      await deleteTag(deleteDialog);
      loadTags();
    } catch (_err) {
      // Error handling
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialog(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Tag Management
          </h1>
          <p className="text-sm text-text-muted">
            Create and manage categories for discussions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card
            padding="sm"
            className="border-border-primary relative overflow-hidden"
          >
            <GridPattern
              id="tags-form"
              className="text-purple-500 opacity-[0.04]"
            />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-sm bg-purple-500/12 border border-purple-500/30 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-text-primary">
                  {isEditing ? "Edit Tag" : "Create New Tag"}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="tag-name"
                    className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2 font-mono"
                  >
                    Name
                  </label>
                  <Input
                    id="tag-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Technical Analysis"
                    required
                    className="bg-bg-tertiary"
                  />
                </div>
                <div>
                  <label
                    htmlFor="tag-color"
                    className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2 font-mono"
                  >
                    Color
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="tag-color-picker"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-14 h-10 p-1 bg-bg-tertiary cursor-pointer"
                    />
                    <Input
                      id="tag-color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#hexcode"
                      className="flex-1 bg-bg-tertiary font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="tag-category"
                    className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2 font-mono"
                  >
                    Category (Optional)
                  </label>
                  <Input
                    id="tag-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. General"
                    className="bg-bg-tertiary"
                  />
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <Button type="submit" fullWidth>
                    {isEditing ? "Update Tag" : "Create Tag"}
                  </Button>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="secondary"
                      fullWidth
                      onClick={resetForm}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            padding="none"
            className="border-border-primary overflow-hidden"
          >
            <div className="relative">
              <GridPattern
                id="tags-table"
                className="text-purple-500 opacity-[0.03]"
              />
              <div className="overflow-x-auto relative">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-primary bg-bg-secondary">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                        Tag
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono">
                        Category
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {tags.map((tag) => (
                      <tr
                        key={tag.id}
                        className="text-sm hover:bg-bg-secondary/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full shadow-sm"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="font-bold text-text-primary">
                              {tag.name}
                            </span>
                            <Badge
                              variant="neutral"
                              size="sm"
                              className="font-mono lowercase text-[10px]"
                            >
                              {tag.slug}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-text-muted text-xs">
                          {tag.category || (
                            <span className="italic opacity-50">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit(tag)}
                              className="text-xs h-8"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(tag.id)}
                              className="text-xs h-8 text-red-400 hover:text-red-300"
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tags.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-12 text-center text-text-muted italic bg-bg-tertiary/20"
                        >
                          No tags found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialog !== null}
        title="Delete Tag"
        message="Are you sure you want to delete this tag? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
