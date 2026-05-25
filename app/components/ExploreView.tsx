"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Plus } from "lucide-react";
import { getExplorePosts, type PostWithCreator } from "../lib/db";
import EventsView from "./EventsView";

type ExploreSubTab = "ideas" | "events";

export default function ExploreView({
  userId,
  onNewIdea,
  onOpenPost,
}: {
  userId: string;
  onNewIdea: () => void;
  onOpenPost: (post: PostWithCreator) => void;
}) {
  const [subTab, setSubTab] = useState<ExploreSubTab>("ideas");
  const [posts, setPosts] = useState<PostWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await getExplorePosts(userId);
    if (err) setError(err);
    setPosts(data || []);
    setLoading(false);
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (subTab === "ideas") load(); }, [subTab, load]);

  const subTabs: { key: ExploreSubTab; label: string }[] = [
    { key: "ideas", label: "Collaboration Ideas" },
    { key: "events", label: "Local Events" },
  ];

  return (
    <div className="pt-2">
      <div className="grid grid-cols-2 bg-blue-800 rounded-lg overflow-hidden mb-3">
        {subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={`text-[11px] font-medium py-2 px-1 transition-colors ${
              subTab === t.key ? "bg-blue-100 text-blue-800" : "bg-blue-700 text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "ideas" ? (
        <>
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onNewIdea}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-violet-400 text-white rounded-full hover:bg-violet-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New Idea
            </button>
          </div>

          {error ? (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-2">{error}</p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-14 px-2">
              <p className="text-sm text-gray-600 mb-1">No collaboration ideas yet</p>
              <p className="text-xs text-gray-400 mb-3">Be the first to post what you&apos;re looking for.</p>
              <button
                type="button"
                onClick={onNewIdea}
                className="text-xs font-medium px-4 py-2 bg-blue-800 text-white rounded-full hover:bg-blue-900"
              >
                New Idea
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => {
                const thumb = post.media_urls?.[0];
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => onOpenPost(post)}
                    className="w-full flex gap-3 p-2.5 bg-white border border-blue-100 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-violet-100 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-blue-900 line-clamp-1">{post.title}</h3>
                      <p className="text-xs text-violet-600 font-medium truncate">{post.creator.name}</p>
                      {post.creator.role ? (
                        <p className="text-[11px] text-gray-500 truncate">{post.creator.role}</p>
                      ) : null}
                      {post.location ? (
                        <p className="text-[11px] text-gray-400 flex items-center gap-0.5 mt-0.5 truncate">
                          <MapPin className="h-3 w-3 flex-shrink-0" /> {post.location}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <EventsView userId={userId} embedded />
      )}
    </div>
  );
}
