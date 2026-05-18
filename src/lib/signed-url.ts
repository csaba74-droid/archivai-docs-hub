import { supabase } from "./supabase";

const cache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(path: string, expiresIn = 600): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expires > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.warn("signed url failed", error);
    return null;
  }
  cache.set(path, { url: data.signedUrl, expires: now + expiresIn * 1000 });
  return data.signedUrl;
}
