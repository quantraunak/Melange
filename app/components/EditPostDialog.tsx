"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { deletePost, updatePost, uploadFile, type CollabPost } from "../lib/db";

const MAX_IMAGES = 5;

type LocalAsset = { kind: "local"; file: File; previewUrl: string };
type RemoteAsset = { kind: "remote"; url: string };
type Asset = LocalAsset | RemoteAsset;

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] mb-1.5"
    >
      {children}
    </label>
  );
}

function MInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`melange-input w-full ${props.className ?? ""}`} />;
}

function MTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`melange-input w-full resize-none ${props.className ?? ""}`} />;
}

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
      <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto p-0 rounded-[var(--radius-xl)] border-[var(--line)] bg-[var(--surface)]">
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
      <div className="px-5 py-4 border-b border-[var(--line)] flex items-start justify-between sticky top-0 bg-[var(--surface)] z-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)] font-medium">Edit</p>
          <DialogTitle className="font-display text-[20px] tracking-tight text-[var(--ink)] mt-0.5">
            Your post
          </DialogTitle>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-3)] hover:bg-[var(--secondary)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <DialogDescription className="sr-only">Edit or delete this post</DialogDescription>

      {confirmingDelete ? (
        <div className="p-6 space-y-4">
          <div className="bg-[color-mix(in_oklab,var(--destructive)_6%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-lg)] p-4">
            <h3 className="font-display text-[18px] tracking-tight text-[var(--destructive)]">Delete this post?</h3>
            <p className="text-[13px] text-[var(--ink-2)] mt-2 leading-relaxed">
              This permanently removes the post from the swipe feed. Existing matches you created from this post
              will keep working.
            </p>
          </div>
          {error ? (
            <p className="text-[12px] text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-md)] p-2.5">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
              className="flex-1 h-11 border border-[var(--line)] rounded-[var(--radius-lg)] text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={doDelete}
              disabled={busy}
              className="flex-1 h-11 bg-[var(--destructive)] text-white rounded-[var(--radius-lg)] text-[14px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Deleting…" : "Delete post"}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div>
            <FieldLabel htmlFor="ep-title">Title</FieldLabel>
            <MInput id="ep-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ep-desc">Description</FieldLabel>
            <MTextarea id="ep-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ep-lf">Looking for</FieldLabel>
            <MInput id="ep-lf" value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} placeholder="Comma-separated roles" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="ep-loc">Location</FieldLabel>
              <MInput id="ep-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="ep-comp">Compensation</FieldLabel>
              <MInput id="ep-comp" value={compensation} onChange={(e) => setCompensation(e.target.value)} />
            </div>
          </div>

          <div>
            <FieldLabel>Reference images (up to {MAX_IMAGES})</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {assets.map((a, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-[var(--radius-md)] overflow-hidden ring-1 ring-[var(--line)]">
                  <img
                    src={a.kind === "remote" ? a.url : a.previewUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAsset(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/65 backdrop-blur rounded-full flex items-center justify-center text-white"
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
                  className="w-20 h-20 border border-dashed border-[var(--line)] rounded-[var(--radius-md)] flex flex-col items-center justify-center gap-1 text-[var(--ink-3)] hover:border-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">Add</span>
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
            <p className="text-[12px] text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-md)] p-2.5">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="h-11 px-4 border border-[var(--line)] text-[var(--destructive)] rounded-[var(--radius-lg)] text-[14px] font-medium hover:bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 h-11 bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[14px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
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
