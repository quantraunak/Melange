/**
 * Regions, as the database spells them (profiles.scene / waitlist.scene,
 * 29_projects_and_regions.sql). Keep ids in sync with those CHECKs.
 * California and remote for now.
 */
export const SCENES = [
  { id: "sd", label: "San Diego", place: "San Diego", live: true },
  { id: "la", label: "LA", place: "Los Angeles", live: true },
  { id: "sf", label: "SF", place: "San Francisco", live: true },
  { id: "other_ca", label: "Other California", place: "California", live: true },
  { id: "remote", label: "Remote", place: "Remote", live: true },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

export type WaitlistScene = SceneId;

export function sceneLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return SCENES.find((s) => s.id === id)?.label ?? null;
}
