"use client";
import { useEffect, useMemo, useState } from "react";
import { Cloud, Download, Upload, LogOut, RefreshCw } from "lucide-react";
import { useLanguage } from "./language";
import { cloudClient } from "../lib/cloud";
import { Data } from "../lib/finance";
import { validateWorkspace } from "../lib/validation";
export default function CloudSync({
  data,
  onReplace,
}: {
  data: Data;
  onReplace: (d: Data) => Promise<void>;
}) {
  const { tr } = useLanguage();
  const client = useMemo(() => cloudClient(), []),
    [user, setUser] = useState<string | null>(null),
    [version, setVersion] = useState<number | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [automatic, setAutomatic] = useState(false),
    [last, setLast] = useState("");
  useEffect(() => {
    if (!client) return;
    client.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user.id || null));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_, session) => {
      setUser(session?.user.id || null);
      setVersion(null);
      setAutomatic(false);
    });
    return () => subscription.unsubscribe();
  }, [client]);
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem("mf-cloud-" + user);
      if (stored) {
        const meta = JSON.parse(stored);
        setVersion(meta.version);
        setLast(meta.last);
      }
    }
  }, [user]);
  function remember(v: number, snapshot: string) {
    setVersion(v);
    setLast(snapshot);
    localStorage.setItem(
      "mf-cloud-" + user,
      JSON.stringify({ version: v, last: snapshot }),
    );
  }
  async function request(method: string, body?: unknown) {
    if (!client) throw Error("Cloud is not configured");
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) throw Error("Sign in in Settings first");
    const response = await fetch("/api/workspace", {
      method,
      headers: {
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "Cloud request failed");
    return result;
  }
  async function upload() {
    if (busy) return;
    setBusy(true);
    try {
      let expected = version;
      if (expected === null) {
        const remote = await request("GET");
        if (remote.data) {
          throw Error(
            "A cloud workspace already exists. Download its backup or load it before uploading local changes.",
          );
        }
        expected = remote.version;
        setVersion(expected);
      }
      const snapshot = JSON.stringify(data);
      const pendingKey = "mf-pending-" + user;
      const prior = JSON.parse(localStorage.getItem(pendingKey) || "null");
      const mutationId =
        prior?.snapshot === snapshot ? prior.mutationId : crypto.randomUUID();
      localStorage.setItem(
        pendingKey,
        JSON.stringify({ snapshot, mutationId }),
      );
      const result = await request("PUT", {
        data,
        version: expected,
        mutationId,
      });
      remember(result.version, snapshot);
      localStorage.removeItem(pendingKey);
      setMessage("Synchronized. Revision " + result.version + ".");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Sync failed. Your local records are retained.",
      );
      setAutomatic(false);
    } finally {
      setBusy(false);
    }
  }
  async function pull(replace: boolean) {
    setBusy(true);
    try {
      const result = await request("GET");
      if (!result.data) {
        remember(result.version, "");
        setMessage("Cloud workspace is empty. You can upload local records.");
        return;
      }
      const parsed = validateWorkspace(result.data);
      if (replace) {
        if (
          !confirm(
            tr(
              "Replace this device’s records with the cloud copy? Export a local backup first.",
            ),
          )
        )
          return;
        await onReplace(parsed);
        remember(result.version, JSON.stringify(parsed));
        setMessage("Cloud workspace loaded.");
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(
          new Blob([JSON.stringify(parsed, null, 2)], {
            type: "application/json",
          }),
        );
        link.download = "moneyflow-cloud-revision-" + result.version + ".json";
        link.click();
        URL.revokeObjectURL(link.href);
        setMessage(
          "Cloud copy downloaded for review. Local data was not changed.",
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cloud unavailable");
    } finally {
      setBusy(false);
    }
  }
  const dirty = JSON.stringify(data) !== last;
  useEffect(() => {
    if (!automatic || !user || !dirty || busy) return;
    const timer = setTimeout(() => {
      if (navigator.onLine) void upload();
    }, 1500);
    const retry = () => {
      if (navigator.onLine) void upload();
    };
    window.addEventListener("online", retry);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [automatic, user, dirty, busy, data]);
  return (
    <section className="panel report-panel">
      <div className="section-heading">
        <h3>
          <Cloud size={16} />
          {tr(" Cloud synchronization")}
        </h3>
        <span className="tag">
          {tr(
            !client
              ? "Not configured"
              : !user
                ? "Signed out"
                : version === null
                  ? "Not linked"
                  : dirty
                    ? "Local changes pending"
                    : "Synchronized",
          )}
        </span>
      </div>
      <p className="muted">
        {tr(
          "Connect your own Supabase project for user-isolated storage. Uploads are atomic. Revision checks stop conflicting edits; stable mutation IDs make retries safe.",
        )}
      </p>
      {!client ? (
        <div className="notice">
          {tr(
            "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, run supabase/001_finance.sql, and restart the server. Cloud functionality has not been verified against a live Supabase instance.",
          )}
        </div>
      ) : !user ? (
        <div className="notice">
          {tr(
            "Sign in or register through Settings to connect this workspace.",
          )}
        </div>
      ) : (
        <>
          <p className="muted">
            {tr("Cloud revision: ")}
            {version ?? "unknown"}
            {tr(". This device’s data stays local until you upload it.")}
          </p>
          <div className="card-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void upload()}
            >
              <Upload size={15} />
              {tr(busy ? "Working…" : "Sync local changes")}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void pull(true)}
            >
              <RefreshCw size={15} />
              {tr(" Load cloud copy")}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void pull(false)}
            >
              <Download size={15} />
              {tr(" Review cloud backup")}
            </button>
          </div>
          <label className="sync-checkbox">
            <input
              type="checkbox"
              disabled={version === null}
              checked={automatic}
              onChange={(e) => setAutomatic(e.target.checked)}
            />{" "}
            {tr(
              "Automatically sync changes and retry when online during this session",
            )}
          </label>
          <button
            className="text-button"
            onClick={async () => {
              setAutomatic(false);
              await client.auth.signOut();
              setMessage("Signed out. Local records remain on this device.");
            }}
          >
            <LogOut size={14} />
            {tr(" Sign out of cloud")}
          </button>
        </>
      )}
      {message && (
        <div className="notice" role="status">
          {tr(String(message))}
        </div>
      )}
    </section>
  );
}
