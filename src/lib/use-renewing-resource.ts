"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SIGNED_IMAGE_RENEW_MS } from "./signed-image-policy";
const FIRST_RETRY_MS = 30000;

// Refresh a read-only resource, never its parent's document/editor state.
export function useRenewingResource<T>(
  key: string,
  enabled: boolean,
  load: (signal: AbortSignal) => Promise<T>,
  errorMessage: string,
) {
  const [result, setResult] = useState<{
    key: string;
    value?: T;
    error: string;
  }>({ key: "", error: "" });
  const actions = useRef({ refresh: () => {}, imageError: () => {} });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    let pending = false;
    let refreshQueued = false;
    let due = 0;
    let retryDelay = FIRST_RETRY_MS;
    let imageRetried = false;
    let failed = false;
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(check, Math.max(1000, due - Date.now()));
    }
    async function run(reason: "renew" | "manual" | "image") {
      if (!active) return;
      if (pending) {
        // An upload/delete may complete during a timed read. Read again after
        // it finishes so its older snapshot cannot hide the user's new photo.
        if (reason === "manual") refreshQueued = true;
        return;
      }
      pending = true;
      const started = Date.now();
      try {
        const value = await load(controller.signal);
        if (!active) return;
        failed = false;
        retryDelay = FIRST_RETRY_MS;
        if (reason !== "image") imageRetried = false;
        due = started + SIGNED_IMAGE_RENEW_MS;
        setResult({ key, value, error: "" });
      } catch {
        if (!active) return;
        failed = true;
        // Do not retain URLs after failed authorization/renewal.
        setResult({ key, error: errorMessage });
        due = Date.now() + retryDelay;
        retryDelay = Math.min(retryDelay * 2, 5 * 60 * 1000);
      } finally {
        pending = false;
        if (active) {
          if (refreshQueued) {
            refreshQueued = false;
            void run("manual");
          } else schedule();
        }
      }
    }
    function check() {
      if (document.visibilityState !== "hidden" && Date.now() >= due)
        void run("renew");
    }
    function online() {
      if (failed) due = 0;
      check();
    }
    actions.current = {
      refresh: () => void run("manual"),
      imageError: () => {
        // At most one image-triggered retry per successful timed/manual renewal.
        if (imageRetried || pending) return;
        imageRetried = true;
        void run("image");
      },
    };
    window.addEventListener("focus", check);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", check);
    void run("renew");
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
      actions.current = { refresh: () => {}, imageError: () => {} };
      window.removeEventListener("focus", check);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", check);
    };
  }, [key, enabled, load, errorMessage]);
  const refresh = useCallback(() => actions.current.refresh(), []);
  const imageError = useCallback(() => actions.current.imageError(), []);
  const current = enabled && result.key === key;
  return {
    value: current ? result.value : undefined,
    error: current ? result.error : "",
    loading: enabled && (!current || (!result.value && !result.error)),
    refresh,
    imageError,
  };
}
