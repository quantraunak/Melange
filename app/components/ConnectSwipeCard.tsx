"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Heart,
  Info,
  MapPin,
  Users,
  X,
} from "lucide-react";
import type { PostWithCreator } from "../lib/db";

const SWIPE_THRESHOLD = 90;

function CardImage({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-blue-200 via-violet-100 to-blue-100 flex items-center justify-center">
        <span className="text-5xl opacity-30">🎨</span>
      </div>
    );
  }
  return (
    <>
      <img src={urls[idx]} alt="" className="absolute inset-0 w-full h-full object-cover" />
      {urls.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i === 0 ? urls.length - 1 : i - 1));
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/85 flex items-center justify-center shadow-sm"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i === urls.length - 1 ? 0 : i + 1));
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/85 flex items-center justify-center shadow-sm"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4 text-gray-700" />
          </button>
        </>
      ) : null}
    </>
  );
}

export default function ConnectSwipeCard({
  post,
  remaining,
  swiping,
  onSwipe,
  onDetail,
}: {
  post: PostWithCreator;
  remaining: number;
  swiping: boolean;
  onSwipe: (direction: "left" | "right") => void;
  onDetail: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-10, 10]);
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, -20], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) onSwipe("right");
    else if (info.offset.x < -SWIPE_THRESHOLD) onSwipe("left");
    else x.set(0);
  };

  return (
    <div>
      <motion.div
        style={{ x, rotate }}
        drag="x"
        dragElastic={0.15}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg bg-gray-900 touch-pan-y cursor-grab active:cursor-grabbing"
      >
        <CardImage urls={post.media_urls ?? []} />

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-6 left-4 z-10 px-3 py-1 border-2 border-green-500 text-green-500 font-bold text-sm rounded-md rotate-[-12deg] pointer-events-none"
        >
          LIKE
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute top-6 right-4 z-10 px-3 py-1 border-2 border-violet-500 text-violet-500 font-bold text-sm rounded-md rotate-[12deg] pointer-events-none"
        >
          PASS
        </motion.div>

        <button
          type="button"
          onClick={onDetail}
          className="absolute top-3 right-3 z-10 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm hover:bg-white"
          aria-label="Post details"
        >
          <Info className="h-4 w-4 text-blue-800" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm px-4 py-3 border-t border-white/50">
          <p className="text-sm font-bold text-blue-900 truncate">{post.creator.name}</p>
          {post.creator.role ? (
            <p className="text-xs text-blue-600 truncate">{post.creator.role}</p>
          ) : null}
          <h3 className="text-sm font-semibold text-gray-900 mt-1 line-clamp-1">{post.title}</h3>
          {post.description ? (
            <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{post.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-gray-500">
            {post.location ? (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" /> {post.location}
              </span>
            ) : null}
            {post.looking_for && post.looking_for.length > 0 ? (
              <span className="flex items-center gap-0.5">
                <Users className="h-3 w-3" /> {post.looking_for.join(", ")}
              </span>
            ) : null}
            {post.compensation ? (
              <span className="flex items-center gap-0.5">
                <DollarSign className="h-3 w-3" /> {post.compensation}
              </span>
            ) : null}
          </div>
          {remaining > 0 ? (
            <p className="text-[10px] text-gray-400 mt-1">{remaining} more in stack</p>
          ) : null}
        </div>
      </motion.div>

      <div className="flex justify-center gap-5 mt-4 mb-1">
        <button
          type="button"
          onClick={() => onSwipe("left")}
          disabled={swiping}
          className="w-14 h-14 rounded-full border-2 border-violet-400 text-violet-500 flex items-center justify-center hover:bg-violet-50 disabled:opacity-50 transition-colors shadow-sm"
          aria-label="Pass"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => onSwipe("right")}
          disabled={swiping}
          className="w-14 h-14 rounded-full border-2 border-blue-800 text-blue-800 flex items-center justify-center hover:bg-blue-50 disabled:opacity-50 transition-colors shadow-sm"
          aria-label="Like"
        >
          <Heart className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
