import { getCurrentUserId } from "@/lib/auth-session";
import { getUserProfile, profileToInterviewFields } from "@/lib/users/firestore";
import type { CollectedFields } from "@/lib/interview/aiInterview";
import { mergeCollectedFields } from "@/lib/interview/aiInterview";

export async function loadInterviewPrefill(): Promise<CollectedFields> {
  const userId = getCurrentUserId();
  if (!userId) return {};

  let profile = null;
  try {
    profile = await getUserProfile(userId);
  } catch {
    return {};
  }
  if (!profile) return {};

  return profileToInterviewFields(profile) as CollectedFields;
}

export async function mergeWithInterviewPrefill(fields: CollectedFields): Promise<CollectedFields> {
  const prefill = await loadInterviewPrefill();
  return mergeCollectedFields(prefill, fields);
}
