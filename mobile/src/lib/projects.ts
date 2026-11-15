import { supabase } from "./supabase";

/**
 * Who worked on a project, and the reviews that follow
 * (29_projects_and_regions.sql). The owner adds people from a chat; nobody
 * is asked to accept and nobody is notified. Once the owner marks it
 * finished, each side is asked to review the other.
 */
export type ProjectMember = {
  user_id: string;
  match_id: string | null;
  name: string;
  role: string | null;
  avatar_url: string | null;
};

export type PendingReview = {
  match_id: string;
  post_id: string;
  title: string;
  other_user_id: string;
  other_name: string;
};

export type WorkedOn = { post_id: string; title: string; finished_at: string | null; owner_id: string };

export const PROJECTS_NEED_UPDATE =
  "This needs the latest database update (29_projects_and_regions.sql).";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

function isMissing(message: string): boolean {
  return /(project_members|add_project_member|remove_project_member|set_project_finished|my_pending_reviews|finished_at)/i.test(message) &&
    /(does not exist|schema cache|could not find)/i.test(message);
}

function clean(message: string): string {
  return isMissing(message) ? PROJECTS_NEED_UPDATE : message;
}

export async function addProjectMember(postId: string, matchId: string): Promise<string | null> {
  try {
    const { error } = await supabase.rpc("add_project_member", { p_post: postId, p_match: matchId });
    return error ? clean(error.message) : null;
  } catch (err) {
    return errMsg(err);
  }
}

export async function removeProjectMember(postId: string, userId: string): Promise<string | null> {
  try {
    const { error } = await supabase.rpc("remove_project_member", { p_post: postId, p_user: userId });
    return error ? clean(error.message) : null;
  } catch (err) {
    return errMsg(err);
  }
}

/** Finished takes it off Discover too. Undo leaves it hidden until reopened. */
export async function setProjectFinished(postId: string, done: boolean): Promise<string | null> {
  try {
    const { error } = await supabase.rpc("set_project_finished", { p_post: postId, p_done: done });
    return error ? clean(error.message) : null;
  } catch (err) {
    return errMsg(err);
  }
}

/** Everyone the owner put on this project, with their name and photo. */
export async function getProjectMembers(postId: string): Promise<ProjectMember[]> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select("user_id, match_id, added_at")
      .eq("post_id", postId)
      .order("added_at", { ascending: true });
    if (error || !data?.length) return [];
    const ids = data.map((m) => m.user_id as string);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, role, avatar_url")
      .in("user_id", ids);
    const byId = new Map((profiles || []).map((p) => [p.user_id as string, p]));
    return data.map((m) => {
      const p = byId.get(m.user_id as string);
      return {
        user_id: m.user_id as string,
        match_id: (m.match_id as string | null) ?? null,
        name: (p?.name as string | undefined) ?? "Someone",
        role: (p?.role as string | null | undefined) ?? null,
        avatar_url: (p?.avatar_url as string | null | undefined) ?? null,
      };
    });
  } catch {
    return [];
  }
}

/** Projects someone was put on by the owner, newest first. */
export async function getProjectsWorkedOn(userId: string): Promise<WorkedOn[]> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select("post_id, added_at")
      .eq("user_id", userId)
      .order("added_at", { ascending: false });
    if (error || !data?.length) return [];
    const { data: posts } = await supabase
      .from("collab_posts")
      .select("id, title, finished_at, owner_id")
      .in("id", data.map((m) => m.post_id as string));
    const byId = new Map((posts || []).map((p) => [p.id as string, p]));
    return data
      .map((m) => byId.get(m.post_id as string))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        post_id: p.id as string,
        title: p.title as string,
        finished_at: (p.finished_at as string | null) ?? null,
        owner_id: p.owner_id as string,
      }));
  } catch {
    return [];
  }
}

/** Reviews I still owe for finished projects. Empty before the update. */
export async function getMyPendingReviews(): Promise<PendingReview[]> {
  try {
    const { data, error } = await supabase.rpc("my_pending_reviews");
    if (error) return [];
    return (data || []) as PendingReview[];
  } catch {
    return [];
  }
}
