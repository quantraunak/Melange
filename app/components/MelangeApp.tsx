"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  getUnswipedPosts,
  recordSwipe,
  checkAndCreateMatch,
  getMatches,
  getMessages,
  sendMessage,
  createPost,
  getProfile,
  updateProfile,
  type CollabPost,
  type MatchWithPost,
  type Message,
  type Profile,
} from "../lib/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  X,
  Heart,
  Plus,
  ArrowLeft,
  Send,
  Search,
  Info,
  MapPin,
  Briefcase,
  DollarSign,
  Users,
  ChevronRight,
  Camera,
  Star,
  LogOut,
} from "lucide-react";

// -- Demo data for Explore tab (no backend) --
const DEMO_IDEAS = [
  {
    id: "d1",
    title: "Street Photography Walk",
    preview: "Looking for photographers to join a weekend street photography session in downtown area.",
    creator: "Alex, Photographer",
  },
  {
    id: "d2",
    title: "Fashion Lookbook Shoot",
    preview: "Assembling a team for a spring fashion lookbook. Need models, MUA, and stylist.",
    creator: "Emma, Project Manager",
  },
  {
    id: "d3",
    title: "Music Video Production",
    preview: "Indie band seeking creative director and videographer for upcoming single release.",
    creator: "Jordan, Musician",
  },
];

const DEMO_EVENTS = [
  {
    id: "e1",
    title: "NYC Creative Meetup",
    preview: "Monthly gathering for creatives in the NYC area. Networking, portfolio reviews, and collaboration.",
    creator: "Melange Community",
  },
  {
    id: "e2",
    title: "LA Photo Walk - March",
    preview: "Join us for a golden hour photo walk through Arts District. All skill levels welcome.",
    creator: "LA Creatives Group",
  },
];

type Tab = "connect" | "explore" | "messages" | "profile";

export default function MelangeApp({ onSignOut }: { onSignOut: () => void }) {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("connect");

  // Connect
  const [posts, setPosts] = useState<CollabPost[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [err, setErr] = useState("");
  const [detailPost, setDetailPost] = useState<CollabPost | null>(null);

  // Create Post
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostDescription, setNewPostDescription] = useState("");
  const [creatingPost, setCreatingPost] = useState(false);
  const [createPostError, setCreatePostError] = useState("");

  // Messages
  const [matches, setMatches] = useState<MatchWithPost[]>([]);
  const [chatMatch, setChatMatch] = useState<MatchWithPost | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");

  // Explore
  const [exploreToggle, setExploreToggle] = useState<"ideas" | "events">("ideas");

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", role: "", bio: "", currentProject: "", skills: "", instagram: "", linkedin: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Data loading ---

  const loadUser = async () => {
    const { data: authRes, error: authErr } = await supabase.auth.getUser();
    if (authErr) { setErr(authErr.message); return; }
    setEmail(authRes?.user?.email ?? "");
    setUserId(authRes?.user?.id ?? null);
  };

  const loadPosts = async () => {
    if (!userId) return;
    setErr(""); setLoading(true);
    const { data, error } = await getUnswipedPosts(userId);
    if (error) { setErr(error); setLoading(false); return; }
    setPosts(data || []); setCurrentPostIndex(0); setLoading(false);
  };

  const loadMatches = async () => {
    if (!userId) return;
    const { data, error } = await getMatches(userId);
    if (error) { setErr(error); return; }
    setMatches(data || []);
  };

  const loadProfile = async () => {
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
        instagram: "",
        linkedin: "",
      });
    }
  };

  // --- Handlers ---

  const handleSwipe = async (direction: "left" | "right") => {
    if (!userId || swiping || posts.length === 0) return;
    const currentPost = posts[currentPostIndex];
    if (!currentPost) return;
    setSwiping(true); setErr("");
    const { error: swipeError } = await recordSwipe(userId, currentPost.id, direction);
    if (swipeError) { setErr(swipeError); setSwiping(false); return; }
    if (direction === "right") {
      const { match, error: matchError } = await checkAndCreateMatch(userId, currentPost.id);
      if (matchError) setErr(matchError);
      else if (match) await loadMatches();
    }
    if (currentPostIndex < posts.length - 1) setCurrentPostIndex(currentPostIndex + 1);
    else await loadPosts();
    setSwiping(false);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setCreatingPost(true); setCreatePostError("");
    const { error } = await createPost(userId, newPostTitle.trim(), newPostDescription.trim());
    if (error) { setCreatePostError(error); setCreatingPost(false); return; }
    setNewPostTitle(""); setNewPostDescription(""); setShowCreatePost(false); setCreatingPost(false);
    await loadPosts();
  };

  const openChat = async (match: MatchWithPost) => {
    setChatMatch(match); setMessages([]); setChatError(""); setMessagesLoading(true);
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
    else if (data) { setMessages((prev) => [...prev, data]); setMessageText(""); }
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

  const signOut = async () => { await supabase.auth.signOut(); onSignOut(); };

  // --- Effects ---

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (userId) { loadPosts(); loadMatches(); loadProfile(); } }, [userId]);
  useEffect(() => { if (activeTab === "messages") loadMatches(); }, [activeTab]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // --- Render helpers ---

  const currentPost = posts[currentPostIndex];

  const Logo = () => (
    <svg className="h-10 w-10" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#E0F2FE" stroke="#4338ca" strokeWidth="2" />
      <path d="M50 10C55 25 75 40 90 50C75 60 55 75 50 90C45 75 25 60 10 50C25 40 45 25 50 10Z" fill="#BFDBFE" stroke="#4338ca" strokeWidth="2" />
      <circle cx="50" cy="50" r="10" fill="#4338ca" />
    </svg>
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "connect", label: "Connect" },
    { key: "explore", label: "Explore" },
    { key: "messages", label: `Messages${matches.length > 0 ? ` (${matches.length})` : ""}` },
    { key: "profile", label: "Profile" },
  ];

  // ============================
  // MAIN RENDER
  // ============================

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
                className={`flex-1 text-xs font-medium py-2 rounded-full transition-all ${
                  activeTab === t.key
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-white hover:text-blue-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">

          {/* ======================== CONNECT TAB ======================== */}
          {activeTab === "connect" && (
            <div className="pt-3">
              {/* Search bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search job type, compensation, or location..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  readOnly
                />
              </div>

              {/* New Post button */}
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> New Post
                </button>
              </div>

              {err && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{err}</div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading posts...</div>
              ) : !currentPost ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-gray-500 mb-1">No posts to swipe on yet.</p>
                  <p className="text-gray-400 text-sm mb-4">Create a post so others can find you!</p>
                  <button onClick={loadPosts} className="text-sm text-blue-600 hover:underline">Refresh</button>
                </div>
              ) : (
                <>
                  {/* Post card */}
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-4">
                    {/* Card image area */}
                    <div className="relative h-48 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50 flex items-center justify-center">
                      {currentPost.media_urls?.[0] ? (
                        <img src={currentPost.media_urls[0]} alt={currentPost.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-4xl opacity-20">🎨</div>
                      )}
                      <button
                        onClick={() => setDetailPost(currentPost)}
                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                      >
                        <Info className="h-4 w-4 text-blue-600" />
                      </button>
                    </div>
                    {/* Card body */}
                    <div className="p-4 space-y-1.5">
                      <h3 className="font-semibold text-gray-900 text-base">{currentPost.title}</h3>
                      {currentPost.description && (
                        <p className="text-gray-500 text-sm line-clamp-2">{currentPost.description}</p>
                      )}
                      {currentPost.location && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin className="h-3 w-3" /> {currentPost.location}
                        </div>
                      )}
                      {currentPost.looking_for && currentPost.looking_for.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Users className="h-3 w-3" /> Looking for: {currentPost.looking_for.join(", ")}
                        </div>
                      )}
                      {currentPost.compensation && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <DollarSign className="h-3 w-3" /> {currentPost.compensation}
                        </div>
                      )}
                      <p className="text-[11px] text-gray-300 pt-1">{posts.length - currentPostIndex - 1} posts remaining</p>
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

          {/* ======================== EXPLORE TAB ======================== */}
          {activeTab === "explore" && (
            <div className="pt-3">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search ideas or events..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                  readOnly
                />
              </div>

              {/* Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setExploreToggle("ideas")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    exploreToggle === "ideas" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  Collaboration Ideas
                </button>
                <button
                  onClick={() => setExploreToggle("events")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    exploreToggle === "events" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  Local Events
                </button>
              </div>

              {/* Section header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  {exploreToggle === "ideas" ? "Collaboration Ideas" : "Local Events"}
                </h2>
                <button className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors">
                  <Plus className="h-3 w-3" /> New {exploreToggle === "ideas" ? "Idea" : "Event"}
                </button>
              </div>

              {/* List */}
              <div className="space-y-2.5">
                {(exploreToggle === "ideas" ? DEMO_IDEAS : DEMO_EVENTS).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow cursor-pointer">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-blue-700 truncate">{item.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{item.preview}</p>
                      <p className="text-[11px] text-purple-500 mt-0.5">{item.creator}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================== MESSAGES TAB ======================== */}
          {activeTab === "messages" && (
            <div className="pt-3">
              {/* Sub-tabs */}
              <div className="flex gap-2 mb-4">
                <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Messages</span>
                <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Matches</span>
              </div>

              {err && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{err}</div>
              )}

              {matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-gray-500 mb-1">No matches yet.</p>
                  <p className="text-gray-400 text-sm mb-4">Start swiping to find collaborators!</p>
                  <button onClick={loadMatches} className="text-sm text-blue-600 hover:underline">Refresh</button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      onClick={() => openChat(match)}
                      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-200 to-purple-200 flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{match.other_post.title}</h3>
                        {match.other_post.description && (
                          <p className="text-xs text-gray-500 truncate">{match.other_post.description}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Matched {new Date(match.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================== PROFILE TAB ======================== */}
          {activeTab === "profile" && (
            <div className="pt-3">
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

                {/* Portfolio grid */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Portfolio</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                        <Camera className="h-5 w-5 text-gray-300" />
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add Photo
                  </button>
                </div>

                {/* Social media */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Social Media</h3>
                  <div className="space-y-2">
                    <Input value={profileForm.instagram} onChange={(e) => setProfileForm({ ...profileForm, instagram: e.target.value })} placeholder="Instagram username" className="rounded-xl" />
                    <Input value={profileForm.linkedin} onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })} placeholder="LinkedIn profile URL" className="rounded-xl" />
                  </div>
                </div>

                {profileMsg && (
                  <p className={`text-xs rounded-xl p-2 ${profileMsg.includes("saved") ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
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
              <div className="h-48 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50 flex items-center justify-center">
                {detailPost.media_urls?.[0] ? (
                  <img src={detailPost.media_urls[0]} alt={detailPost.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-4xl opacity-20">🎨</div>
                )}
              </div>
              <div className="p-4 space-y-3 text-sm">
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

                {/* Reviews placeholder */}
                <div className="pt-3 border-t border-gray-100">
                  <h4 className="font-medium text-gray-700 mb-2">Reviews</h4>
                  <div className="space-y-2">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-medium text-gray-700">Sarah M.</span>
                        <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}</div>
                      </div>
                      <p className="text-xs text-gray-500">Great collaborator, very professional and creative!</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-medium text-gray-700">Mike R.</span>
                        <div className="flex">{[...Array(4)].map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}<Star className="h-3 w-3 text-gray-300" /></div>
                      </div>
                      <p className="text-xs text-gray-500">Easy to work with and delivered on time.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================== CHAT DIALOG ======================== */}
      <Dialog open={!!chatMatch} onOpenChange={(open) => { if (!open) setChatMatch(null); }}>
        <DialogContent className="max-w-[440px] h-[75vh] flex flex-col p-0 rounded-2xl">
          <div className="flex items-center gap-3 p-3 border-b border-gray-100">
            <button onClick={() => setChatMatch(null)} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold text-gray-900 truncate">{chatMatch?.other_post.title}</DialogTitle>
              <DialogDescription className="text-[11px] text-gray-400 truncate">{chatMatch?.other_post.description || ""}</DialogDescription>
            </div>
            <button onClick={() => setChatMatch(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
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
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent className="max-w-[440px] p-0 rounded-2xl">
          <div className="p-4 border-b border-gray-100">
            <DialogTitle className="text-base font-semibold text-gray-900">New Collaboration Post</DialogTitle>
            <DialogDescription className="text-xs text-gray-400 mt-0.5">Describe what you&apos;re looking for. Others will see this in their feed.</DialogDescription>
          </div>
          <form onSubmit={handleCreatePost} className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1">Title</Label>
              <Input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="e.g., Looking for a photographer" required className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1">Description</Label>
              <Textarea value={newPostDescription} onChange={(e) => setNewPostDescription(e.target.value)} placeholder="Describe the collaboration..." rows={4} required className="rounded-xl" />
            </div>
            {createPostError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{createPostError}</p>
            )}
            <button
              type="submit"
              disabled={creatingPost || !newPostTitle.trim() || !newPostDescription.trim()}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creatingPost ? "Creating..." : "Create Post"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
