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

    // The write to the shared classroom row is debounced (~400ms) to avoid spamming the DB
    // on rapid edits — wait for it before checking the mock store landed the change.
    await waitFor(() => {
      expect(mock.state.classroom.data.announcements?.some((a) => a.title === "Migration Test Announcement")).toBe(true);
    }, { timeout: 2000 });
    expect(realErrors()).toEqual([]);
  });
});
