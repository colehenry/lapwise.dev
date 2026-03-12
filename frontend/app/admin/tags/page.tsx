"use client";

import { useEffect, useState } from "react";
import { fetchTags } from "@/lib/discussions";
import { createTag, updateTag, deleteTag } from "@/lib/admin";
import type { DiscussionTag } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";

export default function AdminTagsPage() {
  const [tags, setTags] = useState<DiscussionTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [category, setCategory] = useState("");

  async function loadTags() {
    setLoading(true);
    try {
      const data = await fetchTags();
      setTags(data);
    } catch (err) {
      setError("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTags();
  }, []);

  const resetForm = () => {
    setIsEditing(null);
    setName("");
    setColor("#8b5cf6");
    setCategory("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateTag(isEditing, { name, color, category: category || undefined });
      } else {
        await createTag({ name, color, category: category || undefined });
      }
      resetForm();
      loadTags();
    } catch (err) {
      alert("Failed to save tag");
    }
  };

  const handleEdit = (tag: DiscussionTag) => {
    setIsEditing(tag.id);
    setName(tag.name);
    setColor(tag.color);
    setCategory(tag.category || "");
  };

  const handleDelete = async (tagId: number) => {
    if (!confirm("Are you sure you want to delete this tag?")) return;
    try {
      await deleteTag(tagId);
      loadTags();
    } catch (err) {
      alert("Failed to delete tag");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-text-primary">Tag Management</h1>
        <p className="text-text-muted">Create and manage categories for discussions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1">
          <Card className="border-border-primary">
            <h2 className="text-xl font-bold mb-6 text-text-primary">
              {isEditing ? "Edit Tag" : "Create New Tag"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Name</label>
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Technical Analysis" 
                  required
                  className="bg-bg-tertiary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Color</label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)} 
                    className="w-14 h-10 p-1 bg-bg-tertiary cursor-pointer"
                  />
                  <Input 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)} 
                    placeholder="#hexcode" 
                    className="flex-1 bg-bg-tertiary font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Category (Optional)</label>
                <Input 
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
                  <Button type="button" variant="secondary" fullWidth onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <Card padding="none" className="border-border-primary overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-secondary text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    <th className="px-6 py-4">Tag</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {tags.map((tag) => (
                    <tr key={tag.id} className="text-sm hover:bg-bg-secondary/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full shadow-sm" 
                            style={{ backgroundColor: tag.color }} 
                          />
                          <span className="font-bold text-text-primary">{tag.name}</span>
                          <Badge variant="neutral" size="sm" className="font-mono lowercase text-[10px]">
                            {tag.slug}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-muted text-xs">
                        {tag.category || <span className="italic opacity-50">None</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handleEdit(tag)} className="text-xs h-8">
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(tag.id)} className="text-xs h-8 text-red-400 hover:text-red-300">
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tags.length === 0 && !loading && (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-text-muted italic bg-bg-tertiary/20">
                        No tags found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
