"use client";
import { useCallback, useMemo } from "react";
import { supabase } from "./supabase";
import type { Project } from "./types";
import { SIGNED_IMAGE_TTL_SECONDS } from "./signed-image-policy";
import { useRenewingResource } from "./use-renewing-resource";

export function useProjectCovers(
  projects: Project[],
  identity: string,
  enabled: boolean,
) {
  const paths = JSON.stringify(
    [
      ...new Set(projects.flatMap((p) => (p.cover_path ? [p.cover_path] : []))),
    ].sort(),
  );
  const load = useCallback(
    async (signal: AbortSignal) => {
      const pairs = await Promise.all(
        (JSON.parse(paths) as string[]).map(async (path) => {
          const { data, error } = await supabase!.storage
            .from("project-covers")
            .createSignedUrl(path, SIGNED_IMAGE_TTL_SECONDS);
          if (error) throw error;
          return [path, data.signedUrl] as const;
        }),
      );
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return Object.fromEntries(pairs);
    },
    [paths],
  );
  const resource = useRenewingResource(
    `${identity}:${paths}`,
    enabled && !!supabase && paths !== "[]",
    load,
    "ต่ออายุรูปโครงการไม่สำเร็จ",
  );
  const covered = useMemo(
    () =>
      !enabled
        ? projects
        : projects.map((p) => ({
            ...p,
            cover_url: p.cover_path
              ? resource.value?.[p.cover_path]
              : undefined,
          })),
    [enabled, projects, resource.value],
  );
  return { projects: covered, imageError: resource.imageError };
}
