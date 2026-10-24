"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  demoStorageSummary,
  parseStorageSummary,
  type StorageSummary,
} from "./storage-usage";
import type { Dataset } from "./types";
export function useStorageUsage(
  workspace: string,
  user: string,
  demo: boolean,
  data: Dataset,
  enabled = true,
) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    scope: string;
    key: string;
    summary: StorageSummary | null;
    error: string;
  }>({ scope: "", key: "", summary: null, error: "" });
  const scope = `${user}:${workspace}`,
    key = `${scope}:${version}`;
  const lastRead = useRef(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!enabled || !workspace || !user || demo || !supabase) return;
    const controller = new AbortController();
    lastRead.current = Date.now();
    supabase
      .rpc("company_photo_storage", { target_workspace: workspace })
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        try {
          if (error) throw error;
          setResult({
            scope,
            key,
            summary: parseStorageSummary(data, workspace),
            error: "",
          });
        } catch {
          setResult({
            scope,
            key,
            summary: null,
            error: "ตรวจพื้นที่จัดเก็บไม่สำเร็จ กรุณาลองใหม่",
          });
        }
      });
    return () => controller.abort();
  }, [workspace, user, demo, scope, key, enabled]);
  useEffect(() => {
    if (!enabled || !workspace || !user || demo) return;
    const update = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRead.current >= 300000
      )
        refresh();
    };
    const timer = setInterval(update, 300000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [workspace, user, demo, refresh, enabled]);
  return {
    summary: !enabled
      ? null
      : demo
        ? demoStorageSummary(data, workspace)
        : result.scope === scope
          ? result.summary
          : null,
    loading: enabled && !demo && !!workspace && !!user && result.key !== key,
    error: enabled && !demo && result.key === key ? result.error : "",
    refresh,
  };
}
