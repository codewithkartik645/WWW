// Backend/API authorization tests. These bypass the React UI entirely and call the mock's
// Supabase layer directly — exactly the way a technically-savvy student or co-admin could from
// their browser's devtools console, ignoring every button/tab the frontend hides from them.
// The mock's authorization logic (mockSupabase.js) is written to mirror supabase/schema.sql's
// RLS policies line-for-line, so a pass here is strong evidence the real database would also
// reject these calls — but it is NOT a substitute for running the actual policies against a
// real Postgres instance, which requires a live Supabase project this environment doesn't have.
import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabase } from "./mockSupabase";

describe("Role-based backend authorization (bypassing the UI)", () => {
  let mock;
  let directorId, coAdminAId, studentA1Id, studentB1Id, unassignedId;
  const DEPT_X = "dept_x";
  const DEPT_Y = "dept_y";

  beforeEach(async () => {
    mock = createMockSupabase();
    mock.state.tables.departments.set(DEPT_X, { id: DEPT_X, name: "Computer Science", active: true });
    mock.state.tables.departments.set(DEPT_Y, { id: DEPT_Y, name: "Mechanical", active: true });

    // Sign up 5 accounts, then hand-assign roles/departments directly in the store (mirrors how
    // the app.test.jsx suite bootstraps its first admin — the one manual SQL step real deploys
    // also require).
    await mock.supabase.auth.signUp({ email: "director@example.com", password: "pw123456", options: { data: { name: "Director" } } });
    directorId = mock.state.currentUserId;
    await mock.supabase.auth.signUp({ email: "hod.cs@example.com", password: "pw123456", options: { data: { name: "HOD CS" } } });
    coAdminAId = mock.state.currentUserId;
    await mock.supabase.auth.signUp({ email: "student.cs@example.com", password: "pw123456", options: { data: { name: "Student CS" } } });
    studentA1Id = mock.state.currentUserId;
    await mock.supabase.auth.signUp({ email: "student.me@example.com", password: "pw123456", options: { data: { name: "Student Mech" } } });
    studentB1Id = mock.state.currentUserId;
    await mock.supabase.auth.signUp({ email: "student.new@example.com", password: "pw123456", options: { data: { name: "Student New" } } });
    unassignedId = mock.state.currentUserId;

    mock.state.profiles.get(directorId).role = "admin";
    mock.state.profiles.get(coAdminAId).role = "coadmin";
    mock.state.profiles.get(coAdminAId).department_id = DEPT_X;
    mock.state.profiles.get(studentA1Id).department_id = DEPT_X;
    mock.state.profiles.get(studentB1Id).department_id = DEPT_Y;
    // studentNew/unassignedId is left with department_id: null, matching a real brand-new signup.

    mock.state.tables.courses.set("course_x", { id: "course_x", department_id: DEPT_X, item: { id: "course_x", name: "CS 101" } });
    mock.state.tables.courses.set("course_y", { id: "course_y", department_id: DEPT_Y, item: { id: "course_y", name: "Thermo 101" } });
    mock.state.tables.attendance.set("att_a1", { id: "att_a1", department_id: DEPT_X, student_id: studentA1Id, item: { id: "att_a1", status: "present" } });
    mock.state.tables.attendance.set("att_b1", { id: "att_b1", department_id: DEPT_Y, student_id: studentB1Id, item: { id: "att_b1", status: "present" } });
  });

  it("PRIVILEGE ESCALATION: a student cannot promote themselves to admin via a direct API call", async () => {
    mock.state.currentUserId = studentA1Id;
    const { error } = await mock.supabase.from("profiles").update({ role: "admin" }).eq("id", studentA1Id);
    expect(error).toBeTruthy();
    expect(mock.state.profiles.get(studentA1Id).role).toBe("student");
  });

  it("PRIVILEGE ESCALATION: a student cannot deactivate their own or another account", async () => {
    mock.state.currentUserId = studentA1Id;
    const selfAttempt = await mock.supabase.from("profiles").update({ active: false }).eq("id", studentA1Id);
    expect(selfAttempt.error).toBeTruthy();
    const otherAttempt = await mock.supabase.from("profiles").update({ active: false }).eq("id", studentB1Id);
    expect(otherAttempt.error).toBeTruthy();
    expect(mock.state.profiles.get(studentA1Id).active).toBe(true);
    expect(mock.state.profiles.get(studentB1Id).active).toBe(true);
  });

  it("PRIVILEGE ESCALATION: a co-admin cannot promote themselves or anyone else to admin/coadmin", async () => {
    mock.state.currentUserId = coAdminAId;
    const promoteSelf = await mock.supabase.from("profiles").update({ role: "admin" }).eq("id", coAdminAId);
    expect(promoteSelf.error).toBeTruthy();
    const promoteStudent = await mock.supabase.from("profiles").update({ role: "coadmin", department_id: DEPT_X }).eq("id", studentA1Id);
    expect(promoteStudent.error).toBeTruthy();
    expect(mock.state.profiles.get(studentA1Id).role).toBe("student");
  });

  it("CROSS-DEPARTMENT: a co-admin cannot deactivate or otherwise edit a student outside their department", async () => {
    mock.state.currentUserId = coAdminAId; // HOD of DEPT_X
    const { error } = await mock.supabase.from("profiles").update({ active: false }).eq("id", studentB1Id); // DEPT_Y student
    expect(error).toBeTruthy();
    expect(mock.state.profiles.get(studentB1Id).active).toBe(true);
  });

  it("CROSS-DEPARTMENT: a co-admin cannot move a student to a different department (that's a Director-only action)", async () => {
    mock.state.currentUserId = coAdminAId;
    const { error } = await mock.supabase.from("profiles").update({ department_id: DEPT_Y }).eq("id", studentA1Id);
    expect(error).toBeTruthy();
    expect(mock.state.profiles.get(studentA1Id).department_id).toBe(DEPT_X);
  });

  it("LEGITIMATE ACTION: a co-admin CAN deactivate/reactivate their own department's students", async () => {
    mock.state.currentUserId = coAdminAId;
    const deactivate = await mock.supabase.from("profiles").update({ active: false }).eq("id", studentA1Id);
    expect(deactivate.error).toBeNull();
    expect(mock.state.profiles.get(studentA1Id).active).toBe(false);
    const reactivate = await mock.supabase.from("profiles").update({ active: true }).eq("id", studentA1Id);
    expect(reactivate.error).toBeNull();
    expect(mock.state.profiles.get(studentA1Id).active).toBe(true);
  });

  it("LEGITIMATE ACTION: the Director can promote a student to co-admin and reassign departments freely", async () => {
    mock.state.currentUserId = directorId;
    const promote = await mock.supabase.from("profiles").update({ role: "coadmin", department_id: DEPT_Y }).eq("id", studentB1Id);
    expect(promote.error).toBeNull();
    expect(mock.state.profiles.get(studentB1Id).role).toBe("coadmin");
    const reassign = await mock.supabase.from("profiles").update({ department_id: DEPT_X }).eq("id", studentA1Id);
    expect(reassign.error).toBeNull();
  });

  it("SELF-SERVICE: any user can update their own name without touching privileged fields", async () => {
    mock.state.currentUserId = studentA1Id;
    const { error } = await mock.supabase.from("profiles").update({ name: "New Name" }).eq("id", studentA1Id);
    expect(error).toBeNull();
    expect(mock.state.profiles.get(studentA1Id).name).toBe("New Name");
  });

  it("DATA ISOLATION: a co-admin's SELECT on a department-scoped table never returns another department's rows, even though both exist in the same table", async () => {
    mock.state.currentUserId = coAdminAId; // HOD of DEPT_X
    const { data } = await mock.supabase.from("courses").select("*");
    expect(data.map((r) => r.id)).toEqual(["course_x"]);
    expect(data.map((r) => r.id)).not.toContain("course_y");
  });

  it("DATA ISOLATION: attendance — a co-admin only ever sees their own department's records", async () => {
    mock.state.currentUserId = coAdminAId;
    const { data } = await mock.supabase.from("attendance").select("*");
    expect(data.map((r) => r.id)).toEqual(["att_a1"]);
  });

  it("DATA ISOLATION: attendance — a student only ever sees their own record, never a classmate's", async () => {
    mock.state.currentUserId = studentA1Id;
    const { data } = await mock.supabase.from("attendance").select("*");
    expect(data.map((r) => r.id)).toEqual(["att_a1"]);
    mock.state.currentUserId = studentB1Id;
    const { data: dataB } = await mock.supabase.from("attendance").select("*");
    expect(dataB.map((r) => r.id)).toEqual(["att_b1"]);
  });

  it("DATA ISOLATION: the Director's SELECT sees every department's rows", async () => {
    mock.state.currentUserId = directorId;
    const { data } = await mock.supabase.from("courses").select("*");
    expect(data.map((r) => r.id).sort()).toEqual(["course_x", "course_y"]);
  });

  it("UNASSIGNED STUDENT: has no department, so department-scoped reads return nothing for them", async () => {
    mock.state.currentUserId = unassignedId;
    const { data } = await mock.supabase.from("courses").select("*");
    // Neither course has a null department_id, and this student has no department_id of their
    // own to match against — they should see nothing until an admin assigns them one.
    expect(data.length).toBe(0);
  });
});
