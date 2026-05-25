"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { deletePost, updatePost, uploadFile, type CollabPost } from "../lib/db";

const MAX_IMAGES = 5;

type LocalAsset = { kind: "local"; file: File; previewUrl: string };
type RemoteAsset = { kind: "remote"; url: string };
type Asset = LocalAsset | RemoteAsset;

export default function EditPostDialog({
  userId,
  post,
  onClose,
  onSaved,
  onDeleted,
}: {
  userId: string;
  post: CollabPost | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  return (
    <Dialog open={!!post} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
        {post ? (
          <EditPostInner
            key={post.id}
            userId={userId}
            post={post}
            onClose={onClose}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditPostInner({
  userId,
  post,
  onClose,
  onSaved,
  onDeleted,
}: {
  userId: string;
  post: CollabPost;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description ?? "");
  const [lookingFor, setLookingFor] = useState(post.looking_for?.join(", ") ?? "");
  const [location, setLocation] = useState(post.location ?? "");
  const [compensation, setCompensation] = useState(post.compensation ?? "");
  const [assets, setAssets] = useState<Asset[]>(
    (post.media_urls ?? []).map<RemoteAsset>((url) => ({ kind: "remote", url }))
  );
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_IMAGES - assets.length;
    const incoming = Array.from(files).slice(0, remaining);
    const newAssets: LocalAsset[] = incoming.map((file) => ({
      kind: "local",
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setAssets((prev) => [...prev, ...newAssets]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAsset = (idx: number) => {
    setAssets((prev) => {
      const target = prev[idx];
      if (target?.kind === "local") URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setBusy(true);
    setError("");

    const finalUrls: string[] = [];
    for (const a of assets) {
      if (a.kind === "remote") {
        finalUrls.push(a.url);
      } else {
        const { url, error: upErr } = await uploadFile(userId, "posts", a.file);
        if (upErr || !url) {
          setBusy(false);
          setError(upErr || "Image upload failed.");
          return;
        }
        finalUrls.push(url);
      }
    }

    const lookingForArr = lookingFor.split(",").map((s) => s.trim()).filter(Boolean);

    const { error: updErr } = await updatePost(post.id, {
      title: title.trim(),
      description: description.trim(),
      looking_for: lookingForArr.length ? lookingForArr : null,
      location: location.trim() || null,
      compensation: compensation.trim() || null,
      media_urls: finalUrls.length ? finalUrls : null,
    });

    setBusy(false);
    if (updErr) {
      setError(updErr);
      return;
    }
    await onSaved();
    onClose();
  };

  const doDelete = async () => {
    setBusy(true);
    setError("");
    const { error: delErr } = await deletePost(post.id);
    setBusy(false);
    if (delErr) {
      setError(delErr);
      return;
    }
    await onDeleted();
    onClose();
  };

  return (
    <>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <DialogTitle className="text-base font-semibold text-gray-900">Edit post</DialogTitle>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <DialogDescription className="sr-only">Edit or delete this post</DialogDescription>

        {confirmingDelete ? (
          <div className="p-5 space-y-3">
            <h3 className="text-base font-semibold text-gray-900">Delete this post?</h3>
            <p className="text-sm text-gray-500">
              This permanently removes the post from the swipe feed. Existing matches you created from this post
              will keep working.
            </p>
            {error ? (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>
            ) : null}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={doDelete}
                disabled={busy}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete post"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Looking for (comma-separated)</Label>
              <Input value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Compensation</Label>
              <Input value={compensation} onChange={(e) => setCompensation(e.target.value)} className="rounded-xl" />
            </div>

            <div>
              <Label className="text-xs text-gray-500 mb-1">Images (up to {MAX_IMAGES})</Label>
              <div className="flex flex-wrap gap-2">
                {assets.map((a, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                    <img
                      src={a.kind === "remote" ? a.url : a.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAsset(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/55 rounded-full flex items-center justify-center text-white"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {assets.length < MAX_IMAGES ? (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Add</span>
                  </button>
                ) : null}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => addImages(e.target.files)}
              />
            </div>

            {error ? (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="px-3 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
    </>
  );
}
