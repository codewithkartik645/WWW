import { supabase } from "./supabaseClient";

// Profile fields (name, photo, department, role) live in Supabase's `profiles` table now,
// not in the shared classroom JSONB blob — so they're updated directly here instead of
// going through setData(). Realtime picks up the change and every connected client's
// `data.profiles` dict updates automatically (see useClassroomData.js).
export async function updateProfile(userId, patch) {
  const row = {};
  if ("name" in patch) row.name = patch.name;
  if ("photo" in patch) row.photo_url = patch.photo;
  if ("departmentId" in patch) row.department_id = patch.departmentId;
  if ("role" in patch) row.role = patch.role;
  if ("active" in patch) row.active = patch.active;
  const { error } = await supabase.from("profiles").update(row).eq("id", userId);
  return { error };
}
