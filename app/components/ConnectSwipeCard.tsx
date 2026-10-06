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
import ReputationBadge from "./ReputationBadge";
import VerifiedBadge from "./VerifiedBadge";

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
            className="melange-action absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center"
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
            className="melange-action absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center"
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
  nextPost,
  remaining,
  swiping,
  onSwipe,
  onDetail,
}: {
  post: PostWithCreator;
  nextPost?: PostWithCreator | null;
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
      <div className="relative">
        {nextPost ? (
          <motion.div
            key={`behind-${nextPost.id}`}
            initial={{ scale: 0.94, y: 10, opacity: 0.6 }}
            animate={{ scale: 0.96, y: 6, opacity: 1 }}
            transition={{ type: "spring", damping: 18, stiffness: 220 }}
            className="absolute inset-0 aspect-[3/4] rounded-3xl overflow-hidden bg-gray-900 ring-1 ring-white/30 shadow-[0_24px_50px_-24px_rgba(5,8,24,0.8)] pointer-events-none"
          >
            <CardImage urls={nextPost.media_urls ?? []} />
          </motion.div>
        ) : null}
        <motion.div
          key={post.id}
          style={{ x, rotate }}
          initial={{ scale: 0.96, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20, stiffness: 260 }}
          drag="x"
          dragElastic={0.15}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-gray-900 ring-1 ring-white/40 shadow-[0_30px_60px_-24px_rgba(5,8,24,0.85)] touch-pan-y cursor-grab active:cursor-grabbing"
        >
        <CardImage urls={post.media_urls ?? []} />

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-6 left-4 z-10 px-3 py-1 border-2 border-violet-300 text-violet-100 bg-violet-600/40 backdrop-blur-sm font-bold text-sm rounded-lg rotate-[-12deg] pointer-events-none"
        >
          LIKE
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute top-6 right-4 z-10 px-3 py-1 border-2 border-rose-300 text-rose-100 bg-rose-600/40 backdrop-blur-sm font-bold text-sm rounded-lg rotate-[12deg] pointer-events-none"
        >
          PASS
        </motion.div>

        <button
          type="button"
          onClick={onDetail}
          className="melange-action absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center"
          aria-label="Post details"
        >
          <Info className="h-4 w-4 text-indigo-700" />
        </button>

        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        <div className="glass-dark absolute bottom-0 left-0 right-0 rounded-none border-x-0 border-b-0 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white truncate">{post.creator.name}</p>
            {post.creator.verification_status === "verified" ? <VerifiedBadge compact /> : null}
            <ReputationBadge
              avgRating={post.creator.avg_rating ?? 0}
              reviewCount={post.creator.review_count ?? 0}
              compact
            />
          </div>
          {post.creator.role ? (
            <p className="text-xs text-indigo-200 truncate">{post.creator.role}</p>
          ) : null}
          <h3 className="text-sm font-semibold text-white mt-1 line-clamp-1">{post.title}</h3>
          {post.description ? (
            <p className="text-xs text-white/75 line-clamp-2 mt-0.5">{post.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-white/60">
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
            <p className="text-[10px] text-white/45 mt-1">{remaining} more in stack</p>
          ) : null}
        </div>
        </motion.div>
      </div>

      <div className="flex justify-center gap-5 mt-4 mb-1">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onSwipe("left")}
          disabled={swiping}
          className="melange-action is-pass w-14 h-14 rounded-full text-rose-500 flex items-center justify-center disabled:opacity-50"
          aria-label="Pass"
        >
          <X className="h-6 w-6" />
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onSwipe("right")}
          disabled={swiping}
          className="melange-action is-like w-14 h-14 rounded-full text-violet-600 flex items-center justify-center disabled:opacity-50"
          aria-label="Like"
        >
          <Heart className="h-6 w-6" />
        </motion.button>
      </div>
    </div>
  );
}
