import { supabase } from "./supabaseClient";

// Old app stored files as base64 text inside the JSON blob — fine for a handful
// of small files under Claude's ~5MB storage cap, but it doesn't scale and it's
// slow to sync over Realtime. This uploads to Supabase Storage instead and
// returns a small record { url, fileName, fileType } to store in the JSON blob,
// which is what every existing View component already expects to render.
export async function uploadAttachment(file) {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return { url: data.publicUrl, fileName: file.name, fileType: file.type, storagePath: path };
}

export async function deleteAttachment(storagePath) {
  if (!storagePath) return;
  await supabase.storage.from("attachments").remove([storagePath]);
}
