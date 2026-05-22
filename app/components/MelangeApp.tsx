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
  recordSwipe,
  sendMessage,
  updateProfile,
  uploadFile,
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

type Tab = "connect" | "messages" | "profile";

function Logo() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#E0F2FE" stroke="#4338ca" strokeWidth="2" />
      <path d="M50 10C55 25 75 40 90 50C75 60 55 75 50 90C45 75 25 60 10 50C25 40 45 25 50 10Z" fill="#BFDBFE" stroke="#4338ca" strokeWidth="2" />
      <circle cx="50" cy="50" r="10" fill="#4338ca" />
    </svg>
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
    setProfileMsg(error ? error : "Profile saved!");
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
    setProfileMsg("Avatar updated!");
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
    { key: "messages", label: "Messages", badge: unreadCount },
    { key: "profile", label: "Profile" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-4 px-4">
      <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col min-h-[90vh]">

        {/* Brand header */}
        <div className="bg-blue-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-xl font-bold italic -skew-x-3" style={{ WebkitTextStroke: "1px #818cf8", paintOrder: "stroke fill" }}>
                Melange
              </h1>
              <p className="text-[11px] text-blue-200 -mt-0.5">Creative Collaborations</p>
            </div>
          </div>
          <button onClick={signOut} className="text-blue-200 hover:text-white transition-colors" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="px-4 pt-4 pb-2">
          <div className="bg-blue-600 rounded-full p-1 flex">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 text-xs font-medium py-2 rounded-full transition-all relative ${
                  activeTab === t.key
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-white hover:text-blue-100"
                }`}
              >
                {t.label}
                {t.badge && t.badge > 0 ? (
                  <span className="absolute -top-1 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Match toast */}
        {matchToast ? (
          <div className="mx-4 mt-2 mb-1 px-3 py-2 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm">
            <Heart className="h-3.5 w-3.5 fill-white" />
            {matchToast}
          </div>
        ) : null}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">

          {/* ======================== CONNECT TAB ======================== */}
          {activeTab === "connect" && (
            <div className="pt-3">
              {/* Search + New Post */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    value={connectSearch}
                    onChange={(e) => setConnectSearch(e.target.value)}
                    placeholder="Filter by role, location, skill..."
                    className="w-full pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  />
                  {connectSearch && (
                    <button onClick={() => setConnectSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors flex-shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> New Post
                </button>
              </div>

              {connectErr && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{connectErr}</div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading posts...</div>
              ) : !currentPost ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-gray-500 mb-1">{connectSearch ? "No posts match your filter." : "No posts to swipe on yet."}</p>
                  <p className="text-gray-400 text-sm mb-4">{connectSearch ? "Try a different search term." : "Create a post so others can find you!"}</p>
                  {connectSearch ? (
                    <button onClick={() => setConnectSearch("")} className="text-sm text-blue-600 hover:underline">Clear filter</button>
                  ) : (
                    <button onClick={loadPosts} className="text-sm text-blue-600 hover:underline">Refresh</button>
                  )}
                </div>
              ) : (
                <>
                  {/* Post card */}
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-4">
                    <div className="relative">
                      <ImageGallery urls={currentPost.media_urls ?? []} />
                      <button
                        onClick={() => setDetailPost(currentPost)}
                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                        aria-label="Post details"
                      >
                        <Info className="h-4 w-4 text-blue-600" />
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <Avatar creator={currentPost.creator} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{currentPost.creator.name}</p>
                          {currentPost.creator.role && (
                            <p className="text-xs text-gray-500 truncate">{currentPost.creator.role}</p>
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
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Report post"
                          aria-label="Report post"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <h3 className="font-semibold text-gray-900 text-base mb-1">{currentPost.title}</h3>
                      {currentPost.description && (
                        <p className="text-gray-500 text-sm line-clamp-2 mb-2">{currentPost.description}</p>
                      )}

                      <div className="space-y-1">
                        {currentPost.location && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <MapPin className="h-3 w-3 flex-shrink-0" /> {currentPost.location}
                          </div>
                        )}
                        {currentPost.looking_for && currentPost.looking_for.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Users className="h-3 w-3 flex-shrink-0" /> Looking for: {currentPost.looking_for.join(", ")}
                          </div>
                        )}
                        {currentPost.compensation && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <DollarSign className="h-3 w-3 flex-shrink-0" /> {currentPost.compensation}
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-300 mt-2">{visiblePosts.length - currentPostIndex - 1} posts remaining{connectSearch ? " (filtered)" : ""}</p>
                    </div>
                  </div>

                  {/* Swipe buttons */}
                  <div className="flex justify-center gap-4 mb-2">
                    <button
                      onClick={() => handleSwipe("left")}
                      disabled={swiping}
                      className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      <X className="h-4 w-4" /> Pass
                    </button>
                    <button
                      onClick={() => handleSwipe("right")}
                      disabled={swiping}
                      className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white rounded-full text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      <Heart className="h-4 w-4" /> Like
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ======================== MESSAGES TAB ======================== */}
          {activeTab === "messages" && (
            <div className="pt-3">
              {matchErr && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{matchErr}</div>
              )}

              {matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-gray-500 mb-1">No matches yet.</p>
                  <p className="text-gray-400 text-sm mb-4">Start swiping to find collaborators!</p>
                  <button onClick={loadMatches} className="text-sm text-blue-600 hover:underline">Refresh</button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {matches.map((match) => {
                    const unread = userId ? isMatchUnread(match, userId) : false;
                    return (
                      <div
                        key={match.id}
                        onClick={() => openChat(match)}
                        className={`flex items-center gap-3 bg-white border rounded-xl p-3 hover:shadow-sm transition-shadow cursor-pointer ${
                          unread ? "border-blue-300 bg-blue-50/40" : "border-gray-200"
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
                    <p className="font-semibold text-gray-900 truncate">{profile.name}</p>
                    {profile.role && <p className="text-sm text-gray-500 truncate">{profile.role}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">Click avatar to change</p>
                  </div>
                </div>
              )}

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

                {profileMsg && (
                  <p className={`text-xs rounded-xl p-2 ${profileMsg.includes("saved") || profileMsg.includes("updated") ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                    {profileMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </form>

              {/* Your posts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-900">Your posts</h2>
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="text-xs font-medium text-blue-700 hover:underline flex items-center gap-1"
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
                    <p className="font-semibold text-gray-900 truncate">{detailPost.creator.name}</p>
                    {detailPost.creator.role && <p className="text-sm text-gray-500 truncate">{detailPost.creator.role}</p>}
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
    </div>
  );
}
