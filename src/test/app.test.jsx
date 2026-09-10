import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { createMockSupabase } from "./mockSupabase";

afterEach(() => cleanup());

let mock;

vi.mock("../lib/supabaseClient", () => ({
  get supabase() { return mock.supabase; },
}));

// App.jsx and other lib files import "./lib/supabaseClient" / "./supabaseClient" — Vitest
// resolves all of these to the same module graph node, so one mock covers every import site.

let App;
beforeEach(async () => {
  vi.resetModules();
  mock = createMockSupabase();
  ({ default: App } = await import("../App.jsx"));
});

const errors = [];
beforeEach(() => {
  errors.length = 0;
  vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.map(String).join(" ")));
});
function realErrors() {
  return errors.filter((e) => !/Warning: /.test(e) && !/not wrapped in act/.test(e));
}

describe("Migrated Supabase app — smoke test", () => {
  it("shows the auth screen when logged out", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^log in$/i })).toBeInTheDocument());
    expect(realErrors()).toEqual([]);
  });

  it("sign up creates a real account and lands on the dashboard as a student", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/need an account\? sign up/i));
    await user.click(screen.getByText(/need an account\? sign up/i));
    await waitFor(() => screen.getByText(/your name/i));

    const nameInput = document.querySelector('input:not([type="email"]):not([type="password"])');
    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    await user.type(nameInput, "Test Student");
    await user.type(emailInput, "student1@example.com");
    await user.type(passInput, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument(), { timeout: 5000 });
    expect(realErrors()).toEqual([]);
  });

  it("first-run seeding populates the shared classroom row, visible after reload", async () => {
    const user = userEvent.setup();
    const r1 = render(<App />);
    await waitFor(() => screen.getByText(/need an account\? sign up/i));
    await user.click(screen.getByText(/need an account\? sign up/i));
    const nameInput = document.querySelector('input:not([type="email"]):not([type="password"])');
    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    await user.type(nameInput, "Admin Person");
    await user.type(emailInput, "admin1@example.com");
    await user.type(passInput, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument());
    r1.unmount();

    // Promote to admin directly in the mock's data store (simulating the one-time SQL step).
    for (const p of mock.state.profiles.values()) {
      if (p.email === "admin1@example.com") p.role = "admin";
    }

    render(<App />);
    await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument());
    // Admin nav should now be visible (proves role + seeded classroom data both loaded).
    await waitFor(() => screen.getByText(/manage students/i));
    expect(realErrors()).toEqual([]);
  });

  it("admin can publish an announcement and it is visible after re-render (shared classroom sync)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/need an account\? sign up/i));
    await user.click(screen.getByText(/need an account\? sign up/i));
    const nameInput = document.querySelector('input:not([type="email"]):not([type="password"])');
    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    await user.type(nameInput, "Admin Two");
    await user.type(emailInput, "admin2@example.com");
    await user.type(passInput, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument());
    for (const p of mock.state.profiles.values()) if (p.email === "admin2@example.com") p.role = "admin";

    const bellBtn = document.querySelector('button[title="Announcements"]');
    await user.click(bellBtn);
    await waitFor(() => screen.getByText(/view all announcements/i));
    await user.click(screen.getByText(/view all announcements/i));
    await waitFor(() => screen.getByPlaceholderText("Title"));
    await user.type(screen.getByPlaceholderText("Title"), "Migration Test Announcement");
    await user.click(screen.getByRole("button", { name: /^publish$/i }));
    await waitFor(() => screen.getByText("Migration Test Announcement"));

    // The write to the announcements table is debounced (~400ms) to avoid spamming the DB
    // on rapid edits — wait for it before checking the mock store landed the change.
    await waitFor(() => {
      expect(mock.state.rows("announcements").some((r) => r.item.title === "Migration Test Announcement")).toBe(true);
    }, { timeout: 2000 });
    expect(realErrors()).toEqual([]);
  });

  it("real database-level isolation: a co-admin cannot read another department's courses, even via a direct table query", async () => {
    render(<App />);
    // Two departments, two co-admins, one course each — set up directly against the mock's
    // tables the same way the real Supabase tables would end up populated.
    mock.state.tables.departments.set("cs", { id: "cs", name: "Computer Science", active: true });
    mock.state.tables.departments.set("it", { id: "it", name: "Information Technology", active: true });
    mock.state.profiles.set("coadmin_cs", { id: "coadmin_cs", email: "cs@x.com", role: "coadmin", department_id: "cs", name: "CS HOD", active: true });
    mock.state.profiles.set("coadmin_it", { id: "coadmin_it", email: "it@x.com", role: "coadmin", department_id: "it", name: "IT HOD", active: true });
    mock.state.tables.courses.set("course_cs", { id: "course_cs", department_id: "cs", item: { id: "course_cs", code: "CS101", departmentId: "cs" } });
    mock.state.tables.courses.set("course_it", { id: "course_it", department_id: "it", item: { id: "course_it", code: "IT101", departmentId: "it" } });

    // Simulate the CS co-admin's own database session and query the courses table directly —
    // exactly what the app does, and exactly what someone bypassing the UI would also do.
    mock.state.currentUserId = "coadmin_cs";
    const { data: csView } = await mock.supabase.from("courses").select("*");
    expect(csView.map((r) => r.id).sort()).toEqual(["course_cs"]);
    expect(csView.some((r) => r.id === "course_it")).toBe(false);

    // And the reverse, for the IT co-admin.
    mock.state.currentUserId = "coadmin_it";
    const { data: itView } = await mock.supabase.from("courses").select("*");
    expect(itView.map((r) => r.id).sort()).toEqual(["course_it"]);
    expect(itView.some((r) => r.id === "course_cs")).toBe(false);
  });

  it("student checking off a unit saves to course_progress, not the shared courses table", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/need an account\? sign up/i));
    await user.click(screen.getByText(/need an account\? sign up/i));
    const nameInput = document.querySelector('input:not([type="email"]):not([type="password"])');
    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    await user.type(nameInput, "Unit Student");
    await user.type(emailInput, "unitstudent@example.com");
    await user.type(passInput, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument());

    const studentId = mock.state.currentUserId;
    mock.state.profiles.get(studentId).department_id = "cse";
    mock.state.tables.departments.set("cse", { id: "cse", name: "CSE", active: true });
    mock.state.tables.courses.set("bcs501", {
      id: "bcs501",
      department_id: "cse",
      item: { id: "bcs501", code: "BCS501", name: "DBMS", departmentId: "cse", units: [{ id: "u1", name: "Intro", done: false }], hidden: false, category: "Core", color: "#7A2E3A" },
    });
    cleanup();
    render(<App />);
    await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument());
    await user.click(screen.getByText(/subjects · unit wise/i));
    await waitFor(() => screen.getByText("Intro"));
    await user.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(mock.state.rows("course_progress").some((r) => (r.item.doneUnitIds || []).includes("u1"))).toBe(true);
    }, { timeout: 2000 });
    expect(mock.state.tables.courses.get("bcs501").item.units[0].done).toBe(false);
    expect(screen.queryByText(/hasn't saved yet/i)).not.toBeInTheDocument();
    expect(realErrors()).toEqual([]);
  });
});
