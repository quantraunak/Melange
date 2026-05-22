"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  blockUser,
  checkAndCreateMatch,
  createPost,
  getMatches,
  getMessages,
  getMyPosts,
  getProfile,
  getUnswipedPosts,
  isMatchUnread,
  markMatchRead,
  PORTFOLIO_MAX_IMAGES,
  recordSwipe,
  sendMessage,
  updatePortfolio,
  updateProfile,
  uploadFile,
  type CollabPost,
  type CreatorInfo,
  type MatchWithPost,
  type Message,
  type PostWithCreator,
  type Profile,
} from "../lib/db";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Flag,
  Heart,
  ImagePlus,
  Info,
  Loader2,
  LogOut,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";

import ReportDialog from "./ReportDialog";
import EditPostDialog from "./EditPostDialog";
import AccountSafetyDialog from "./AccountSafetyDialog";
import EventsView from "./EventsView";
import PortfolioLightbox from "./PortfolioLightbox";

type Tab = "connect" | "events" | "messages" | "profile";

// ============================================================
// Atoms — small, reused, themed against Melange tokens
// ============================================================

function Wordmark() {
  return (
    <span className="font-display text-[22px] leading-none tracking-tight text-[var(--ink)]">
      melange<span className="text-[var(--accent)]">.</span>
    </span>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({
  creator,
  size = "md",
}: {
  creator: Pick<CreatorInfo, "name" | "avatar_url" | "role"> & { name: string };
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dims =
    size === "sm"
      ? "w-8 h-8 text-xs"
      : size === "lg"
      ? "w-16 h-16 text-xl"
      : size === "xl"
      ? "w-24 h-24 text-3xl"
      : "w-10 h-10 text-sm";

  if (creator.avatar_url) {
    return (
      <img
        src={creator.avatar_url}
        alt={creator.name}
        className={`${dims} rounded-full object-cover flex-shrink-0 ring-1 ring-[var(--line)]`}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-full bg-[var(--secondary)] text-[var(--ink)] font-display font-medium flex items-center justify-center flex-shrink-0 ring-1 ring-[var(--line)]`}
    >
      {creator.name.charAt(0).toUpperCase()}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)] font-medium">
      {children}
    </p>
  );
}

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
      <span className="text-[var(--ink-3)] flex-shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--secondary)] text-[12px] text-[var(--ink-2)] tracking-tight">
      {children}
    </span>
  );
}

// Inputs — opinionated, replace shadcn for the auth-app interior

function MInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`melange-input w-full ${className}`} />;
}

function MTextarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`melange-input w-full resize-none ${className}`} />;
}

function MFieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] mb-1.5"
    >
      {children}
    </label>
  );
}

// ============================================================
// Portfolio sub-components — themed
// ============================================================

function PortfolioEditor({
  urls,
  busy,
  error,
  onAdd,
  onRemove,
  onReorder,
  onView,
}: {
  urls: string[];
  busy: boolean;
  error: string;
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (idx: number) => void;
  onReorder: (idx: number, delta: -1 | 1) => void;
  onView: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canAdd = urls.length < PORTFOLIO_MAX_IMAGES;
  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="font-display text-[20px] tracking-tight text-[var(--ink)]">Portfolio</h2>
          <p className="text-[12px] text-[var(--ink-3)] mt-0.5">
            Show your work. Up to {PORTFOLIO_MAX_IMAGES} images.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canAdd || busy}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 border border-[var(--line)] rounded-full text-[var(--ink)] hover:bg-[var(--secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3 w-3" /> Add image
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onAdd}
        />
      </div>

      {urls.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full py-10 border border-dashed border-[var(--line)] rounded-[var(--radius-lg)] text-center text-[var(--ink-3)] hover:border-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors"
        >
          <ImagePlus className="h-5 w-5 mx-auto mb-2" />
          <p className="text-[13px] font-medium text-[var(--ink-2)]">Show your best work</p>
          <p className="text-[12px] text-[var(--ink-3)] mt-0.5">Tap to add images</p>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {urls.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--secondary)] group"
            >
              <button
                type="button"
                onClick={() => onView(idx)}
                className="absolute inset-0"
                aria-label="View image"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                disabled={busy}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/65 backdrop-blur rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
              {idx > 0 ? (
                <button
                  type="button"
                  onClick={() => onReorder(idx, -1)}
                  disabled={busy}
                  className="absolute bottom-1.5 left-1.5 w-6 h-6 bg-black/65 backdrop-blur rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                  aria-label="Move left"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
              ) : null}
              {idx < urls.length - 1 ? (
                <button
                  type="button"
                  onClick={() => onReorder(idx, 1)}
                  disabled={busy}
                  className="absolute bottom-1.5 right-1.5 w-6 h-6 bg-black/65 backdrop-blur rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                  aria-label="Move right"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
    </div>
  );
}

function PortfolioStrip({
  urls,
  name,
  onOpen,
}: {
  urls: string[];
  name: string;
  onOpen: (startIndex: number) => void;
}) {
  if (!urls?.length) return null;
  return (
    <div className="px-5 pb-4 pt-3 border-t border-[var(--line)]">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-3)] mb-2.5">
        More from {name}
      </p>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: "thin" }}>
        {urls.slice(0, 9).map((u, i) => (
          <button
            key={`${u}-${i}`}
            type="button"
            onClick={() => onOpen(i)}
            className="flex-shrink-0 w-16 h-16 rounded-[var(--radius-md)] overflow-hidden bg-[var(--secondary)] hover:opacity-85 transition-opacity"
            aria-label={`View portfolio image ${i + 1}`}
          >
            <img src={u} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function PortfolioGrid({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (startIndex: number) => void;
}) {
  if (!urls?.length) return null;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {urls.map((u, i) => (
        <button
          key={`${u}-${i}`}
          type="button"
          onClick={() => onOpen(i)}
          className="aspect-square rounded-[var(--radius-md)] overflow-hidden bg-[var(--secondary)] hover:opacity-85 transition-opacity"
        >
          <img src={u} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Image gallery — clean, full-bleed, dot pagination
// ============================================================

function ImageGallery({
  urls,
  aspect = "aspect-[4/5]",
}: {
  urls: string[];
  aspect?: string;
}) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) {
    return (
      <div className={`${aspect} bg-[var(--secondary)] flex items-center justify-center`}>
        <span className="font-display italic text-[var(--ink-3)] text-sm tracking-tight">
          no images yet
        </span>
      </div>
    );
  }
  return (
    <div className={`relative ${aspect} bg-[var(--secondary)] overflow-hidden`}>
      <img src={urls[idx]} alt="" className="w-full h-full object-cover" />
      {urls.length > 1 ? (
        <>
          <button
            onClick={() => setIdx((i) => (i === 0 ? urls.length - 1 : i - 1))}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white backdrop-blur flex items-center justify-center shadow-sm"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4 text-[var(--ink)]" />
          </button>
          <button
            onClick={() => setIdx((i) => (i === urls.length - 1 ? 0 : i + 1))}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white backdrop-blur flex items-center justify-center shadow-sm"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4 text-[var(--ink)]" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {urls.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === idx ? "bg-white w-6" : "bg-white/55 w-1.5"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-md)] p-2.5 mt-3">
      {children}
    </p>
  );
}

function PrimaryButton({
  type = "button",
  loading,
  disabled,
  onClick,
  children,
  className = "",
}: {
  type?: "button" | "submit";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`h-11 inline-flex items-center justify-center gap-2 bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[14px] font-medium tracking-tight px-4 hover:opacity-90 disabled:opacity-50 transition-opacity ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function GhostButton({
  onClick,
  children,
  className = "",
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--line)] bg-[var(--surface)] text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--secondary)] transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

// ============================================================
// Root app
// ============================================================

export default function MelangeApp({ onSignOut }: { onSignOut: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("connect");

  // Connect
  const [posts, setPosts] = useState<PostWithCreator[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [connectErr, setConnectErr] = useState("");
  const [detailPost, setDetailPost] = useState<PostWithCreator | null>(null);
  const [connectSearch, setConnectSearch] = useState("");
  const [matchToast, setMatchToast] = useState<string | null>(null);

  // Create Post
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostDescription, setNewPostDescription] = useState("");
  const [newPostLookingFor, setNewPostLookingFor] = useState("");
  const [newPostLocation, setNewPostLocation] = useState("");
  const [newPostCompensation, setNewPostCompensation] = useState("");
  const [creatingPost, setCreatingPost] = useState(false);
  const [createPostError, setCreatePostError] = useState("");
  const [newPostImages, setNewPostImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const newPostImagesInputRef = useRef<HTMLInputElement>(null);

  // Messages
  const [matches, setMatches] = useState<MatchWithPost[]>([]);
  const [matchErr, setMatchErr] = useState("");
  const [chatMatch, setChatMatch] = useState<MatchWithPost | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPosts, setMyPosts] = useState<CollabPost[]>([]);
  const [editingPost, setEditingPost] = useState<CollabPost | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    role: "",
    bio: "",
    currentProject: "",
    skills: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAccountSafety, setShowAccountSafety] = useState(false);

  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [portfolioError, setPortfolioError] = useState("");

  const [lightbox, setLightbox] = useState<{
    urls: string[];
    index: number;
    creatorName?: string;
  } | null>(null);

  const [reportTarget, setReportTarget] = useState<{
    kind: "user" | "post" | "message";
    id: string;
    label?: string;
  } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // --- Data loading ---

  const loadUser = async () => {
    const { data: authRes, error: authErr } = await supabase.auth.getUser();
    if (authErr) { setConnectErr(authErr.message); return; }
    setUserId(authRes?.user?.id ?? null);
  };

  const loadPosts = useCallback(async () => {
    if (!userId) return;
    setConnectErr(""); setLoading(true);
    const { data, error } = await getUnswipedPosts(userId);
    if (error) { setConnectErr(error); setLoading(false); return; }
    setPosts(data || []); setCurrentPostIndex(0); setLoading(false);
  }, [userId]);

  const loadMatches = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await getMatches(userId);
    if (error) { setMatchErr(error); return; }
    setMatches(data || []);
  }, [userId]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await getProfile(userId);
    if (data) {
      setProfile(data);
      setProfileForm({
        name: data.name || "",
        role: data.role || "",
        bio: data.bio || "",
        currentProject: data.current_project || "",
        skills: data.skills?.join(", ") || "",
      });
    }
  }, [userId]);

  const loadMyPosts = useCallback(async () => {
    if (!userId) return;
    const { data } = await getMyPosts(userId);
    setMyPosts(data || []);
  }, [userId]);

  // --- Derived state ---

  const visiblePosts = (() => {
    if (!connectSearch.trim()) return posts;
    const q = connectSearch.toLowerCase();
    return posts.filter((post) =>
      post.title.toLowerCase().includes(q) ||
      (post.description?.toLowerCase().includes(q) ?? false) ||
      (post.location?.toLowerCase().includes(q) ?? false) ||
      (post.compensation?.toLowerCase().includes(q) ?? false) ||
      (post.looking_for?.some((lf) => lf.toLowerCase().includes(q)) ?? false) ||
      post.creator.name.toLowerCase().includes(q) ||
      (post.creator.role?.toLowerCase().includes(q) ?? false)
    );
  })();

  const unreadCount = userId ? matches.filter((m) => isMatchUnread(m, userId)).length : 0;

  // --- Handlers ---

  const handleSwipe = async (direction: "left" | "right") => {
    if (!userId || swiping || visiblePosts.length === 0) return;
    const post = visiblePosts[currentPostIndex];
    if (!post) return;
    setSwiping(true); setConnectErr("");
    const { error: swipeError } = await recordSwipe(userId, post.id, direction);
    if (swipeError) { setConnectErr(swipeError); setSwiping(false); return; }
    if (direction === "right") {
      const { match, error: matchError } = await checkAndCreateMatch(userId, post.id);
      if (matchError) setConnectErr(matchError);
      else if (match) {
        await loadMatches();
        setMatchToast(`You matched with ${post.creator.name}.`);
        setTimeout(() => setMatchToast(null), 2800);
      }
    }
    if (currentPostIndex < visiblePosts.length - 1) setCurrentPostIndex(currentPostIndex + 1);
    else await loadPosts();
    setSwiping(false);
  };

  const handlePostImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 5 - newPostImages.length;
    const incoming = Array.from(files).slice(0, remaining);
    const added = incoming.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setNewPostImages((prev) => [...prev, ...added]);
    if (newPostImagesInputRef.current) newPostImagesInputRef.current.value = "";
  };

  const removeNewPostImage = (idx: number) => {
    setNewPostImages((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const resetCreatePost = () => {
    newPostImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setNewPostImages([]);
    setNewPostTitle(""); setNewPostDescription(""); setNewPostLookingFor("");
    setNewPostLocation(""); setNewPostCompensation("");
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setCreatingPost(true); setCreatePostError("");

    const lookingFor = newPostLookingFor.split(",").map((s) => s.trim()).filter(Boolean);

    let mediaUrls: string[] | undefined;
    if (newPostImages.length) {
      mediaUrls = [];
      for (const img of newPostImages) {
        const { url, error: uploadErr } = await uploadFile(userId, "posts", img.file);
        if (uploadErr || !url) {
          setCreatePostError(uploadErr || "Image upload failed");
          setCreatingPost(false);
          return;
        }
        mediaUrls.push(url);
      }
    }

    const { error } = await createPost(userId, newPostTitle.trim(), newPostDescription.trim(), {
      looking_for: lookingFor.length ? lookingFor : undefined,
      location: newPostLocation.trim() || undefined,
      compensation: newPostCompensation.trim() || undefined,
      media_urls: mediaUrls,
    });
    if (error) { setCreatePostError(error); setCreatingPost(false); return; }
    resetCreatePost();
    setShowCreatePost(false); setCreatingPost(false);
    await Promise.all([loadPosts(), loadMyPosts()]);
  };

  const openChat = async (match: MatchWithPost) => {
    if (userId) await markMatchRead(match.id, userId);
    setMatches((prev) =>
      prev.map((m) => (m.id === match.id ? { ...m, last_read_at: new Date().toISOString() } : m))
    );
    setChatMatch(match); setMessages([]); setChatError(""); setMessagesLoading(true);
    setChatMenuOpen(false);
    const { data, error } = await getMessages(match.id);
    if (error) setChatError(error);
    setMessages(data || []); setMessagesLoading(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMatch || !userId || !messageText.trim() || sending) return;
    setChatError(""); setSending(true);
    const { data, error } = await sendMessage(chatMatch.id, userId, messageText.trim());
    if (error) setChatError(error);
    else if (data) {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setMessageText("");
    }
    setSending(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSavingProfile(true); setProfileMsg("");
    const skills = profileForm.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await updateProfile(userId, {
      name: profileForm.name,
      role: profileForm.role || undefined,
      bio: profileForm.bio || undefined,
      current_project: profileForm.currentProject || undefined,
      skills: skills.length ? skills : undefined,
    });
    setSavingProfile(false);
    setProfileMsg(error ? error : "Profile saved.");
    if (!error) await loadProfile();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingAvatar(true); setProfileMsg("");
    const { url, error: uploadErr } = await uploadFile(userId, "avatars", file);
    if (uploadErr || !url) {
      setProfileMsg(uploadErr || "Upload failed");
      setUploadingAvatar(false);
      return;
    }
    const { error: updateErr } = await updateProfile(userId, { avatar_url: url });
    setUploadingAvatar(false);
    if (updateErr) { setProfileMsg(updateErr); return; }
    await loadProfile();
    setProfileMsg("Avatar updated.");
  };

  const handlePortfolioAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !userId || !profile) return;

    const current = profile.portfolio_urls ?? [];
    const remaining = PORTFOLIO_MAX_IMAGES - current.length;
    if (remaining <= 0) {
      setPortfolioError(`You can have up to ${PORTFOLIO_MAX_IMAGES} images.`);
      e.target.value = "";
      return;
    }

    setPortfolioBusy(true);
    setPortfolioError("");
    const incoming = Array.from(files).slice(0, remaining);
    const uploaded: string[] = [];
    for (const file of incoming) {
      const { url, error: upErr } = await uploadFile(userId, "posts", file);
      if (upErr || !url) {
        setPortfolioError(upErr || "Upload failed.");
        break;
      }
      uploaded.push(url);
    }

    if (uploaded.length > 0) {
      const next = [...current, ...uploaded];
      const { error: updErr } = await updatePortfolio(userId, next);
      if (updErr) setPortfolioError(updErr);
      else await loadProfile();
    }

    setPortfolioBusy(false);
    e.target.value = "";
  };

  const handlePortfolioRemove = async (idx: number) => {
    if (!userId || !profile) return;
    const current = profile.portfolio_urls ?? [];
    if (idx < 0 || idx >= current.length) return;
    setPortfolioBusy(true);
    setPortfolioError("");
    const next = current.filter((_, i) => i !== idx);
    const { error } = await updatePortfolio(userId, next);
    if (error) setPortfolioError(error);
    else await loadProfile();
    setPortfolioBusy(false);
  };

  const handlePortfolioReorder = async (idx: number, delta: -1 | 1) => {
    if (!userId || !profile) return;
    const current = [...(profile.portfolio_urls ?? [])];
    const target = idx + delta;
    if (target < 0 || target >= current.length) return;
    [current[idx], current[target]] = [current[target], current[idx]];
    setPortfolioBusy(true);
    setPortfolioError("");
    const { error } = await updatePortfolio(userId, current);
    if (error) setPortfolioError(error);
    else await loadProfile();
    setPortfolioBusy(false);
  };

  const confirmBlock = async () => {
    if (!chatMatch || !userId) return;
    if (!confirm(`Block ${chatMatch.other_creator.name}? You will no longer see their posts and they won't see yours.`)) return;
    const { error: err } = await blockUser(userId, chatMatch.other_user_id);
    if (err) { setChatError(err); return; }
    setChatMenuOpen(false);
    setChatMatch(null);
    await Promise.all([loadMatches(), loadPosts()]);
  };

  const signOut = async () => { await supabase.auth.signOut(); onSignOut(); };

  // --- Effects ---

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadUser(); }, []);
  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPosts();
    loadMatches();
    loadProfile();
    loadMyPosts();
  }, [userId, loadPosts, loadMatches, loadProfile, loadMyPosts]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "messages") loadMatches(); }, [activeTab, loadMatches]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "profile") loadMyPosts(); }, [activeTab, loadMyPosts]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCurrentPostIndex(0); }, [connectSearch]);

  useEffect(() => {
    if (!chatMatch || !userId) return;
    const matchId = chatMatch.id;
    const channel = supabase
      .channel(`chat:${matchId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `match_id=eq.${matchId}`,
      }, async (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== userId) {
          await markMatchRead(matchId, userId);
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatMatch, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`feed-events-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "matches",
        filter: `user1_id=eq.${userId}`,
      }, () => { loadMatches(); })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "matches",
        filter: `user2_id=eq.${userId}`,
      }, () => { loadMatches(); })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        const msg = payload.new as Message;
        setMatches((prev) => {
          const idx = prev.findIndex((m) => m.id === msg.match_id);
          if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], last_message: msg };
          return next;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, loadMatches]);

  // --- Render ---

  const currentPost = visiblePosts[currentPostIndex];

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "connect", label: "Connect" },
    { key: "events", label: "Events" },
    { key: "messages", label: "Messages", badge: unreadCount },
    { key: "profile", label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      {/* ============================================================
          Sticky top chrome — header + tab bar
          ============================================================ */}
      <header className="sticky top-0 z-20 bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] backdrop-blur-md border-b border-[var(--line)]">
        <div className="max-w-[640px] mx-auto px-5 h-14 flex items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("profile")}
              className="h-9 w-9 rounded-full flex items-center justify-center text-[var(--ink-2)] hover:bg-[var(--secondary)] transition-colors"
              aria-label="Profile"
              title="Profile"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={signOut}
              className="h-9 w-9 rounded-full flex items-center justify-center text-[var(--ink-2)] hover:bg-[var(--secondary)] transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="max-w-[640px] mx-auto px-5">
          <div className="flex items-center gap-6 -mb-px">
            {tabs.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`relative pb-3 pt-1 text-[14px] font-medium transition-colors flex items-center gap-1.5 ${
                    active ? "text-[var(--ink)]" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
                  }`}
                >
                  {t.label}
                  {t.badge && t.badge > 0 ? (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-semibold px-1.5">
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  ) : null}
                  {active ? (
                    <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--ink)] rounded-full" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Match toast — subtle floating ribbon, accent border */}
      {matchToast ? (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-full bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <Heart className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
          {matchToast}
        </div>
      ) : null}

      {/* ============================================================
          Main content
          ============================================================ */}
      <main className="flex-1 w-full max-w-[640px] mx-auto px-5 pt-6 pb-16">
        {/* ======================== CONNECT TAB ======================== */}
        {activeTab === "connect" && (
          <div>
            {/* Section header */}
            <div className="flex items-end justify-between mb-5">
              <div>
                <SectionLabel>Today</SectionLabel>
                <h1 className="font-display text-[28px] sm:text-[32px] tracking-tight text-[var(--ink)] mt-0.5">
                  Find your next collab.
                </h1>
              </div>
              <PrimaryButton onClick={() => setShowCreatePost(true)} className="hidden sm:inline-flex">
                <Plus className="h-4 w-4" /> New post
              </PrimaryButton>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)]" />
              <input
                value={connectSearch}
                onChange={(e) => setConnectSearch(e.target.value)}
                placeholder="Filter by role, location, skill…"
                className="w-full pl-10 pr-10 h-11 text-[14px] bg-[var(--surface)] border border-[var(--line)] rounded-full focus:outline-none focus:border-[var(--ink)] transition-colors"
              />
              {connectSearch && (
                <button
                  onClick={() => setConnectSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] h-7 w-7 flex items-center justify-center rounded-full"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="sm:hidden mb-5">
              <PrimaryButton onClick={() => setShowCreatePost(true)} className="w-full">
                <Plus className="h-4 w-4" /> New collaboration post
              </PrimaryButton>
            </div>

            {connectErr && <ErrorMessage>{connectErr}</ErrorMessage>}

            {loading ? (
              <div className="flex items-center justify-center py-24 text-[var(--ink-3)] text-[14px]">
                Loading posts…
              </div>
            ) : !currentPost ? (
              <EmptyState
                title={connectSearch ? "Nothing matches." : "All caught up."}
                body={
                  connectSearch
                    ? "Try a different search term, or clear your filter."
                    : "Come back later — or create a post so others find you."
                }
                actionLabel={connectSearch ? "Clear filter" : "Refresh"}
                onAction={connectSearch ? () => setConnectSearch("") : loadPosts}
              />
            ) : (
              <>
                {/* Post card */}
                <article className="melange-card overflow-hidden">
                  <div className="relative">
                    <ImageGallery urls={currentPost.media_urls ?? []} aspect="aspect-[4/5]" />
                    <button
                      onClick={() => setDetailPost(currentPost)}
                      className="absolute top-3 right-3 h-9 w-9 bg-white/85 backdrop-blur rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                      aria-label="Post details"
                    >
                      <Info className="h-4 w-4 text-[var(--ink)]" />
                    </button>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar creator={currentPost.creator} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[16px] tracking-tight text-[var(--ink)] truncate">
                          {currentPost.creator.name}
                        </p>
                        {currentPost.creator.role && (
                          <p className="text-[12px] text-[var(--ink-3)] truncate">{currentPost.creator.role}</p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setReportTarget({
                            kind: "post",
                            id: currentPost.id,
                            label: currentPost.title,
                          })
                        }
                        className="text-[var(--ink-3)] hover:text-[var(--destructive)] transition-colors p-1.5"
                        title="Report post"
                        aria-label="Report post"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <h3 className="font-display text-[22px] leading-tight tracking-tight text-[var(--ink)] mb-2">
                      {currentPost.title}
                    </h3>
                    {currentPost.description && (
                      <p className="text-[14px] text-[var(--ink-2)] leading-relaxed mb-4 line-clamp-3">
                        {currentPost.description}
                      </p>
                    )}

                    <div className="space-y-1.5">
                      {currentPost.location && (
                        <MetaRow icon={<MapPin className="h-3.5 w-3.5" />}>
                          {currentPost.location}
                        </MetaRow>
                      )}
                      {currentPost.looking_for && currentPost.looking_for.length > 0 && (
                        <MetaRow icon={<Users className="h-3.5 w-3.5" />}>
                          Looking for {currentPost.looking_for.join(", ")}
                        </MetaRow>
                      )}
                      {currentPost.compensation && (
                        <MetaRow icon={<DollarSign className="h-3.5 w-3.5" />}>
                          {currentPost.compensation}
                        </MetaRow>
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--ink-3)] mt-4 tracking-tight">
                      {visiblePosts.length - currentPostIndex - 1} more {visiblePosts.length - currentPostIndex - 1 === 1 ? "post" : "posts"} ahead
                      {connectSearch ? " (filtered)" : ""}
                    </p>
                  </div>

                  {currentPost.creator.portfolio_urls && currentPost.creator.portfolio_urls.length > 0 ? (
                    <PortfolioStrip
                      urls={currentPost.creator.portfolio_urls}
                      name={currentPost.creator.name}
                      onOpen={(idx) =>
                        setLightbox({
                          urls: currentPost.creator.portfolio_urls ?? [],
                          index: idx,
                          creatorName: currentPost.creator.name,
                        })
                      }
                    />
                  ) : null}
                </article>

                {/* Swipe controls — large circular icons, accent on like */}
                <div className="flex items-center justify-center gap-5 mt-6 mb-2">
                  <button
                    onClick={() => handleSwipe("left")}
                    disabled={swiping}
                    aria-label="Pass"
                    className="h-14 w-14 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--ink-2)] hover:bg-[var(--secondary)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-[0_2px_8px_rgba(20,20,18,0.05)]"
                  >
                    <X className="h-5 w-5" strokeWidth={2.2} />
                  </button>
                  <button
                    onClick={() => setDetailPost(currentPost)}
                    aria-label="More info"
                    className="h-12 w-12 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--ink-2)] hover:bg-[var(--secondary)] transition-colors"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleSwipe("right")}
                    disabled={swiping}
                    aria-label="Like"
                    className="h-14 w-14 rounded-full bg-[var(--accent)] text-white flex items-center justify-center hover:scale-[1.04] active:scale-95 disabled:opacity-50 transition-all shadow-[0_4px_14px_rgba(229,90,76,0.35)]"
                  >
                    <Heart className="h-5 w-5 fill-white" />
                  </button>
                </div>
                <p className="text-[11px] text-center text-[var(--ink-3)] uppercase tracking-[0.16em] mt-1">
                  Pass · Details · Like
                </p>
              </>
            )}
          </div>
        )}

        {/* ======================== EVENTS TAB ======================== */}
        {activeTab === "events" && userId && (
          <EventsView userId={userId} />
        )}

        {/* ======================== MESSAGES TAB ======================== */}
        {activeTab === "messages" && (
          <div>
            <div className="mb-5">
              <SectionLabel>Conversations</SectionLabel>
              <h1 className="font-display text-[28px] sm:text-[32px] tracking-tight text-[var(--ink)] mt-0.5">
                Your matches.
              </h1>
            </div>

            {matchErr && <ErrorMessage>{matchErr}</ErrorMessage>}

            {matches.length === 0 ? (
              <EmptyState
                title="No matches yet."
                body="When you and someone else both swipe right, you'll meet here."
                actionLabel="Refresh"
                onAction={loadMatches}
              />
            ) : (
              <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {matches.map((match) => {
                  const unread = userId ? isMatchUnread(match, userId) : false;
                  return (
                    <li key={match.id}>
                      <button
                        onClick={() => openChat(match)}
                        className="w-full flex items-center gap-4 py-4 px-1 text-left hover:bg-[var(--secondary)]/40 transition-colors"
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar creator={match.other_creator} size="lg" />
                          {unread && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[var(--accent)] rounded-full ring-2 ring-[var(--bg)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className={`font-display text-[17px] tracking-tight text-[var(--ink)] truncate ${unread ? "font-semibold" : ""}`}>
                              {match.other_creator.name}
                            </h3>
                            <span className="text-[11px] text-[var(--ink-3)] flex-shrink-0">
                              {match.last_message
                                ? formatTimeAgo(match.last_message.created_at)
                                : new Date(match.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {match.other_creator.role && (
                            <p className="text-[11px] text-[var(--ink-3)] uppercase tracking-[0.12em] mt-0.5">
                              {match.other_creator.role}
                            </p>
                          )}
                          {match.last_message ? (
                            <p className={`text-[13px] truncate mt-1 ${unread ? "text-[var(--ink)] font-medium" : "text-[var(--ink-2)]"}`}>
                              {match.last_message.sender_id === userId ? "You: " : ""}
                              {match.last_message.content}
                            </p>
                          ) : (
                            <p className="text-[13px] text-[var(--ink-3)] italic mt-1 truncate">
                              You matched on “{match.other_post.title}”. Say hi.
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ======================== PROFILE TAB ======================== */}
        {activeTab === "profile" && (
          <div className="space-y-10">
            {/* Identity hero */}
            {profile && (
              <section className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="relative group flex-shrink-0"
                >
                  <Avatar creator={{ name: profile.name, role: profile.role, avatar_url: profile.avatar_url }} size="xl" />
                  <div className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar
                      ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                      : <Camera className="h-5 w-5 text-white" />
                    }
                  </div>
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <div className="flex-1 min-w-0">
                  <SectionLabel>Your profile</SectionLabel>
                  <h1 className="font-display text-[28px] tracking-tight text-[var(--ink)] truncate mt-0.5">
                    {profile.name}
                  </h1>
                  {profile.role && (
                    <p className="text-[14px] text-[var(--ink-2)] mt-0.5">{profile.role}</p>
                  )}
                </div>
              </section>
            )}

            {/* Portfolio */}
            {profile && userId ? (
              <section className="pt-2">
                <PortfolioEditor
                  urls={profile.portfolio_urls ?? []}
                  busy={portfolioBusy}
                  error={portfolioError}
                  onAdd={handlePortfolioAdd}
                  onRemove={handlePortfolioRemove}
                  onReorder={handlePortfolioReorder}
                  onView={(idx) =>
                    setLightbox({
                      urls: profile.portfolio_urls ?? [],
                      index: idx,
                      creatorName: profile.name,
                    })
                  }
                />
              </section>
            ) : null}

            {/* Profile form */}
            <section className="border-t border-[var(--line)] pt-8">
              <div className="mb-5">
                <h2 className="font-display text-[20px] tracking-tight text-[var(--ink)]">About you</h2>
                <p className="text-[12px] text-[var(--ink-3)] mt-1">
                  This is what other creatives see.
                </p>
              </div>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <MFieldLabel htmlFor="prof-name">Name</MFieldLabel>
                  <MInput id="prof-name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                </div>
                <div>
                  <MFieldLabel htmlFor="prof-role">Role</MFieldLabel>
                  <MInput id="prof-role" value={profileForm.role} onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })} placeholder="e.g. Photographer" />
                </div>
                <div>
                  <MFieldLabel htmlFor="prof-skills">Skills</MFieldLabel>
                  <MInput
                    id="prof-skills"
                    value={profileForm.skills}
                    onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                    placeholder="Portrait, 35mm film, editorial lighting"
                  />
                </div>
                <div>
                  <MFieldLabel htmlFor="prof-bio">Bio</MFieldLabel>
                  <MTextarea id="prof-bio" rows={3} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="What's your taste? What kind of work do you want to make?" />
                </div>
                <div>
                  <MFieldLabel htmlFor="prof-project">Working on right now</MFieldLabel>
                  <MInput id="prof-project" value={profileForm.currentProject} onChange={(e) => setProfileForm({ ...profileForm, currentProject: e.target.value })} placeholder="An archival zine, a weekly portrait series, …" />
                </div>

                {profileMsg && (
                  <p
                    className={`text-[12px] rounded-[var(--radius-md)] p-2.5 border ${
                      profileMsg.includes("saved") || profileMsg.includes("updated")
                        ? "bg-[color-mix(in_oklab,var(--success)_8%,var(--surface))] text-[var(--success)] border-[color-mix(in_oklab,var(--success)_25%,var(--line))]"
                        : "bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] text-[var(--destructive)] border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))]"
                    }`}
                  >
                    {profileMsg}
                  </p>
                )}

                <PrimaryButton type="submit" loading={savingProfile} className="w-full">
                  {savingProfile ? "Saving…" : "Save profile"}
                </PrimaryButton>
              </form>
            </section>

            {/* Your posts */}
            <section className="border-t border-[var(--line)] pt-8">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="font-display text-[20px] tracking-tight text-[var(--ink)]">Your posts</h2>
                  <p className="text-[12px] text-[var(--ink-3)] mt-1">
                    {myPosts.length === 0 ? "Start by posting a collab you're looking for." : `${myPosts.length} ${myPosts.length === 1 ? "post" : "posts"}`}
                  </p>
                </div>
                <GhostButton onClick={() => setShowCreatePost(true)}>
                  <Plus className="h-3.5 w-3.5" /> New
                </GhostButton>
              </div>
              {myPosts.length === 0 ? (
                <p className="text-[13px] text-[var(--ink-3)] italic">You haven&apos;t created a post yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
                  {myPosts.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => setEditingPost(p)}
                        className="w-full text-left flex items-center gap-3 py-3 px-1 hover:bg-[var(--secondary)]/40 transition-colors"
                      >
                        {p.media_urls?.[0] ? (
                          <img src={p.media_urls[0]} alt="" className="w-12 h-12 rounded-[var(--radius-md)] object-cover flex-shrink-0 ring-1 ring-[var(--line)]" />
                        ) : (
                          <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--secondary)] flex items-center justify-center flex-shrink-0 text-[var(--ink-3)]">
                            <Pencil className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-[15px] tracking-tight text-[var(--ink)] truncate">{p.title}</p>
                          <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                            {new Date(p.created_at).toLocaleDateString()}
                            {p.is_active ? "" : " · inactive"}
                          </p>
                        </div>
                        <Pencil className="h-3.5 w-3.5 text-[var(--ink-3)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Account & safety */}
            <section className="border-t border-[var(--line)] pt-8">
              <button
                onClick={() => setShowAccountSafety(true)}
                className="w-full flex items-center gap-4 p-4 border border-[var(--line)] rounded-[var(--radius-lg)] hover:bg-[var(--secondary)]/50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-[var(--secondary)] flex items-center justify-center text-[var(--ink-2)]">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-display text-[15px] tracking-tight text-[var(--ink)]">Account &amp; safety</p>
                  <p className="text-[12px] text-[var(--ink-3)] mt-0.5">Blocked users, delete account</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--ink-3)]" />
              </button>
            </section>
          </div>
        )}
      </main>

      {/* ============================================================
          Detail dialog
          ============================================================ */}
      <Dialog open={!!detailPost} onOpenChange={(open) => { if (!open) setDetailPost(null); }}>
        <DialogContent className="max-w-[480px] max-h-[88vh] overflow-y-auto p-0 rounded-[var(--radius-xl)] border-[var(--line)] bg-[var(--surface)]">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--line)] sticky top-0 bg-[var(--surface)] z-10">
            <DialogTitle className="font-display text-[18px] tracking-tight text-[var(--ink)] truncate">{detailPost?.title}</DialogTitle>
            <button
              onClick={() => setDetailPost(null)}
              className="text-[var(--ink-3)] hover:text-[var(--ink)] h-8 w-8 rounded-full flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <DialogDescription className="sr-only">Post details</DialogDescription>
          {detailPost && (
            <div>
              <ImageGallery urls={detailPost.media_urls ?? []} aspect="aspect-[4/5]" />

              <div className="p-5 space-y-5">
                <div className="flex items-center gap-3">
                  <Avatar creator={detailPost.creator} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[18px] tracking-tight text-[var(--ink)] truncate">{detailPost.creator.name}</p>
                    {detailPost.creator.role && <p className="text-[13px] text-[var(--ink-2)] truncate">{detailPost.creator.role}</p>}
                  </div>
                  {userId && detailPost.owner_id !== userId ? (
                    <button
                      onClick={() =>
                        setReportTarget({
                          kind: "post",
                          id: detailPost.id,
                          label: detailPost.title,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[var(--line)] rounded-full text-[11px] font-medium text-[var(--ink-2)] hover:border-[var(--destructive)] hover:text-[var(--destructive)] transition-colors"
                    >
                      <Flag className="h-3 w-3" /> Report
                    </button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {detailPost.description && (
                    <div>
                      <SectionLabel>Description</SectionLabel>
                      <p className="text-[14px] text-[var(--ink-2)] leading-relaxed mt-1.5">{detailPost.description}</p>
                    </div>
                  )}
                  {detailPost.looking_for && detailPost.looking_for.length > 0 && (
                    <div>
                      <SectionLabel>Looking for</SectionLabel>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {detailPost.looking_for.map((lf) => (
                          <Chip key={lf}>{lf}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {detailPost.location && (
                      <div>
                        <SectionLabel>Location</SectionLabel>
                        <p className="text-[13px] text-[var(--ink-2)] mt-1.5">{detailPost.location}</p>
                      </div>
                    )}
                    {detailPost.compensation && (
                      <div>
                        <SectionLabel>Compensation</SectionLabel>
                        <p className="text-[13px] text-[var(--ink-2)] mt-1.5">{detailPost.compensation}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--ink-3)] pt-1">
                    Posted {new Date(detailPost.created_at).toLocaleDateString()}
                  </p>
                </div>

                {detailPost.creator.portfolio_urls && detailPost.creator.portfolio_urls.length > 0 ? (
                  <div className="pt-2 border-t border-[var(--line)]">
                    <SectionLabel>More from {detailPost.creator.name}</SectionLabel>
                    <div className="mt-3">
                      <PortfolioGrid
                        urls={detailPost.creator.portfolio_urls}
                        onOpen={(idx) =>
                          setLightbox({
                            urls: detailPost.creator.portfolio_urls ?? [],
                            index: idx,
                            creatorName: detailPost.creator.name,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================
          Chat dialog
          ============================================================ */}
      <Dialog open={!!chatMatch} onOpenChange={(open) => { if (!open) { setChatMatch(null); setChatMenuOpen(false); } }}>
        <DialogContent className="max-w-[480px] h-[85vh] flex flex-col p-0 rounded-[var(--radius-xl)] border-[var(--line)] bg-[var(--surface)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)]">
            <button
              onClick={() => setChatMatch(null)}
              className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-2)] hover:bg-[var(--secondary)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {chatMatch && (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar creator={chatMatch.other_creator} size="md" />
                <div className="min-w-0">
                  <DialogTitle className="font-display text-[15px] tracking-tight text-[var(--ink)] truncate leading-tight">
                    {chatMatch.other_creator.name}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-[var(--ink-3)] truncate">
                    {chatMatch.other_post.title}
                  </DialogDescription>
                </div>
              </div>
            )}
            <div className="ml-auto relative">
              <button
                onClick={() => setChatMenuOpen((o) => !o)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-2)] hover:bg-[var(--secondary)]"
                aria-label="Conversation options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {chatMenuOpen && chatMatch ? (
                <div className="absolute right-0 top-10 z-30 w-48 melange-card py-1.5">
                  <button
                    onClick={() => {
                      setChatMenuOpen(false);
                      setReportTarget({
                        kind: "user",
                        id: chatMatch.other_user_id,
                        label: chatMatch.other_creator.name,
                      });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--ink-2)] hover:bg-[var(--secondary)]"
                  >
                    <Flag className="h-3.5 w-3.5" /> Report user
                  </button>
                  <button
                    onClick={confirmBlock}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--destructive)] hover:bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Block user
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 bg-[var(--bg)]" onClick={() => setChatMenuOpen(false)}>
            {messagesLoading ? (
              <div className="flex items-center justify-center py-16 text-[var(--ink-3)] text-[14px]">
                Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="font-display text-[18px] tracking-tight text-[var(--ink)]">Say hello.</p>
                <p className="text-[13px] text-[var(--ink-3)] mt-1">
                  You matched on “{chatMatch?.other_post.title}”.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((msg, i) => {
                  const isMe = msg.sender_id === userId;
                  const prev = messages[i - 1];
                  const showAvatar = !isMe && (!prev || prev.sender_id !== msg.sender_id);
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                      {!isMe && chatMatch ? (
                        <div className={showAvatar ? "" : "invisible"}>
                          <Avatar creator={chatMatch.other_creator} size="sm" />
                        </div>
                      ) : null}
                      <div
                        className={`max-w-[72%] px-4 py-2.5 text-[14px] leading-snug ${
                          isMe
                            ? "bg-[var(--ink)] text-[var(--bg)] rounded-[18px] rounded-br-[6px]"
                            : "bg-[var(--surface)] text-[var(--ink)] rounded-[18px] rounded-bl-[6px] border border-[var(--line)]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-white/55" : "text-[var(--ink-3)]"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {chatError && (
            <div className="mx-4 mb-2">
              <ErrorMessage>{chatError}</ErrorMessage>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-3 border-t border-[var(--line)] bg-[var(--surface)]">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 px-4 h-10 text-[14px] bg-[var(--bg)] border border-[var(--line)] rounded-full focus:outline-none focus:border-[var(--ink)] transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={sending || !messageText.trim()}
              className="h-10 w-10 flex items-center justify-center bg-[var(--ink)] text-[var(--bg)] rounded-full hover:opacity-90 disabled:opacity-40 transition-opacity"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          Create Post dialog
          ============================================================ */}
      <Dialog
        open={showCreatePost}
        onOpenChange={(open) => {
          if (!open) {
            resetCreatePost();
            setShowCreatePost(false);
          }
        }}
      >
        <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto p-0 rounded-[var(--radius-xl)] border-[var(--line)] bg-[var(--surface)]">
          <div className="px-5 py-4 border-b border-[var(--line)] sticky top-0 bg-[var(--surface)] z-10">
            <SectionLabel>New post</SectionLabel>
            <DialogTitle className="font-display text-[22px] tracking-tight text-[var(--ink)] mt-0.5">
              Start a collaboration.
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[var(--ink-3)] mt-1">
              Describe what you&apos;re looking to make. Others will see this in their feed.
            </DialogDescription>
          </div>
          <form onSubmit={handleCreatePost} className="p-5 space-y-4">
            <div>
              <MFieldLabel htmlFor="np-title">Title</MFieldLabel>
              <MInput
                id="np-title"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="Editorial portrait series, soft natural light"
                required
              />
            </div>
            <div>
              <MFieldLabel htmlFor="np-desc">Description</MFieldLabel>
              <MTextarea
                id="np-desc"
                rows={3}
                value={newPostDescription}
                onChange={(e) => setNewPostDescription(e.target.value)}
                placeholder="What's the concept, the style, the timeline?"
                required
              />
            </div>
            <div>
              <MFieldLabel htmlFor="np-lf">Looking for</MFieldLabel>
              <MInput
                id="np-lf"
                value={newPostLookingFor}
                onChange={(e) => setNewPostLookingFor(e.target.value)}
                placeholder="Photographer, model, MUA — comma separated"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MFieldLabel htmlFor="np-loc">Location</MFieldLabel>
                <MInput
                  id="np-loc"
                  value={newPostLocation}
                  onChange={(e) => setNewPostLocation(e.target.value)}
                  placeholder="Brooklyn, NY"
                />
              </div>
              <div>
                <MFieldLabel htmlFor="np-comp">Compensation</MFieldLabel>
                <MInput
                  id="np-comp"
                  value={newPostCompensation}
                  onChange={(e) => setNewPostCompensation(e.target.value)}
                  placeholder="TFP, $200/hr, rev share"
                />
              </div>
            </div>
            <div>
              <MFieldLabel>Reference images (up to 5)</MFieldLabel>
              <div className="flex flex-wrap gap-2">
                {newPostImages.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-[var(--radius-md)] overflow-hidden ring-1 ring-[var(--line)]">
                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewPostImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/65 backdrop-blur rounded-full flex items-center justify-center text-white"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {newPostImages.length < 5 ? (
                  <button
                    type="button"
                    onClick={() => newPostImagesInputRef.current?.click()}
                    className="w-20 h-20 border border-dashed border-[var(--line)] rounded-[var(--radius-md)] flex flex-col items-center justify-center gap-1 text-[var(--ink-3)] hover:border-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Add</span>
                  </button>
                ) : null}
              </div>
              <input
                ref={newPostImagesInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePostImageSelect}
              />
            </div>
            {createPostError && <ErrorMessage>{createPostError}</ErrorMessage>}
            <PrimaryButton
              type="submit"
              loading={creatingPost}
              disabled={!newPostTitle.trim() || !newPostDescription.trim()}
              className="w-full"
            >
              {creatingPost ? "Posting…" : "Publish post"}
            </PrimaryButton>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          Auxiliary dialogs (delegated to their own files)
          ============================================================ */}
      {userId ? (
        <EditPostDialog
          userId={userId}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={async () => { await Promise.all([loadPosts(), loadMyPosts()]); }}
          onDeleted={async () => { await Promise.all([loadPosts(), loadMyPosts()]); }}
        />
      ) : null}

      {userId ? (
        <AccountSafetyDialog
          userId={userId}
          open={showAccountSafety}
          onClose={() => setShowAccountSafety(false)}
          onAccountDeleted={() => {
            setShowAccountSafety(false);
            onSignOut();
          }}
        />
      ) : null}

      {userId ? (
        <ReportDialog
          reporterId={userId}
          target={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      ) : null}

      <PortfolioLightbox
        open={!!lightbox && lightbox.urls.length > 0}
        urls={lightbox?.urls ?? []}
        startIndex={lightbox?.index ?? 0}
        creatorName={lightbox?.creatorName}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

// ============================================================
// Empty state
// ============================================================

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h3 className="font-display text-[24px] tracking-tight text-[var(--ink)]">{title}</h3>
      <p className="text-[14px] text-[var(--ink-2)] mt-2 max-w-[36ch]">{body}</p>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="mt-5 text-[13px] text-[var(--ink)] underline underline-offset-4 hover:text-[var(--accent)]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
