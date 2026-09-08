import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users2,
  Shield, GraduationCap,
} from "lucide-react";
import {
  C, isAdminKey, deptName,
} from "../theme";
import {
  } from "../data/seedData";
import { logActivity } from "../utils/activity";
import {
  } from "../utils/files";
import {
  Card, PasswordInput,
} from "../components/UI";
import { uploadAttachment } from "../lib/uploadAttachment";
import { updateProfile } from "../lib/profileAdmin";
import { supabase } from "../lib/supabaseClient";

function SettingsView({ data, setData, goTo, refreshProfiles, refreshProfile }) {
  const isAdmin = isAdminKey(data.session, data.profiles);
  const isSuperAdmin = data.profiles[data.session]?.role === "admin";
  const ownRole = data.session;
  const studentKeys = useMemo(() => Object.keys(data.profiles).filter((k) => !isAdminKey(k, data.profiles)), [data.profiles]);
  const [name, setName] = useState(data.profiles[data.session].name);
  useEffect(() => { setName(data.profiles[data.session].name); }, [data.session]);
  const [nameSaved, setNameSaved] = useState(false);

  const photoRef = useRef(null);
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  const uploadOwnPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Please choose an image file."); return; }
    setPhotoError(""); setPhotoBusy(true);
    try {
      const { url } = await uploadAttachment(file);
      const { error } = await updateProfile(ownRole, { photo: url });
      if (error) setPhotoError(error.message);
      else refreshProfile?.(); // without this, your own new photo won't show anywhere until you log out and back in
    } catch (err) {
      setPhotoError(err.message || "Couldn't upload that image, try another one.");
    } finally {
      setPhotoBusy(false);
    }
  };
  const removeOwnPhoto = () => {
    setPhotoError("");
    updateProfile(ownRole, { photo: null }).then(({ error }) => {
      if (error) setPhotoError(error.message);
      else refreshProfile?.();
    });
  };
  const removeStudentPhoto = (key) => {
    updateProfile(key, { photo: null }).then(({ error }) => {
      if (!error) { setData((d) => logActivity(d, `Admin removed ${data.profiles[key]?.name || "student"}'s profile photo`)); refreshProfiles?.(); }
    });
  };

  const saveName = () => {
    updateProfile(ownRole, { name }).then(({ error }) => {
      if (!error) { setNameSaved(true); refreshProfile?.(); setTimeout(() => setNameSaved(false), 1500); }
    });
  };

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError] = useState("");
  const [passSaved, setPassSaved] = useState(false);

  const changeOwnPassword = async () => {
    setPassError("");
    if (!newPass.trim() || newPass.length < 6) { setPassError("New password must be at least 6 characters."); return; }
    if (newPass !== confirmPass) { setPassError("New passwords don't match."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { setPassError(error.message); return; }
    setNewPass(""); setConfirmPass("");
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 1500);
  };

  return (
    <div className="max-w-md space-y-4">
      <Card>
        <div className="text-xs font-semibold text-[#A79E8C] mb-3">PROFILE</div>

        <div className="text-xs text-[#6E6455] mb-2">Photo</div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 overflow-hidden" style={{ background: C.purple }}>
            {data.profiles[ownRole].photo
              ? <img src={data.profiles[ownRole].photo} alt="" className="w-full h-full object-cover" />
              : (data.profiles[ownRole].name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex gap-2">
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={uploadOwnPhoto} />
            <button onClick={() => photoRef.current && photoRef.current.click()} disabled={photoBusy} className="text-xs px-3 py-1.5 rounded-lg border border-[#E6DFD1] disabled:opacity-50">{photoBusy ? "Uploading…" : "Upload photo"}</button>
            {data.profiles[ownRole].photo && <button onClick={removeOwnPhoto} className="text-xs px-3 py-1.5 rounded-lg border border-[#E6DFD1] text-[#A6423A]">Remove</button>}
          </div>
        </div>
        {photoError && <div className="text-xs mb-3" style={{ color: "#A6423A" }}>{photoError}</div>}

        <div className="text-xs text-[#6E6455] mb-1">Display name ({isAdmin ? (isSuperAdmin ? "Admin" : "Co-admin") : "Student"})</div>
        <div className="flex gap-2 mb-4">
          <input value={name} onChange={(e) => setName(e.target.value)} className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm flex-1" />
          <button onClick={saveName} className="text-sm text-white px-3 py-2 rounded-lg flex-shrink-0" style={{ background: C.purple }}>{nameSaved ? "Saved ✓" : "Save"}</button>
        </div>

        {!isSuperAdmin && data.departments.length > 1 && (
          <>
            <div className="text-xs text-[#6E6455] mb-1">Department</div>
            <div className="border border-[#E6DFD1] rounded-lg px-3 py-2 text-sm w-full mb-1 bg-[#FAF6EF] flex items-center justify-between" style={{ color: "#2B2620" }}>
              <span>{deptName(data, data.profiles[ownRole]?.departmentId || data.departments[0]?.id)}</span>
              <span className="text-[10px]" style={{ color: "#A79E8C" }}>{isAdmin ? "set by the Super Admin" : "set by your admin"}</span>
            </div>
          </>
        )}
      </Card>

      <Card style={{ borderLeft: `3px solid ${isAdmin ? C.purple : "#4F7A5B"}` }}>
        <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#2B2620" }}>
          {isAdmin ? <Shield size={13} /> : <GraduationCap size={13} />} MY ACCOUNT
        </div>
        <p className="text-xs mb-3" style={{ color: "#A79E8C" }}>Signed in as <b>{data.profiles[ownRole]?.email}</b>. Classroom data (courses, tasks, announcements, etc.) is shared with every admin, co-admin, and student in this app.</p>

        <div className="text-xs font-medium mb-2" style={{ color: "#6E6455" }}>Change password</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <PasswordInput autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="New password" className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm w-full" />
          <PasswordInput autoComplete="new-password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Confirm new password" className="border border-[#E6DFD1] rounded-lg px-2 py-1.5 text-sm w-full" />
        </div>
        {passError && <div className="text-xs mb-2" style={{ color: "#A6423A" }}>{passError}</div>}
        <button onClick={changeOwnPassword} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: C.purple }}>{passSaved ? "Saved ✓" : "Change password"}</button>
      </Card>

      {isSuperAdmin && goTo && (
        <Card style={{ borderLeft: "3px solid #7A2E3A" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#2B2620" }}><Shield size={13} /> CO-ADMINS</div>
            <button onClick={() => goTo("coadmins")} className="text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Shield size={12} /> Manage Co-Admins</button>
          </div>
          <p className="text-xs mt-1" style={{ color: "#A79E8C" }}>Promote a signed-up user to department HOD, and see what each co-admin has done. Manage this from <b>Co-Admins</b> in the sidebar.</p>
        </Card>
      )}

      {isAdmin && (
        <Card style={{ borderLeft: "3px solid #4F7A5B" }}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#2B2620" }}><GraduationCap size={13} /> STUDENT ACCOUNTS ({studentKeys.length})</div>
            {goTo && <button onClick={() => goTo("students")} className="text-xs font-medium flex items-center gap-1" style={{ color: C.purple }}><Users2 size={12} /> Manage Students</button>}
          </div>
          <p className="text-xs mb-4" style={{ color: "#A79E8C" }}>Students manage their own login now (they signed up themselves). You can remove a profile photo here, or assign departments and deactivate accounts from <b>Manage Students</b> in the sidebar.</p>

          <div className="space-y-2">
            {studentKeys.map((key) => {
              const profile = data.profiles[key] || { name: "Student", photo: null };
              return (
                <div key={key} className="flex items-center gap-3 border border-[#E6DFD1] rounded-lg p-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden" style={{ background: "#4F7A5B" }}>
                    {profile.photo
                      ? <img src={profile.photo} alt="" className="w-full h-full object-cover" />
                      : (profile.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "#2B2620" }}>{profile.name || "Student"}</div>
                    <div className="text-xs truncate" style={{ color: "#A79E8C" }}>{profile.email}</div>
                  </div>
                  {profile.photo && <button onClick={() => removeStudentPhoto(key)} className="text-xs flex-shrink-0" style={{ color: "#A6423A" }}>Remove photo</button>}
                </div>
              );
            })}
            {studentKeys.length === 0 && <div className="text-sm text-[#A79E8C]">No student accounts yet — share the app link so students can sign up.</div>}
          </div>
        </Card>
      )}
    </div>
  );
}

export default SettingsView;
export { SettingsView };
