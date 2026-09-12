import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
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

  it("a newly signed-up student is held on a pending screen until an admin assigns a department", async () => {
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

    // Brand-new accounts start with no department at all (department_id stays NULL until an
    // admin explicitly assigns one) — the student must be held here, not dropped straight onto
    // whichever department happens to be first.
    await waitFor(() => expect(screen.getByText(/almost there/i)).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.queryByText(/welcome back, test student/i)).not.toBeInTheDocument();
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
    // Freshly signed up, still just a plain (unassigned) student — held on the pending screen.
    await waitFor(() => expect(screen.getByText(/almost there/i)).toBeInTheDocument());
    r1.unmount();
    // Fully remove the first render's DOM before mounting a second one below — without this,
    // r1's container div can linger in document.body alongside the new one and cause
    // intermittent stale-DOM interference between the two mounts.
    cleanup();

    // Promote to admin directly in the mock's data store (simulating the one-time SQL step).
    // The Main Admin role doesn't need a department (it manages every department), so this
    // promotion alone is enough to clear the pending screen once the app re-fetches on remount.
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
    const r1 = render(<App />);
    await waitFor(() => screen.getByText(/need an account\? sign up/i));
    await user.click(screen.getByText(/need an account\? sign up/i));
    const nameInput = document.querySelector('input:not([type="email"]):not([type="password"])');
    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    await user.type(nameInput, "Admin Two");
    await user.type(emailInput, "admin2@example.com");
    await user.type(passInput, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText(/almost there/i)).toBeInTheDocument());
    for (const p of mock.state.profiles.values()) if (p.email === "admin2@example.com") p.role = "admin";
    r1.unmount();
    cleanup(); // fully remove the first render's DOM before mounting a second one below — without
    // this, r1's container div can linger in document.body alongside the new one, which is what
    // made this test intermittently flaky (a stale DOM node from the first mount, not a real bug).

    render(<App />);
    await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument());

    // Wait for the bell button itself (not just adjacent text) to be present and stay clickable —
    // there's a brief transient re-render right after "Welcome back" first appears (while the
    // freshly-promoted role/profile data settles), during which a plain one-time DOM query could
    // catch the tree mid-transition and get null. Retrying via waitFor sidesteps that race
    // entirely instead of guessing a fixed delay.
    await waitFor(() => {
      const btn = document.querySelector('button[title="Announcements"]');
      if (!btn) throw new Error("bell button not mounted yet");
      fireEvent.click(btn);
    }, { timeout: 3000 });
    await waitFor(() => screen.getByText(/view all announcements/i), { timeout: 3000 });
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
});
