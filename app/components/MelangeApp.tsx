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
  VIBE_PRESETS,
  type CollabPost,
  type CreatorInfo,
  type MatchWithPost,
  type Message,
  type PostWithCreator,
  type Profile,
} from "../lib/db";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Flag,
  Heart,
  ImagePlus,
  Loader2,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  X,
} from "lucide-react";

import ReportDialog from "./ReportDialog";
import EditPostDialog from "./EditPostDialog";
import AccountSafetyDialog from "./AccountSafetyDialog";
import ConnectSwipeCard from "./ConnectSwipeCard";
import ExploreView from "./ExploreView";
import Logo from "./Logo";
import PortfolioLightbox from "./PortfolioLightbox";
import ProfileReviews from "./ProfileReviews";
import SetupChecklist from "./SetupChecklist";
import ReviewDialog from "./ReviewDialog";
import ReputationBadge from "./ReputationBadge";
import {
  getMyReviewForMatch,
  isReviewEligible,
  normalizeSocialUrl,
} from "../lib/reviews";
import { trackEvent } from "../lib/analytics";
import VerifiedBadge from "./VerifiedBadge";

type Tab = "connect" | "explore" | "messages" | "profile";
type MessagesSubTab = "messages" | "matches";

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
      ? "w-14 h-14 text-lg"
      : size === "xl"
      ? "w-20 h-20 text-2xl"
      : "w-10 h-10 text-sm";
  if (creator.avatar_url) {
    return <img src={creator.avatar_url} alt={creator.name} className={`${dims} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${dims} rounded-full bg-blue-100 text-blue-600 font-semibold flex items-center justify-center flex-shrink-0`}>
      {creator.name.charAt(0).toUpperCase()}
    </div>
  );
}

/**
 * Editor for the signed-in user's portfolio.
 * Renders a responsive 3-column grid with a per-tile management menu.
 */
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
  const canAdd = urls.length < 9;
  return (
    <div className="pb-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Portfolio</h2>
          <p className="text-[11px] text-gray-400">Your visual identity. Up to 9 images.</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canAdd || busy}
          className="text-xs font-medium px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add
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
          className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <ImagePlus className="h-5 w-5 mx-auto mb-1.5" />
          <p className="text-xs font-medium">Show your best work</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Tap to add images</p>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {urls.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 group"
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
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
              {idx > 0 ? (
                <button
                  type="button"
                  onClick={() => onReorder(idx, -1)}
                  disabled={busy}
                  className="absolute bottom-1 left-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
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
                  className="absolute bottom-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                  aria-label="Move right"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2 mt-2">{error}</p>
      ) : null}
    </div>
  );
}

/**
 * Full read-only portfolio grid for the post detail dialog.
 */
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
          className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 hover:opacity-90 transition-opacity"
        >
          <img src={u} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}

/** Simple swipable image gallery for cards / detail / chat. */
function ImageGallery({ urls, height = "h-48" }: { urls: string[]; height?: string }) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) {
    return (
      <div className={`${height} bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50 flex items-center justify-center`}>
        <div className="text-4xl opacity-20">🎨</div>
      </div>
    );
  }
  return (
    <div className={`relative ${height} bg-gray-100 overflow-hidden`}>
      <img src={urls[idx]} alt="" className="w-full h-full object-cover" />
      {urls.length > 1 ? (
        <>
          <button
            onClick={() => setIdx((i) => (i === 0 ? urls.length - 1 : i - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 hover:bg-white flex items-center justify-center shadow-sm"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4 text-gray-700" />
          </button>
          <button
            onClick={() => setIdx((i) => (i === urls.length - 1 ? 0 : i + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 hover:bg-white flex items-center justify-center shadow-sm"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4 text-gray-700" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {urls.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/45"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function MelangeApp({ onSignOut }: { onSignOut: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("connect");
  const [messagesSubTab, setMessagesSubTab] = useState<MessagesSubTab>("messages");

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
    instagram: "",
    linkedin: "",
  });
  const [profileVibes, setProfileVibes] = useState<string[]>([]);
  const [reviewDialog, setReviewDialog] = useState<{
    matchId: string;
    revieweeId: string;
    revieweeName: string;
  } | null>(null);
  const [chatHasReview, setChatHasReview] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAccountSafety, setShowAccountSafety] = useState(false);

  // Portfolio state — owns the editing UI for your own portfolio + busy flags.
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [portfolioError, setPortfolioError] = useState("");

  // Lightbox state — generic viewer for any creator's portfolio.
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    index: number;
    creatorName?: string;
  } | null>(null);

  // Report dialog
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
        instagram: data.instagram_url || "",
        linkedin: data.linkedin_url || "",
      });
      setProfileVibes(data.vibes ?? []);
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
    trackEvent(direction === "right" ? "swipe_right" : "swipe_left", {
      post_id: post.id,
      owner_id: post.owner_id,
    });
    if (direction === "right") {
      const { match, error: matchError } = await checkAndCreateMatch(userId, post.id);
      if (matchError) setConnectErr(matchError);
      else if (match) {
        trackEvent("match_created", { match_id: match.id, post_id: post.id });
        await loadMatches();
        setMatchToast(`You matched with ${post.creator.name}!`);
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
    trackEvent("post_created", { title: newPostTitle.trim() });
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
    setChatHasReview(false);
    if (userId) {
      const { data: existing } = await getMyReviewForMatch(match.id, userId);
      setChatHasReview(!!existing);
    }
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
      trackEvent("message_sent", { match_id: chatMatch.id });
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
      vibes: profileVibes.length ? profileVibes : [],
      instagram_url: normalizeSocialUrl("instagram", profileForm.instagram),
      linkedin_url: normalizeSocialUrl("linkedin", profileForm.linkedin),
    });
    setSavingProfile(false);
    setProfileMsg(error ? error : "Profile saved!");
    if (!error) {
      trackEvent("profile_saved");
      await supabase.rpc("refresh_profile_verification", { p_user_id: userId });
      await loadProfile();
    }
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
    setProfileMsg("Avatar updated!");
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

  // Realtime: new messages in active chat
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
    // chatMatch.id is referenced via optional chaining; depend on chatMatch itself.
  }, [chatMatch, userId]);

  // Realtime: new matches and messages list updates
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
    { key: "explore", label: "Explore" },
    { key: "messages", label: "Messages", badge: unreadCount },
    { key: "profile", label: "Profile" },
  ];

  const messageMatches = matches.filter((m) =>
    messagesSubTab === "messages" ? !!m.last_message : !m.last_message
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center py-4 px-4">
      <div className="w-full max-w-[375px] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[90vh] max-h-[900px]">

        {/* In-app header (Jolea prototype) */}
        <div className="bg-white text-blue-800 px-4 py-3 flex items-center justify-between border-b border-blue-200">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <div>
              <h1
                className="text-lg font-bold italic -skew-x-3 text-blue-800"
                style={{ WebkitTextStroke: "1px #A78BFA", paintOrder: "stroke fill" }}
              >
                Melange
              </h1>
              <p className="text-[10px] text-blue-500 -mt-0.5">Creative Collaborations</p>
            </div>
          </div>
          <button onClick={signOut} className="text-blue-400 hover:text-blue-700 transition-colors" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Tab navigation — full-width blue grid */}
        <div className="grid grid-cols-4 bg-blue-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`text-[11px] font-medium py-2.5 transition-colors relative ${
                activeTab === t.key ? "bg-blue-100 text-blue-800" : "bg-blue-700 text-gray-200"
              }`}
            >
              {t.label}
              {t.badge && t.badge > 0 ? (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-0.5">
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Match toast */}
        {matchToast ? (
          <div className="mx-4 mt-2 mb-1 px-3 py-2 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm">
            <Heart className="h-3.5 w-3.5 fill-white" />
            {matchToast}
          </div>
        ) : null}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">

          {/* ======================== CONNECT TAB ======================== */}
          {activeTab === "connect" && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400" />
                  <input
                    value={connectSearch}
                    onChange={(e) => setConnectSearch(e.target.value)}
                    placeholder="Role, location, skill..."
                    className="w-full pl-8 pr-8 py-2 text-xs bg-blue-50 border border-blue-200 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  {connectSearch && (
                    <button type="button" onClick={() => setConnectSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreatePost(true)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-2 bg-violet-400 text-white rounded-full hover:bg-violet-500 flex-shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {connectErr && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{connectErr}</div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading posts...</div>
              ) : !currentPost ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <p className="text-blue-800 font-medium mb-1">
                    {connectSearch ? "No posts match your filter." : "You're all caught up"}
                  </p>
                  <p className="text-gray-500 text-sm mb-4 max-w-[280px]">
                    {connectSearch
                      ? "Try role, city, or skill keywords — or clear the filter."
                      : "Post a collab idea so others can swipe on you, or check Explore for ranked ideas near you."}
                  </p>
                  {connectSearch ? (
                    <button type="button" onClick={() => setConnectSearch("")} className="text-sm text-violet-600 hover:underline">Clear filter</button>
                  ) : (
                    <div className="flex flex-col gap-2 w-full max-w-[220px]">
                      <button
                        type="button"
                        onClick={() => setShowCreatePost(true)}
                        className="text-sm font-medium py-2.5 rounded-full bg-violet-500 text-white hover:bg-violet-600"
                      >
                        Post a collab idea
                      </button>
                      <button type="button" onClick={() => setActiveTab("explore")} className="text-sm text-blue-800 hover:underline">
                        Browse Explore
                      </button>
                      <button type="button" onClick={loadPosts} className="text-xs text-gray-400 hover:underline">Refresh feed</button>
                    </div>
                  )}
                </div>
              ) : (
                <ConnectSwipeCard
                  post={currentPost}
                  remaining={Math.max(0, visiblePosts.length - currentPostIndex - 1)}
                  swiping={swiping}
                  onSwipe={handleSwipe}
                  onDetail={() => setDetailPost(currentPost)}
                />
              )}
            </div>
          )}

          {/* ======================== EXPLORE TAB ======================== */}
          {activeTab === "explore" && userId && (
            <ExploreView
              userId={userId}
              onNewIdea={() => setShowCreatePost(true)}
              onOpenPost={(post) => setDetailPost(post)}
            />
          )}

          {/* ======================== MESSAGES TAB ======================== */}
          {activeTab === "messages" && (
            <div className="pt-2">
              <div className="grid grid-cols-2 bg-blue-800 rounded-lg overflow-hidden mb-3">
                {(["messages", "matches"] as MessagesSubTab[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMessagesSubTab(key)}
                    className={`text-xs font-medium py-2 capitalize transition-colors ${
                      messagesSubTab === key ? "bg-blue-100 text-blue-800" : "bg-blue-700 text-gray-200"
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              {matchErr && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{matchErr}</div>
              )}

              {matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-blue-800 mb-1">No matches yet.</p>
                  <p className="text-gray-400 text-sm mb-4">Start swiping to find collaborators!</p>
                  <button type="button" onClick={loadMatches} className="text-sm text-violet-600 hover:underline">Refresh</button>
                </div>
              ) : messageMatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-gray-500 text-sm">
                    {messagesSubTab === "messages"
                      ? "No conversations yet — say hello from Matches."
                      : "All matches have started chatting!"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messageMatches.map((match) => {
                    const unread = userId ? isMatchUnread(match, userId) : false;
                    return (
                      <div
                        key={match.id}
                        onClick={() => openChat(match)}
                        className={`flex items-center gap-3 bg-white border rounded-xl p-3 hover:shadow-sm transition-shadow cursor-pointer ${
                          unread ? "border-violet-300 bg-violet-50/30" : "border-blue-100"
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar creator={match.other_creator} size="md" />
                          {unread && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-sm truncate ${unread ? "font-bold text-gray-900" : "font-semibold text-gray-900"}`}>{match.other_creator.name}</h3>
                            {match.other_creator.role && (
                              <span className="text-[11px] text-gray-400 truncate">{match.other_creator.role}</span>
                            )}
                          </div>
                          {match.last_message ? (
                            <p className={`text-xs truncate ${unread ? "text-gray-700 font-medium" : "text-gray-500"}`}>
                              {match.last_message.sender_id === userId ? "You: " : ""}
                              {match.last_message.content}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 italic truncate">No messages yet — say hello!</p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {match.last_message
                              ? formatTimeAgo(match.last_message.created_at)
                              : `Matched ${new Date(match.created_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================== PROFILE TAB ======================== */}
          {activeTab === "profile" && (
            <div className="pt-3 space-y-5">
              {profile ? <SetupChecklist profile={profile} /> : null}

              {/* Avatar + identity */}
              {profile && (
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="relative group flex-shrink-0"
                  >
                    <Avatar creator={{ name: profile.name, role: profile.role, avatar_url: profile.avatar_url }} size="lg" />
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploadingAvatar
                        ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                        : <Camera className="h-5 w-5 text-white" />
                      }
                    </div>
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate flex items-center gap-1.5 flex-wrap">
                      {profile.name}
                      {profile.verification_status === "verified" ? <VerifiedBadge compact /> : null}
                    </p>
                    {profile.role && <p className="text-sm text-gray-500 truncate">{profile.role}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">Click avatar to change</p>
                    {profile.verification_status !== "verified" ? (
                      <p className="text-[10px] text-violet-700 mt-1 leading-snug">
                        Verified: Instagram + 3 portfolio photos + 2 reviews (4.0+ avg).
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Portfolio gallery */}
              {profile && userId ? (
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
              ) : null}

              {/* Profile form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 mb-1">Name</Label>
                  <Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1">Role</Label>
                  <Input value={profileForm.role} onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })} placeholder="e.g., Photographer" className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1">Skills (comma-separated)</Label>
                  <Input value={profileForm.skills} onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })} placeholder="e.g., Portrait Photography, Lighting" className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1">Bio</Label>
                  <Textarea value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} rows={3} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1">Current Project</Label>
                  <Input value={profileForm.currentProject} onChange={(e) => setProfileForm({ ...profileForm, currentProject: e.target.value })} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1">Instagram</Label>
                  <Input
                    value={profileForm.instagram}
                    onChange={(e) => setProfileForm({ ...profileForm, instagram: e.target.value })}
                    placeholder="@handle or full URL"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1">LinkedIn</Label>
                  <Input
                    value={profileForm.linkedin}
                    onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
                    placeholder="linkedin.com/in/you"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1">Creative vibes</Label>
                  <p className="text-[10px] text-gray-400 mb-2">Used to rank your posts higher for similar creators.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {VIBE_PRESETS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setProfileVibes((prev) =>
                            prev.includes(v)
                              ? prev.filter((x) => x !== v)
                              : prev.length < 5
                              ? [...prev, v]
                              : prev
                          )
                        }
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                          profileVibes.includes(v)
                            ? "bg-blue-100 border-blue-400 text-blue-800"
                            : "border-gray-200 text-gray-600"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {profileMsg && (
                  <p className={`text-xs rounded-xl p-2 ${profileMsg.includes("saved") || profileMsg.includes("updated") ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                    {profileMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-2.5 bg-violet-400 text-white text-sm font-medium rounded-xl hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </form>

              <div className="pt-2 border-t border-gray-100">
                <h2 className="text-sm font-semibold text-blue-900 mb-2">Collab reviews</h2>
                {userId ? <ProfileReviews userId={userId} /> : null}
              </div>

              {/* Your posts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-900">Your posts</h2>
                  <button
                    type="button"
                    onClick={() => setShowCreatePost(true)}
                    className="text-xs font-medium text-violet-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> New
                  </button>
                </div>
                {myPosts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">You haven&apos;t created a post yet.</p>
                ) : (
                  <div className="space-y-2">
                    {myPosts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setEditingPost(p)}
                        className="w-full text-left flex items-center gap-3 p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        {p.media_urls?.[0] ? (
                          <img src={p.media_urls[0]} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-500">
                            <Pencil className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                          <p className="text-[11px] text-gray-400">
                            {new Date(p.created_at).toLocaleDateString()}
                            {p.is_active ? "" : " · inactive"}
                          </p>
                        </div>
                        <Pencil className="h-3.5 w-3.5 text-gray-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Account & safety */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowAccountSafety(true)}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Shield className="h-4 w-4 text-gray-500" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-gray-900">Account &amp; safety</p>
                    <p className="text-[11px] text-gray-400">Blocked users, delete account</p>
                  </div>
                  <Settings className="h-4 w-4 text-gray-300" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================== DETAIL MODAL ======================== */}
      <Dialog open={!!detailPost} onOpenChange={(open) => { if (!open) setDetailPost(null); }}>
        <DialogContent className="max-w-[440px] max-h-[85vh] overflow-y-auto p-0 rounded-2xl">
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <DialogTitle className="text-base font-semibold text-gray-900">{detailPost?.title}</DialogTitle>
            <button onClick={() => setDetailPost(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <DialogDescription className="sr-only">Post details</DialogDescription>
          {detailPost && (
            <div>
              <ImageGallery urls={detailPost.media_urls ?? []} height="h-56" />

              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar creator={detailPost.creator} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate flex items-center gap-1.5 flex-wrap">
                      {detailPost.creator.name}
                      {detailPost.creator.verification_status === "verified" ? (
                        <VerifiedBadge compact />
                      ) : null}
                    </p>
                    {detailPost.creator.role && <p className="text-sm text-gray-500 truncate">{detailPost.creator.role}</p>}
                    <ReputationBadge
                      avgRating={detailPost.creator.avg_rating ?? 0}
                      reviewCount={detailPost.creator.review_count ?? 0}
                      compact
                    />
                    {(detailPost.creator.instagram_url || detailPost.creator.linkedin_url) ? (
                      <div className="flex gap-2 mt-1">
                        {detailPost.creator.instagram_url ? (
                          <a href={detailPost.creator.instagram_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-violet-600 hover:underline">
                            Instagram
                          </a>
                        ) : null}
                        {detailPost.creator.linkedin_url ? (
                          <a href={detailPost.creator.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-700 hover:underline">
                            LinkedIn
                          </a>
                        ) : null}
                      </div>
                    ) : null}
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
                      className="flex items-center gap-1 px-2 py-1 border border-red-200 rounded-full text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Flag className="h-3 w-3" /> Report
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2.5 text-sm">
                  {detailPost.description && (
                    <div><span className="font-medium text-gray-700">Description:</span> <span className="text-gray-500">{detailPost.description}</span></div>
                  )}
                  {detailPost.looking_for && detailPost.looking_for.length > 0 && (
                    <div><span className="font-medium text-gray-700">Looking for:</span> <span className="text-gray-500">{detailPost.looking_for.join(", ")}</span></div>
                  )}
                  {detailPost.location && (
                    <div><span className="font-medium text-gray-700">Location:</span> <span className="text-gray-500">{detailPost.location}</span></div>
                  )}
                  {detailPost.compensation && (
                    <div><span className="font-medium text-gray-700">Compensation:</span> <span className="text-gray-500">{detailPost.compensation}</span></div>
                  )}
                  <div><span className="font-medium text-gray-700">Posted:</span> <span className="text-gray-500">{new Date(detailPost.created_at).toLocaleDateString()}</span></div>
                </div>

                {detailPost.creator.portfolio_urls && detailPost.creator.portfolio_urls.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                      More from {detailPost.creator.name}
                    </h3>
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
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================== CHAT DIALOG ======================== */}
      <Dialog open={!!chatMatch} onOpenChange={(open) => { if (!open) { setChatMatch(null); setChatMenuOpen(false); } }}>
        <DialogContent className="max-w-[440px] h-[80vh] flex flex-col p-0 rounded-2xl">
          <div className="flex items-center gap-3 p-3 border-b border-gray-100">
            <button onClick={() => setChatMatch(null)} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </button>
            {chatMatch && (
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Avatar creator={chatMatch.other_creator} size="sm" />
                <div className="min-w-0">
                  <DialogTitle className="text-sm font-semibold text-gray-900 truncate">{chatMatch.other_creator.name}</DialogTitle>
                  <DialogDescription className="text-[11px] text-gray-400 truncate">{chatMatch.other_post.title}</DialogDescription>
                </div>
              </div>
            )}
            <div className="ml-auto relative">
              <button
                onClick={() => setChatMenuOpen((o) => !o)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Conversation options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {chatMenuOpen && chatMatch ? (
                <div className="absolute right-0 top-9 z-30 w-44 bg-white border border-gray-200 rounded-xl shadow-md py-1">
                  <button
                    onClick={() => {
                      setChatMenuOpen(false);
                      setReportTarget({
                        kind: "user",
                        id: chatMatch.other_user_id,
                        label: chatMatch.other_creator.name,
                      });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Flag className="h-3.5 w-3.5 text-red-500" /> Report user
                  </button>
                  <button
                    onClick={confirmBlock}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Block user
                  </button>
                </div>
              ) : null}
            </div>
            <button onClick={() => { setChatMatch(null); setChatMenuOpen(false); }} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {chatMatch && userId && isReviewEligible(chatMatch.created_at) && !chatHasReview ? (
            <div className="mx-4 mt-2 mb-1 p-2.5 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-between gap-2">
              <p className="text-[11px] text-violet-900 leading-snug">
                Collaborated with {chatMatch.other_creator.name}? Leave a review.
              </p>
              <button
                type="button"
                onClick={() =>
                  setReviewDialog({
                    matchId: chatMatch.id,
                    revieweeId: chatMatch.other_user_id,
                    revieweeName: chatMatch.other_creator.name,
                  })
                }
                className="text-[11px] font-medium px-2.5 py-1 bg-violet-400 text-white rounded-full shrink-0"
              >
                Review
              </button>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-4 py-3" onClick={() => setChatMenuOpen(false)}>
            {messagesLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">No messages yet. Say hello!</div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMe = msg.sender_id === userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                        isMe ? "bg-violet-500 text-white rounded-br-md" : "bg-gray-100 text-gray-800 rounded-bl-md"
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-violet-200" : "text-gray-400"}`}>
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
            <div className="mx-4 p-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">{chatError}</div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-3 border-t border-gray-100">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              autoFocus
            />
            <button
              type="submit"
              disabled={sending || !messageText.trim()}
              className="w-9 h-9 flex items-center justify-center bg-violet-500 text-white rounded-full hover:bg-violet-600 disabled:opacity-40 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================== CREATE POST DIALOG ======================== */}
      <Dialog
        open={showCreatePost}
        onOpenChange={(open) => {
          if (!open) {
            resetCreatePost();
            setShowCreatePost(false);
          }
        }}
      >
        <DialogContent className="max-w-[440px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
          <div className="p-4 border-b border-gray-100">
            <DialogTitle className="text-base font-semibold text-gray-900">New Collaboration Post</DialogTitle>
            <DialogDescription className="text-xs text-gray-400 mt-0.5">
              Describe what you&apos;re looking for. Others will see this in their feed.
            </DialogDescription>
          </div>
          <form onSubmit={handleCreatePost} className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1">Title</Label>
              <Input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="e.g., Looking for a photographer" required className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Description</Label>
              <Textarea value={newPostDescription} onChange={(e) => setNewPostDescription(e.target.value)} placeholder="Describe the collaboration, style, timeline, etc." rows={3} required className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Looking for (comma-separated)</Label>
              <Input value={newPostLookingFor} onChange={(e) => setNewPostLookingFor(e.target.value)} placeholder="e.g., Photographer, Model, MUA" className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Location</Label>
              <Input value={newPostLocation} onChange={(e) => setNewPostLocation(e.target.value)} placeholder="e.g., New York, NY" className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Compensation</Label>
              <Input value={newPostCompensation} onChange={(e) => setNewPostCompensation(e.target.value)} placeholder="e.g., TFP, $200/hr, Revenue share" className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Images (up to 5)</Label>
              <div className="flex flex-wrap gap-2">
                {newPostImages.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewPostImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/55 rounded-full flex items-center justify-center text-white"
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
                    className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Add</span>
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
            {createPostError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{createPostError}</p>
            )}
            <button
              type="submit"
              disabled={creatingPost || !newPostTitle.trim() || !newPostDescription.trim()}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {creatingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {creatingPost ? "Creating..." : "Create Post"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================== EDIT POST ======================== */}
      {userId ? (
        <EditPostDialog
          userId={userId}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={async () => { await Promise.all([loadPosts(), loadMyPosts()]); }}
          onDeleted={async () => { await Promise.all([loadPosts(), loadMyPosts()]); }}
        />
      ) : null}

      {/* ======================== ACCOUNT & SAFETY ======================== */}
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

      {/* ======================== REPORT ======================== */}
      {userId ? (
        <ReportDialog
          reporterId={userId}
          target={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      ) : null}

      {userId && reviewDialog ? (
        <ReviewDialog
          open
          onClose={() => setReviewDialog(null)}
          matchId={reviewDialog.matchId}
          reviewerId={userId}
          revieweeId={reviewDialog.revieweeId}
          revieweeName={reviewDialog.revieweeName}
          onSubmitted={() => setChatHasReview(true)}
        />
      ) : null}

      {/* ======================== PORTFOLIO LIGHTBOX ======================== */}
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
