"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  getUnswipedPosts,
  recordSwipe,
  checkAndCreateMatch,
  getMatches,
  type CollabPost,
  type MatchWithPost,
} from "../lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Heart } from "lucide-react";

export default function MelangeApp({ onSignOut }: { onSignOut: () => void }) {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("connect");
  const [posts, setPosts] = useState<CollabPost[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [matches, setMatches] = useState<MatchWithPost[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [err, setErr] = useState("");

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
    if (!userId) {
      console.log("[loadMatches] No userId, skipping");
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/components/MelangeApp.tsx:loadMatches:enter',message:'enter',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    console.log("[loadMatches] Loading matches for user", { userId });
    setErr("");

    const { data, error } = await getMatches(userId);

    if (error) {
      console.error("[loadMatches] Error loading matches", { error });
      setErr(error);
      return;
    }

    console.log("[loadMatches] Matches loaded", { count: data?.length || 0, matches: data });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/components/MelangeApp.tsx:loadMatches:return',message:'return',data:{count:data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    setMatches(data || []);
  };

  const handleSwipe = async (direction: "left" | "right") => {
    if (!userId || swiping || posts.length === 0) return;

    const currentPost = posts[currentPostIndex];
    if (!currentPost) return;

    setSwiping(true);
    setErr("");

    // Record the swipe
    const { error: swipeError } = await recordSwipe(userId, currentPost.id, direction);

    if (swipeError) {
      setErr(swipeError);
      setSwiping(false);
      return;
    }

    // If swiped right, check for match
    if (direction === "right") {
      console.log("[handleSwipe] Swiped right, checking for match", { userId, postId: currentPost.id, postTitle: currentPost.title });
      const { match, error: matchError } = await checkAndCreateMatch(userId, currentPost.id);

      if (matchError) {
        console.error("[handleSwipe] Match check error", { matchError });
        setErr(matchError);
      } else if (match) {
        console.log("[handleSwipe] Match created! Reloading matches...", { match });
        // Match created! Reload matches
        await loadMatches();
        console.log("[handleSwipe] Matches reloaded");
      } else {
        console.log("[handleSwipe] No match yet (waiting for reciprocal swipe)");
      }
    }

    // Move to next post
    if (currentPostIndex < posts.length - 1) {
      setCurrentPostIndex(currentPostIndex + 1);
    } else {
      // No more posts, reload
      await loadPosts();
    }

    setSwiping(false);
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
          <div>
            <div className="opacity-70 text-sm">Logged in as {email || "(unknown)"}</div>
            {userId && <div className="opacity-50 text-xs mt-1">User ID: {userId}</div>}
          </div>
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
                <div className="opacity-70 mb-4">No more posts to swipe on!</div>
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
                    <div className="text-xs opacity-30 mt-1">owner_id: {currentPost.owner_id}</div>
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

            {loading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="opacity-70">Loading matches...</div>
              </div>
            ) : matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="opacity-70 mb-4">
                  <p className="mb-2">No matches yet.</p>
                  <p className="text-sm">Start swiping to find collaborators!</p>
                </div>
                <Button onClick={loadMatches} variant="outline" size="sm">
                  Refresh Matches
                </Button>
                <div className="mt-4 text-xs opacity-50">
                  Check console (F12) for debug logs
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => (
                  <Card
                    key={match.id}
                    className="cursor-pointer hover:bg-zinc-900 transition-colors"
                    onClick={() => setSelectedMatch(match)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {(() => {
                          // Handle both old schema (media_url) and new schema (media_urls)
                          const img = match.other_post.media_urls?.[0] || (match.other_post as any).media_url;
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

      {/* Chat Dialog */}
      <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedMatch?.other_post.title || "Chat"}
            </DialogTitle>
            <DialogDescription>
              {selectedMatch?.other_post.description || "Start a conversation"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 bg-zinc-900/50 rounded-lg min-h-[300px] flex items-center justify-center">
            <div className="text-center opacity-70">
              <p className="mb-2">Chat coming soon!</p>
              <p className="text-sm">This is a placeholder for the messaging feature.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
