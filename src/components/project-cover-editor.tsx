"use client";
/* eslint-disable @next/next/no-img-element -- Private signed URLs and local upload previews. */
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";

export function validateProjectCover(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("กรุณาเลือกรูป JPG, PNG หรือ WebP");
  if (file.size > 5 * 1024 * 1024 || !file.size)
    throw new Error("รูปโครงการต้องมีขนาดไม่เกิน 5 MB และไม่ใช่ไฟล์ว่าง");
}

export function ProjectCoverEditor({
  project,
  onSave,
  onCancel,
}: {
  project: Project;
  onSave: (p: Project, file: File | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  const src = remove ? "" : file ? preview : project.cover_url;
  return (
    <form
      ref={formRef}
      className="panel project-cover-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          if (!file && !remove)
            throw new Error("กรุณาเลือกรูปโครงการก่อนบันทึก");
          if (file && !remove) {
            validateProjectCover(file);
            const bitmap = await createImageBitmap(file).catch(() => {
              throw new Error("ไฟล์รูปภาพนี้เปิดไม่ได้ กรุณาเลือกรูปใหม่");
            });
            bitmap.close();
          }
          await onSave(project, remove ? null : file);
          onCancel();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "บันทึกรูปโครงการไม่สำเร็จ",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>รูปโครงการ — {project.name}</h2>
      <p>
        แสดงบนการ์ดโครงการในหน้าภาพรวมและหน้าโครงการ แนะนำรูปแนวนอน JPG, PNG
        หรือ WebP ขนาดไม่เกิน 5 MB
      </p>
      {src && (
        <img
          className="project-cover-preview"
          src={src}
          alt={`ตัวอย่างรูปโครงการ ${project.name}`}
        />
      )}
      <label>
        รูปโครงการ
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            setError("");
            try {
              if (chosen) validateProjectCover(chosen);
              setFile(chosen);
              setPreview(chosen ? URL.createObjectURL(chosen) : "");
              setRemove(false);
            } catch (err) {
              setFile(null);
              setPreview("");
              e.target.value = "";
              setError(
                err instanceof Error ? err.message : "เลือกรูปไม่สำเร็จ",
              );
            }
          }}
        />
      </label>
      {(project.cover_path || project.cover_url) && (
        <label className="project-cover-remove">
          <input
            type="checkbox"
            checked={remove}
            disabled={busy}
            onChange={(e) => {
              setRemove(e.target.checked);
            }}
          />
          นำรูปโครงการออก ใช้ภาพเริ่มต้น
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="button primary"
          disabled={busy || (!file && !remove)}
        >
          {busy ? "กำลังบันทึก…" : "บันทึกรูปโครงการ"}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onCancel}
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
