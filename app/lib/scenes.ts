/**
 * Scenes, as the database spells them (profiles.scene / waitlist.scene in
 * 23_scenes_invites_nights.sql). Keep ids in sync with those CHECKs.
 */
export const SCENES = [
  { id: "usc", label: "USC", place: "Los Angeles", live: true },
  { id: "ucsd", label: "UCSD", place: "San Diego", live: true },
  { id: "la", label: "LA", place: "Silver Lake / Echo Park", live: true },
  { id: "nyc", label: "NYC", place: "New York", live: false },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

/** waitlist.scene also accepts "other" for people outside the four scenes. */
export type WaitlistScene = SceneId | "other";

export function sceneLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return SCENES.find((s) => s.id === id)?.label ?? null;
}
