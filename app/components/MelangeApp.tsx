"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  getUnswipedPosts,
  recordSwipe,
  checkAndCreateMatch,
  getMatches,
  getMessages,
  sendMessage,
  createPost,
  type CollabPost,
  type MatchWithPost,
  type Message,
} from "../lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Heart, Plus, ArrowLeft, Send } from "lucide-react";

export default function MelangeApp({ onSignOut }: { onSignOut: () => void }) {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("connect");
  const [posts, setPosts] = useState<CollabPost[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [matches, setMatches] = useState<MatchWithPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [err, setErr] = useState("");

  // Create Post dialog state
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostDescription, setNewPostDescription] = useState("");
  const [creatingPost, setCreatingPost] = useState(false);
  const [createPostError, setCreatePostError] = useState("");

  // Chat state
  const [chatMatch, setChatMatch] = useState<MatchWithPost | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");

  const loadUser = async () => {
    const { data: authRes, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setErr(authErr.message);
      return;
    }
    setEmail(authRes?.user?.email ?? "");
    setUserId(authRes?.user?.id ?? null);
  };

  const loadPosts = async () => {
    if (!userId) return;

    setErr("");
    setLoading(true);

    const { data, error } = await getUnswipedPosts(userId);

    if (error) {
      setErr(error);
      setLoading(false);
      return;
    }

    setPosts(data || []);
    setCurrentPostIndex(0);
    setLoading(false);
  };

  const loadMatches = async () => {
    if (!userId) return;

    setErr("");

    const { data, error } = await getMatches(userId);

    if (error) {
      setErr(error);
      return;
    }

    setMatches(data || []);
  };

  const handleSwipe = async (direction: "left" | "right") => {
    if (!userId || swiping || posts.length === 0) return;

    const currentPost = posts[currentPostIndex];
    if (!currentPost) return;

    setSwiping(true);
    setErr("");

    const { error: swipeError } = await recordSwipe(userId, currentPost.id, direction);

    if (swipeError) {
      setErr(swipeError);
      setSwiping(false);
      return;
    }

    if (direction === "right") {
      const { match, error: matchError } = await checkAndCreateMatch(userId, currentPost.id);

      if (matchError) {
        setErr(matchError);
      } else if (match) {
        await loadMatches();
      }
    }

    if (currentPostIndex < posts.length - 1) {
      setCurrentPostIndex(currentPostIndex + 1);
    } else {
      await loadPosts();
    }

    setSwiping(false);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setCreatingPost(true);
    setCreatePostError("");

    const { error } = await createPost(userId, newPostTitle.trim(), newPostDescription.trim());

    if (error) {
      setCreatePostError(error);
      setCreatingPost(false);
      return;
    }

    setNewPostTitle("");
    setNewPostDescription("");
    setShowCreatePost(false);
    setCreatingPost(false);
    await loadPosts();
  };

  const openChat = async (match: MatchWithPost) => {
    setChatMatch(match);
    setMessages([]);
    setChatError("");
    setMessagesLoading(true);

    const { data, error } = await getMessages(match.id);
    if (error) {
      setChatError(error);
    }
    setMessages(data || []);
    setMessagesLoading(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMatch || !userId || !messageText.trim() || sending) return;

    setChatError("");
    setSending(true);
    const { data, error } = await sendMessage(chatMatch.id, userId, messageText.trim());

    if (error) {
      setChatError(error);
    } else if (data) {
      setMessages((prev) => [...prev, data]);
      setMessageText("");
    }
    setSending(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadPosts();
      loadMatches();
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab === "messages") {
      loadMatches();
    }
  }, [activeTab]);

  const currentPost = posts[currentPostIndex];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="opacity-70 text-sm">Logged in as {email || "(unknown)"}</div>
          <Button onClick={signOut} variant="outline" size="sm">
            Sign out
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="connect">Connect</TabsTrigger>
            <TabsTrigger value="messages">
              Messages {matches.length > 0 && `(${matches.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connect" className="mt-6">
            <div className="flex justify-center mb-6">
              <Button onClick={() => setShowCreatePost(true)} className="bg-violet-600 hover:bg-violet-700">
                <Plus className="mr-2 h-4 w-4" />
                New Post
              </Button>
            </div>

            {err && (
              <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">
                Error: {err}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="opacity-70">Loading posts...</div>
              </div>
            ) : !currentPost ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="opacity-70 mb-4">
                  <p className="mb-2">No posts to swipe on yet.</p>
                  <p className="text-sm">Create a post so others can find you!</p>
                </div>
                <Button onClick={loadPosts} variant="outline">
                  Refresh
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Card className="w-full max-w-md mb-6">
                  <CardHeader>
                    <CardTitle className="text-xl">{currentPost.title}</CardTitle>
                    {currentPost.description && (
                      <CardDescription className="text-white/70">
                        {currentPost.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const img = currentPost.media_urls?.[0];
                      return img ? (
                        <div className="mb-4 rounded-lg overflow-hidden bg-zinc-900 aspect-video flex items-center justify-center">
                          <img
                            src={img}
                            alt={currentPost.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null;
                    })()}
                    <div className="text-xs opacity-50">
                      {posts.length - currentPostIndex - 1} posts remaining
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-4">
                  <Button
                    onClick={() => handleSwipe("left")}
                    disabled={swiping}
                    variant="outline"
                    size="lg"
                    className="px-8"
                  >
                    <X className="mr-2 h-5 w-5" />
                    Pass
                  </Button>
                  <Button
                    onClick={() => handleSwipe("right")}
                    disabled={swiping}
                    size="lg"
                    className="px-8 bg-green-600 hover:bg-green-700"
                  >
                    <Heart className="mr-2 h-5 w-5" />
                    Like
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            {err && (
              <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">
                Error: {err}
              </div>
            )}

            {matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="opacity-70 mb-4">
                  <p className="mb-2">No matches yet.</p>
                  <p className="text-sm">Start swiping to find collaborators!</p>
                </div>
                <Button onClick={loadMatches} variant="outline" size="sm">
                  Refresh Matches
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => (
                  <Card
                    key={match.id}
                    className="cursor-pointer hover:bg-zinc-900 transition-colors"
                    onClick={() => openChat(match)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {(() => {
                          const img = match.other_post.media_urls?.[0];
                          return img ? (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0">
                              <img
                                src={img}
                                alt={match.other_post.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : null;
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{match.other_post.title}</div>
                          {match.other_post.description && (
                            <div className="text-sm opacity-70 truncate">
                              {match.other_post.description}
                            </div>
                          )}
                          <div className="text-xs opacity-50 mt-1">
                            Matched {new Date(match.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat dialog */}
      <Dialog open={!!chatMatch} onOpenChange={(open) => { if (!open) setChatMatch(null); }}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
          <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
            <Button variant="ghost" size="sm" onClick={() => setChatMatch(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <DialogTitle className="text-base truncate">
                {chatMatch?.other_post.title || "Chat"}
              </DialogTitle>
              <DialogDescription className="text-xs truncate">
                {chatMatch?.other_post.description || ""}
              </DialogDescription>
            </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            {messagesLoading ? (
              <div className="flex items-center justify-center py-12 opacity-70">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-12 opacity-50 text-sm">
                No messages yet. Say hello!
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {messages.map((msg) => {
                  const isMe = msg.sender_id === userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          isMe
                            ? "bg-violet-600 text-white rounded-br-md"
                            : "bg-zinc-800 text-white rounded-bl-md"
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-violet-200" : "text-zinc-500"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {chatError && (
            <div className="mx-4 mb-0 p-2 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs">
              {chatError}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-4 border-t border-zinc-800">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={sending || !messageText.trim()} className="bg-violet-600 hover:bg-violet-700">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Post dialog */}
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Collaboration Post</DialogTitle>
            <DialogDescription>
              Describe what you're looking for. Other creatives will see this in their feed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePost} className="space-y-4">
            <div>
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="e.g., Looking for a photographer for portfolio shoot"
                required
              />
            </div>
            <div>
              <Label htmlFor="post-description">Description</Label>
              <Textarea
                id="post-description"
                value={newPostDescription}
                onChange={(e) => setNewPostDescription(e.target.value)}
                placeholder="Describe the collaboration, style, timeline, etc."
                rows={4}
                required
              />
            </div>
            {createPostError && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md p-2">
                {createPostError}
              </p>
            )}
            <Button
              type="submit"
              disabled={creatingPost || !newPostTitle.trim() || !newPostDescription.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {creatingPost ? "Creating..." : "Create Post"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
