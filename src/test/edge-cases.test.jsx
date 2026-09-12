// Edge-case tests per the QA brief: duplicate accounts, wrong credentials, and a
// deactivated account being blocked from logging back in — even with the correct password.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { createMockSupabase } from "./mockSupabase";

let mock;
vi.mock("../lib/supabaseClient", () => ({
  get supabase() { return mock.supabase; },
}));

let App;
beforeEach(async () => {
  vi.resetModules();
  mock = createMockSupabase();
  ({ default: App } = await import("../App.jsx"));
});

describe("Auth edge cases", () => {
  it("signing up twice with the same email is rejected, not silently duplicated", async () => {
    const first = await mock.supabase.auth.signUp({ email: "dupe@example.com", password: "password123", options: { data: { name: "First" } } });
    expect(first.error).toBeNull();
    const usersAfterFirst = mock.state.users.size;

    const second = await mock.supabase.auth.signUp({ email: "dupe@example.com", password: "different456", options: { data: { name: "Second" } } });
    expect(second.error).toBeTruthy();
    expect(mock.state.users.size).toBe(usersAfterFirst); // no duplicate account created
  });

  it("logging in with a wrong password is rejected with a clear error, not a silent failure", async () => {
    await mock.supabase.auth.signUp({ email: "realuser@example.com", password: "correctpw123", options: { data: { name: "Real User" } } });
    await mock.supabase.auth.signOut();
    const { error, data } = await mock.supabase.auth.signInWithPassword({ email: "realuser@example.com", password: "wrongpw999" });
    expect(error).toBeTruthy();
    expect(data.session).toBeNull();
  });

  it("a deactivated account cannot log back in, even with the correct password", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => screen.getByText(/need an account\? sign up/i));
    await user.click(screen.getByText(/need an account\? sign up/i));
    await waitFor(() => screen.getByText(/your name/i));
    const nameInput = document.querySelector('input:not([type="email"]):not([type="password"])');
    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    await user.type(nameInput, "Soon Deactivated");
    await user.type(emailInput, "deactivated@example.com");
    await user.type(passInput, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText(/almost there/i)).toBeInTheDocument());

    // Admin deactivates this account directly (simulating the real "Deactivate" button flow).
    for (const p of mock.state.profiles.values()) if (p.email === "deactivated@example.com") p.active = false;

    cleanup();
    render(<App />);
    // useAuth's profile-load effect should detect active === false and sign them straight back
    // out — they must land on the auth screen, never inside the app.
    await waitFor(() => expect(screen.getByRole("button", { name: /^log in$/i })).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByText(/almost there/i)).not.toBeInTheDocument();
    // Note: "Welcome back" is also the AuthScreen's own sign-in heading, so it legitimately
    // appears here too — the real proof of being logged out is the "Log in" button assertion
    // above, plus the absence of the sidebar/dashboard chrome checked below.
    expect(screen.queryByText(/manage students/i)).not.toBeInTheDocument();
    expect(document.querySelector("aside")).not.toBeInTheDocument();
  });
});
