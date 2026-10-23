"use client";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./language";
import { cloudClient } from "../lib/cloud";
export default function AuthForm({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const { tr } = useLanguage();
  const client = useMemo(() => cloudClient(), []),
    [mode, setMode] = useState("Sign in"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!client) return;
    const recovery =
      location.hash.includes("type=recovery") ||
      new URLSearchParams(location.search).get("auth") === "recovery";
    client.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (recovery && data.session) setMode("Update password");
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      setSignedIn(!!session);
      if (event === "PASSWORD_RECOVERY") setMode("Update password");
    });
    return () => subscription.unsubscribe();
  }, [client]);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!client) return;
        setBusy(true);
        setMessage("");
        try {
          const result =
            mode === "Register"
              ? await client.auth.signUp({
                  email,
                  password,
                  options: {
                    emailRedirectTo: location.origin + "/?auth=confirmation",
                  },
                })
              : mode === "Reset password"
                ? await client.auth.resetPasswordForEmail(email, {
                    redirectTo: location.origin + "/?auth=recovery",
                  })
                : mode === "Update password"
                  ? await client.auth.updateUser({ password })
                  : await client.auth.signInWithPassword({ email, password });
          if (result.error) throw result.error;
          const message =
            mode === "Sign in"
              ? "Signed in. Open Storage & backup to synchronize."
              : mode === "Update password"
                ? "Password updated."
                : mode === "Register"
                  ? "Account created. Check your email if confirmation is required."
                  : "If an account exists, you will receive a recovery email.";
          setMessage(message);
          onMessage(message);
          setPassword("");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Authentication failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {!client && (
        <div className="notice">
          {tr(
            "Cloud sign-in is not configured. Add your Supabase URL and public anonymous key to .env.local, apply the migration, and restart. Local finance features remain available.",
          )}
        </div>
      )}
      <label>
        {tr("Action")}
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setMessage("");
          }}
        >
          {[
            "Sign in",
            "Register",
            "Reset password",
            ...(signedIn ? ["Update password"] : []),
          ].map((m) => (
            <option key={m} value={m}>
              {tr(String(m))}
            </option>
          ))}
        </select>
      </label>
      {mode !== "Update password" && (
        <label>
          {tr("Email")}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      )}
      {mode !== "Reset password" && (
        <label>
          {tr(mode === "Update password" ? "New password" : "Password")}
          <input
            type="password"
            minLength={8}
            required
            value={password}
            autoComplete={
              mode === "Sign in" ? "current-password" : "new-password"
            }
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}
      {message && (
        <div className="notice" role="status">
          {tr(String(message))}
        </div>
      )}
      <div className="card-actions">
        <button className="primary" disabled={!client || busy}>
          {tr(busy ? "Please wait…" : mode)}
        </button>
        {signedIn && (
          <button
            className="secondary"
            type="button"
            onClick={async () => {
              await client?.auth.signOut();
              setMode("Sign in");
              setMessage("Signed out. Local data remains on this device.");
            }}
          >
            {tr("Sign out")}
          </button>
        )}
      </div>
    </form>
  );
}
