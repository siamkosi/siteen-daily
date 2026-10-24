"use client";
/* eslint-disable @next/next/no-img-element -- Private project images use short-lived signed URLs. */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  FilePenLine,
  Images,
  Settings,
  LogOut,
  Plus,
  ArrowUpRight,
  HardHat,
  Search,
  CloudSun,
  Users,
  Menu,
  X,
  Trash2,
  HardDrive,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/lib/google-auth";
import { GoogleSignInButton } from "./google-sign-in";
import {
  DocumentConflictError,
  documentSaveError,
  requireDocumentVersion,
} from "@/lib/document-concurrency";
import { workspaceRows } from "@/lib/data";
import { DEMO_USER, DEMO_WORKSPACE, loadDemo, saveDemo } from "@/lib/demo";
import {
  Dataset,
  Project,
  Report,
  Photo,
  Workspace,
  thaiDate,
  today,
} from "@/lib/types";
import { nextReportDate } from "@/lib/report-details";
import { ReportForm, ReportView } from "./reports";
import { PhotoGallery } from "./photo-gallery";
import { preparePhoto, photoDataUrl } from "@/lib/prepare-photo";
import { storePreparedPhoto } from "@/lib/photos";
import { CompanyMembers } from "./company-members";
import { workspacePreference } from "@/lib/workspace-preference";
import { DailyRequests, DailyDocuments } from "./daily-requests";
import { reportFromRequest } from "@/lib/daily-request";
import { SiteBrand } from "./site-brand";
import {
  activeDataset,
  documentStatus,
  isActiveDocument,
  type ChangeDocument,
} from "@/lib/document-lifecycle";
import { DocumentTrash } from "./document-lifecycle";
import { useStorageUsage } from "@/lib/use-storage-usage";
import { useProjectCovers } from "@/lib/use-project-covers";
import { StorageUsagePage, StorageWarning } from "./storage-usage";
import {
  ProjectCoverEditor,
  validateProjectCover,
} from "./project-cover-editor";

const empty: Dataset = { projects: [], reports: [], photos: [], requests: [] };
const nav = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/projects", label: "โครงการ", icon: FolderKanban },
  { href: "/requests", label: "Daily Request", icon: FilePenLine },
  { href: "/reports", label: "Daily Report", icon: ClipboardList },
  { href: "/photos", label: "รูปภาพหน้างาน", icon: Images },
  { href: "/storage", label: "พื้นที่จัดเก็บรูป", icon: HardDrive },
  { href: "/trash", label: "ถังขยะเอกสาร", icon: Trash2 },
  { href: "/settings", label: "บริษัทและการตั้งค่า", icon: Settings },
];
export default function SiteApp() {
  const path = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    email?: string;
    last_sign_in_at?: string;
  } | null>(null);
  const [demo, setDemo] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [rawData, setData] = useState<Dataset>(empty);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState(false);
  const requestVersion = useRef(0);
  const authIdentity = useRef<string | null>(null);
  const active = workspaces.find((w) => w.id === workspace);
  const canEdit = active?.role === "owner" || active?.role === "editor";
  const coverImages = useProjectCovers(
    rawData.projects,
    `${user?.id ?? ""}:${user?.last_sign_in_at ?? ""}:${workspace}`,
    !demo && !!user && !!workspace,
  );
  const data = { ...rawData, projects: coverImages.projects };
  const storage = useStorageUsage(workspace, user?.id ?? "", demo, data);
  const enterDemo = useCallback(() => {
    try {
      const snapshot = loadDemo();
      setDemo(true);
      setUser({ id: DEMO_USER, email: "demo@sitedaily.th" });
      setWorkspaces([
        {
          id: DEMO_WORKSPACE,
          name: "สยาม คอนสตรัคชั่น (ตัวอย่าง)",
          role: "owner",
        },
      ]);
      setWorkspace(DEMO_WORKSPACE);
      setData(snapshot);
    } catch {
      setError("อ่านข้อมูลทดลองไม่สำเร็จ กรุณาล้างข้อมูลเว็บไซต์แล้วลองใหม่");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (sessionStorage.getItem("site-daily-demo") === "true") {
      // Initial synchronization with browser storage after server rendering.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      enterDemo();
      return;
    }
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true;
    let authEvents = 0;
    function applyUser(
      next: { id: string; email?: string; last_sign_in_at?: string } | null,
    ) {
      if (authIdentity.current !== (next?.id ?? null)) {
        requestVersion.current++;
        setData(empty);
        setWorkspace("");
        setWorkspaces([]);
        authIdentity.current = next?.id ?? null;
      }
      // Token refresh / tab focus must not reload and unmount an unsaved editor.
      setUser((previous) =>
        previous?.id === next?.id &&
        previous?.email === next?.email &&
        previous?.last_sign_in_at === next?.last_sign_in_at
          ? previous
          : next,
      );
    }
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (alive) {
          if (authEvents === 0) applyUser(data.user);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      authEvents++;
      applyUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [enterDemo]);
  const loadWorkspaces = useCallback(async () => {
    if (!supabase || !user || demo) return;
    const { data, error } = await supabase
      .from("memberships")
      .select("workspace_id, role, workspaces(id,name)")
      .eq("user_id", user.id);
    if (error) throw error;
    if (authIdentity.current !== user.id) return;
    const list = (data ?? []).map((m) => ({
      ...(m.workspaces as unknown as { id: string; name: string }),
      role: m.role,
    })) as Workspace[];
    setWorkspaces(list);
    const { preferred, newLogin } = workspacePreference(
      user,
      list,
      sessionStorage,
    );
    setWorkspace((current) => {
      if (newLogin) return preferred;
      if (list.some((w) => w.id === current)) return current;
      if (list.some((w) => w.id === preferred)) return preferred;
      return list[0]?.id ?? "";
    });
  }, [user, demo]);
  useEffect(() => {
    // Synchronize company membership with the authenticated external session.
    loadWorkspaces().catch((e) => setError(e.message));
  }, [loadWorkspaces]);
  const reload = useCallback(async () => {
    if (!supabase || demo || !workspace || !user) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setData(empty);
    try {
      const [projects, reports, requests] = await Promise.all([
        workspaceRows<Project>("projects", workspace),
        workspaceRows<Report>("daily_reports", workspace),
        workspaceRows<Report>("daily_requests", workspace),
      ]);
      if (version !== requestVersion.current) return;
      setData({
        projects,
        reports,
        photos: [],
        requests,
      });
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [workspace, demo, user]);
  useEffect(() => {
    // Fetching a different tenant resets loading/data before the request begins.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload().catch((e) => setError(e.message));
    return () => {
      // This is a request generation counter, not a DOM ref captured by cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestVersion.current++;
    };
  }, [reload]);
  useEffect(() => {
    if (ready && !user && path !== "/login") router.replace("/login");
    if (ready && user && (path === "/" || path === "/login"))
      router.replace("/dashboard");
  }, [ready, user, path, router]);
  function changeDemo(next: Dataset) {
    saveDemo(next);
    setData(next);
  }
  async function saveProject(p: Project) {
    if (demo)
      changeDemo({
        ...data,
        projects: [p, ...data.projects.filter((x) => x.id !== p.id)],
      });
    else {
      const result = data.projects.some((x) => x.id === p.id)
        ? await supabase!
            .from("projects")
            .update({
              name: p.name,
              location: p.location,
              client: p.client,
              status: p.status,
            })
            .eq("id", p.id)
            .eq("workspace_id", workspace)
            .select("id")
            .single()
        : await supabase!.from("projects").insert(p);
      if (result.error) throw result.error;
      storage.refresh();
      await reload();
    }
  }
  async function saveProjectCover(p: Project, file: File | null) {
    if (
      !canEdit ||
      p.workspace_id !== workspace ||
      !data.projects.some((x) => x.id === p.id)
    )
      throw new Error("ไม่มีสิทธิ์แก้ไขรูปโครงการนี้");
    if (file) validateProjectCover(file);
    if (demo) {
      const url = file
        ? await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error("อ่านรูปไม่สำเร็จ"));
            r.readAsDataURL(file);
          })
        : undefined;
      changeDemo({
        ...data,
        projects: data.projects.map((x) =>
          x.id === p.id ? { ...x, cover_path: null, cover_url: url } : x,
        ),
      });
      return;
    }
    const bucket = supabase!.storage.from("project-covers");
    const ext = file
      ? { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[
          file.type
        ]
      : "";
    const path = file
      ? `${workspace}/${p.id}/${crypto.randomUUID()}.${ext}`
      : null;
    if (file && path) {
      const { error } = await bucket.upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
    }
    const { error } = await supabase!
      .from("projects")
      .update({ cover_path: path })
      .eq("id", p.id)
      .eq("workspace_id", workspace)
      .select("id")
      .single();
    if (error) {
      if (path) await bucket.remove([path]);
      storage.refresh();
      throw error;
    }
    if (p.cover_path) await bucket.remove([p.cover_path]);
    storage.refresh();
    await reload();
  }
  async function saveReport(r: Report) {
    if (!canEdit || r.workspace_id !== workspace)
      throw new Error("ไม่มีสิทธิ์แก้ไขรายงานในบริษัทนี้");
    if (
      data.reports.some(
        (other) =>
          isActiveDocument(other) &&
          other.id !== r.id &&
          other.project_id === r.project_id &&
          other.report_date === r.report_date,
      )
    )
      throw new Error(
        "โครงการนี้มีรายงานวันที่เลือกแล้ว กรุณาเปิดรายงานเดิมหรือเลือกวันอื่น",
      );
    if (demo) saveDemoDocument(r, "report");
    else {
      const { error } = data.reports.some((x) => x.id === r.id)
        ? await supabase!
            .from("daily_reports")
            .update({
              expected_version: requireDocumentVersion(r.row_version),
              report_date: r.report_date,
              weather: r.weather,
              workers: r.workers,
              work_done: r.work_done,
              materials: r.materials,
              equipment: r.equipment,
              issues: r.issues,
              tomorrow: r.tomorrow,
              status: r.status,
              report_details: r.report_details,
            })
            .eq("id", r.id)
            .eq("workspace_id", workspace)
            .eq("row_version", requireDocumentVersion(r.row_version))
            .select("id")
            .single()
        : await supabase!.from("daily_reports").insert(r);
      if (error) throw documentSaveError(error);
      await reload();
    }
  }
  async function saveRequest(r: Report) {
    if (!canEdit || r.workspace_id !== workspace)
      throw new Error("ไม่มีสิทธิ์แก้ไขคำขอในบริษัทนี้");
    const requests = data.requests ?? [];
    if (
      requests.some(
        (x) =>
          isActiveDocument(x) &&
          x.id !== r.id &&
          x.project_id === r.project_id &&
          x.report_date === r.report_date,
      )
    )
      throw new Error(
        "โครงการนี้มี Daily Request ของวันที่เลือกแล้ว กรุณาเปิดแก้ไขฉบับเดิม",
      );
    if (demo) saveDemoDocument(r, "request");
    else {
      const result = requests.some((x) => x.id === r.id)
        ? await supabase!
            .from("daily_requests")
            .update({
              expected_version: requireDocumentVersion(r.row_version),
              report_date: r.report_date,
              weather: r.weather,
              workers: r.workers,
              work_done: r.work_done,
              materials: r.materials,
              equipment: r.equipment,
              issues: r.issues,
              tomorrow: r.tomorrow,
              status: r.status,
              report_details: r.report_details,
            })
            .eq("id", r.id)
            .eq("workspace_id", workspace)
            .eq("row_version", requireDocumentVersion(r.row_version))
            .select("id")
            .single()
        : await supabase!
            .from("daily_requests")
            .insert(r)
            .select("id")
            .single();
      if (result.error)
        throw result.error.code === "23505"
          ? new Error(
              "มี Daily Request ของโครงการและวันนี้แล้ว กรุณาเปิดฉบับเดิม",
            )
          : documentSaveError(result.error);
      await reload();
    }
  }
  function saveDemoDocument(r: Report, kind: "report" | "request") {
    const latest = loadDemo();
    const list = kind === "report" ? latest.reports : (latest.requests ?? []);
    const old = list.find((x) => x.id === r.id);
    if (old && (old.row_version ?? 1) !== (r.row_version ?? 1))
      throw new DocumentConflictError();
    if (!old && r.row_version !== undefined) throw new DocumentConflictError();
    if (
      list.some(
        (other) =>
          other.id !== r.id &&
          isActiveDocument(other) &&
          other.project_id === r.project_id &&
          other.report_date === r.report_date,
      )
    )
      throw new Error("มีเอกสารของโครงการและวันเดียวกันแล้ว กรุณาเปิดฉบับเดิม");
    if (
      old &&
      (!isActiveDocument(old) ||
        (old.status === "submitted" && r.status === "draft"))
    )
      throw new Error("เอกสารนี้แก้ไขเป็นร่างไม่ได้");
    const now = new Date().toISOString();
    const next = {
      ...r,
      updated_at: now,
      row_version: old ? (old.row_version ?? 1) + 1 : 1,
    };
    changeDemo({
      ...latest,
      [kind === "report" ? "reports" : "requests"]: [
        next,
        ...list.filter((x) => x.id !== r.id),
      ],
      document_events: [
        ...(latest.document_events ?? []),
        {
          id: crypto.randomUUID(),
          workspace_id: workspace,
          document_kind: kind,
          document_id: r.id,
          action: !old
            ? "created"
            : old.status === "draft" && r.status === "submitted"
              ? "submitted"
              : "edited",
          actor_id: user!.id,
          occurred_at: now,
          before_data: old,
          after_data: next,
          photos: latest.photos.filter((p) => p.report_id === r.id),
        },
      ],
    });
  }
  const changeDocument: ChangeDocument = async (
    kind,
    document,
    action,
    reason,
  ) => {
    if (!user || !canEdit || document.workspace_id !== workspace)
      throw new Error("ไม่มีสิทธิ์จัดการเอกสารนี้");
    if (demo) {
      const latest = loadDemo();
      const owner = active?.role === "owner";
      const now = new Date().toISOString();
      const list = kind === "report" ? latest.reports : (latest.requests ?? []);
      const current = list.find((r) => r.id === document.id);
      if (!current || current.updated_at !== document.updated_at)
        throw new Error("เอกสารเปลี่ยนแล้ว กรุณาเปิดใหม่");
      if (
        action === "trash" &&
        (current.deleted_at ||
          current.status !== "draft" ||
          (!owner && current.created_by !== user.id))
      )
        throw new Error("ไม่มีสิทธิ์ย้ายร่างนี้ไปถังขยะ");
      if (
        action === "restore" &&
        (!owner ||
          !current.deleted_at ||
          Date.now() >= new Date(current.deleted_at).getTime() + 30 * 86400000)
      )
        throw new Error("กู้คืนไม่ได้: ต้องเป็น Owner และยังไม่ครบ 30 วัน");
      if (
        action === "restore" &&
        list.some(
          (r) =>
            r.id !== current.id &&
            isActiveDocument(r) &&
            r.project_id === current.project_id &&
            r.report_date === current.report_date,
        )
      )
        throw new Error(
          "มีเอกสารของโครงการและวันเดียวกันแล้ว กรุณาจัดการฉบับนั้นก่อนกู้คืน",
        );
      if (
        action === "cancel" &&
        (!owner ||
          current.deleted_at ||
          current.status !== "submitted" ||
          !reason?.trim())
      )
        throw new Error(
          "เฉพาะ Owner ยกเลิกเอกสารที่ส่งแล้วได้ โดยต้องระบุเหตุผล",
        );
      const next: Report = {
        ...current,
        row_version: (current.row_version ?? 1) + 1,
        updated_at: now,
        ...(action === "trash"
          ? { deleted_at: now, deleted_by: user.id }
          : action === "restore"
            ? { deleted_at: null, deleted_by: null }
            : {
                status: "cancelled",
                cancelled_at: now,
                cancelled_by: user.id,
                cancellation_reason: reason!.trim(),
              }),
      };
      changeDemo({
        ...latest,
        [kind === "report" ? "reports" : "requests"]: list.map((r) =>
          r.id === next.id ? next : r,
        ),
        document_events: [
          ...(latest.document_events ?? []),
          {
            id: crypto.randomUUID(),
            workspace_id: workspace,
            document_kind: kind,
            document_id: next.id,
            action:
              action === "trash"
                ? "trashed"
                : action === "restore"
                  ? "restored"
                  : "cancelled",
            actor_id: user.id,
            occurred_at: now,
            reason,
            before_data: current,
            after_data: next,
            photos: latest.photos.filter((p) => p.report_id === next.id),
          },
        ],
      });
      return;
    }
    const { error } = await supabase!.rpc("change_document_state", {
      target_workspace: workspace,
      document_kind: kind,
      target_document: document.id,
      action,
      expected_updated_at: document.updated_at,
      reason: reason ?? null,
    });
    if (error)
      throw new Error(
        error.code === "23505"
          ? "มีเอกสารของโครงการและวันเดียวกันแล้ว กรุณาจัดการฉบับนั้นก่อนกู้คืน"
          : error.code === "40001"
            ? "เอกสารเปลี่ยนแล้วหรือไม่มีสิทธิ์ กรุณาเปิดใหม่"
            : error.message,
      );
    storage.refresh();
    await reload();
  };
  async function logout() {
    if (!demo) {
      const { error } = await supabase!.auth.signOut();
      if (error) {
        setError(error.message);
        return;
      }
    }
    sessionStorage.removeItem("site-daily-demo");
    requestVersion.current++;
    setUser(null);
    setData(empty);
    setDemo(false);
    setWorkspace("");
    setWorkspaces([]);
    router.replace("/login");
  }
  if (!ready)
    return (
      <div className="loading" role="status">
        กำลังเปิด SiteEN DAILY…
      </div>
    );
  if (!user)
    return (
      <Login
        onDemo={() => {
          sessionStorage.setItem("site-daily-demo", "true");
          enterDemo();
          router.push("/dashboard");
        }}
      />
    );
  const reportId = path.startsWith("/reports/") ? path.split("/")[2] : null;
  const report = data.reports.find((r) => r.id === reportId);
  const requestSourceId = searchParams.get("request");
  const requestSource = (data.requests ?? []).find(
    (r) => isActiveDocument(r) && r.id === requestSourceId,
  );
  const requestReport = requestSource
    ? data.reports.find(
        (r) =>
          isActiveDocument(r) &&
          r.project_id === requestSource.project_id &&
          r.report_date === requestSource.report_date,
      )
    : undefined;
  const sourceId = searchParams.get("from");
  const sourceReport = data.reports.find(
    (r) =>
      isActiveDocument(r) && r.id === sourceId && r.workspace_id === workspace,
  );
  const existingNext = sourceReport
    ? data.reports.find(
        (r) =>
          isActiveDocument(r) &&
          r.project_id === sourceReport.project_id &&
          r.report_date === nextReportDate(sourceReport.report_date),
      )
    : undefined;
  const activeData = activeDataset(data);
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <Link className="brand" href="/dashboard">
          <SiteBrand tagline />
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="ปิดเมนู"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <div className="workspace-label">พื้นที่ทำงาน</div>
        <label className="sr-only" htmlFor="workspace">
          เลือกบริษัท
        </label>
        <select
          id="workspace"
          className="workspace-select"
          value={workspace}
          onChange={(e) => {
            requestVersion.current++;
            setData(empty);
            setWorkspace(e.target.value);
            if (!demo) {
              try {
                sessionStorage.setItem(
                  `site-daily-workspace:${user.id}`,
                  e.target.value,
                );
              } catch {}
            }
          }}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMobile(false)}
              className={
                path === n.href ||
                (n.href === "/reports" && path.startsWith("/reports/"))
                  ? "nav-item selected"
                  : "nav-item"
              }
            >
              <n.icon size={20} />
              {n.label}
              {n.href === "/reports" && (
                <span className="nav-count">{activeData.reports.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip">
            <HardHat size={24} />
            <strong>หน้างานดี เริ่มที่ข้อมูลชัด</strong>
            <p>บันทึกวันนี้ เพื่อให้งานพรุ่งนี้เดินหน้า</p>
          </div>
          <div className="profile">
            <span className="avatar">
              {user.email?.[0]?.toUpperCase() || "S"}
            </span>
            <div>
              <b>{demo ? "วิศวกรสยาม" : user.email}</b>
              <small>
                {active?.role === "viewer"
                  ? "ผู้ดูข้อมูล"
                  : active?.role === "owner"
                    ? "เจ้าของบริษัท"
                    : "วิศวกร / ผู้บันทึก"}
              </small>
            </div>
            <button
              aria-label="ออกจากระบบ"
              className="icon-button"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="mobile-menu icon-button"
              aria-label="เปิดเมนู"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              พื้นที่ทำงาน <span>/</span>{" "}
              <b>
                {nav.find((n) => path.startsWith(n.href))?.label ||
                  "Daily Report"}
              </b>
            </span>
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            {demo ? "โหมดทดลอง • ข้อมูลในเครื่อง" : "เชื่อมต่อ Supabase"}
            <span className="top-avatar">S</span>
          </div>
        </header>
        <main>
          <div className="notice">
            {demo
              ? "กำลังทดลองด้วยข้อมูลตัวอย่าง • ข้อมูลและรูปเก็บในเบราว์เซอร์นี้เท่านั้น"
              : "พื้นที่บริษัท: " + (active?.name ?? "ยังไม่ได้สร้างบริษัท")}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="ปิดข้อความ">
                ×
              </button>
            </div>
          )}
          {loading ? (
            <div role="status" className="panel">
              กำลังโหลดข้อมูล…
            </div>
          ) : !workspace ? (
            <WorkspaceSetup onCreated={loadWorkspaces} />
          ) : (
            <>
              {path !== "/storage" && (
                <StorageWarning
                  summary={storage.summary}
                  error={storage.error}
                />
              )}
              {path === "/dashboard" && (
                <>
                  <Dashboard
                    data={activeData}
                    canEdit={canEdit}
                    onCoverError={coverImages.imageError}
                  />
                  <DailyDocuments data={activeData} />
                </>
              )}
              {path === "/projects" && (
                <Projects
                  data={activeData}
                  workspace={workspace}
                  canEdit={canEdit}
                  save={saveProject}
                  saveCover={saveProjectCover}
                  onCoverError={coverImages.imageError}
                />
              )}
              {(path === "/requests" || path.startsWith("/requests/")) && (
                <DailyRequests
                  key={`${workspace}:${path}:${searchParams.get("project") ?? ""}:${searchParams.get("fromReport") ?? ""}`}
                  data={data}
                  workspace={workspace}
                  user={user.id}
                  workspaceName={active?.name ?? ""}
                  canEdit={canEdit}
                  id={path.split("/")[2]}
                  projectId={searchParams.get("project") ?? undefined}
                  sourceReportId={searchParams.get("fromReport") ?? undefined}
                  save={saveRequest}
                  role={active?.role}
                  change={changeDocument}
                  demoEvents={demo ? (data.document_events ?? []) : undefined}
                />
              )}
              {path === "/reports" && (
                <ReportList
                  data={{
                    ...data,
                    reports: data.reports.filter((r) => !r.deleted_at),
                  }}
                  canEdit={canEdit}
                />
              )}
              {reportId === "new" &&
                (canEdit ? (
                  requestSourceId && !requestSource ? (
                    <div className="panel">
                      ไม่พบ Daily Request ต้นฉบับในบริษัทนี้
                    </div>
                  ) : requestReport ? (
                    <div className="panel">
                      มี Daily Report ของวันเดียวกันแล้ว{" "}
                      <Link href={`/reports/${requestReport.id}`}>
                        เปิดรายงานเดิม
                      </Link>
                    </div>
                  ) : sourceId && !sourceReport ? (
                    <div className="panel">
                      ไม่พบรายงานต้นฉบับในบริษัทนี้{" "}
                      <Link href="/reports">กลับไปรายงานทั้งหมด</Link>
                    </div>
                  ) : existingNext ? (
                    <div className="panel">
                      <h2>มีรายงานวันถัดไปแล้ว</h2>
                      <p>
                        {thaiDate(existingNext.report_date)}{" "}
                        สามารถเปิดแก้ไขต่อได้
                      </p>
                      <Link
                        className="button primary"
                        href={`/reports/${existingNext.id}`}
                      >
                        เปิดรายงานที่มีอยู่
                      </Link>
                    </div>
                  ) : (
                    <ReportForm
                      key={`${workspace}:${requestSourceId ?? sourceId ?? "blank"}`}
                      source={sourceReport}
                      prefill={
                        requestSource
                          ? reportFromRequest(requestSource)
                          : undefined
                      }
                      projects={data.projects}
                      workspace={workspace}
                      user={user.id}
                      save={saveReport}
                    />
                  )
                ) : (
                  <div className="panel">
                    สิทธิ์ผู้ดูข้อมูลไม่สามารถสร้างรายงานได้
                  </div>
                ))}
              {reportId &&
                reportId !== "new" &&
                (report ? (
                  <ReportView
                    key={report.id}
                    dailyRequest={(data.requests ?? []).find(
                      (r) =>
                        isActiveDocument(r) &&
                        r.project_id === report.project_id &&
                        r.report_date === report.report_date,
                    )}
                    report={report}
                    demo={demo}
                    project={data.projects.find(
                      (p) => p.id === report.project_id,
                    )!}
                    workspaceName={active?.name ?? ""}
                    photos={data.photos.filter(
                      (p) => p.report_id === report.id,
                    )}
                    canEdit={canEdit && isActiveDocument(report)}
                    role={active?.role}
                    user={user.id}
                    change={changeDocument}
                    demoEvents={demo ? (data.document_events ?? []) : undefined}
                    save={saveReport}
                    upload={async (files, caption, progress) => {
                      let completed = 0;
                      try {
                        for (const file of files) {
                          progress(
                            `กำลังเตรียมรูป ${completed + 1}/${files.length}: ${file.name}`,
                          );
                          const prepared = await preparePhoto(file);
                          const id = crypto.randomUUID();
                          const photo: Photo = {
                            id,
                            workspace_id: workspace,
                            project_id: report.project_id,
                            report_id: report.id,
                            path: `${workspace}/${report.project_id}/${report.id}/${id}.jpeg`,
                            thumbnail_path: `${workspace}/${report.project_id}/${report.id}/${id}.thumb.jpeg`,
                            caption,
                            created_at: new Date().toISOString(),
                            image_width: prepared.width,
                            image_height: prepared.height,
                            byte_size: prepared.image.size,
                            thumbnail_byte_size: prepared.thumbnail.size,
                            source_byte_size: prepared.sourceBytes,
                          };
                          if (demo) {
                            const url = await photoDataUrl(prepared.image);
                            const thumbnail_url = await photoDataUrl(
                              prepared.thumbnail,
                            );
                            const next = loadDemo();
                            next.photos.push({ ...photo, url, thumbnail_url });
                            changeDemo(next);
                          } else {
                            progress(
                              `กำลังอัปโหลดรูป ${completed + 1}/${files.length}: ${file.name}`,
                            );
                            await storePreparedPhoto(photo, prepared);
                          }
                          completed++;
                        }
                      } catch (e) {
                        throw new Error(
                          `${e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ"}${completed ? ` • บันทึกแล้ว ${completed} รูป กรุณาเลือกเฉพาะรูปที่ยังไม่สำเร็จเมื่อลองใหม่` : ""}`,
                        );
                      } finally {
                        storage.refresh();
                      }
                    }}
                    removePhoto={async (photo) => {
                      try {
                        if (demo)
                          changeDemo({
                            ...data,
                            photos: data.photos.filter(
                              (p) => p.id !== photo.id,
                            ),
                          });
                        else {
                          const { error } = await supabase!.storage
                            .from("site-photos")
                            .remove([
                              photo.path,
                              ...(photo.thumbnail_path
                                ? [photo.thumbnail_path]
                                : []),
                            ]);
                          if (error) throw error;
                          const { error: dbError } = await supabase!
                            .from("photos")
                            .delete()
                            .eq("id", photo.id)
                            .eq("workspace_id", workspace);
                          if (dbError) throw dbError;
                        }
                      } finally {
                        storage.refresh();
                      }
                    }}
                  />
                ) : (
                  <div className="panel">
                    ไม่พบรายงาน หรือไม่มีสิทธิ์เข้าถึง
                  </div>
                ))}
              {path === "/photos" && (
                <>
                  <PageHeading
                    title="รูปภาพหน้างาน"
                    description="หลักฐานความคืบหน้า เชื่อมโยงกับรายงานทุกภาพ"
                  />
                  <PhotoGallery
                    key={`${workspace}:${user.id}`}
                    workspace={workspace}
                    demo={demo}
                    photos={activeData.photos}
                    reports={activeData.reports}
                    projects={data.projects}
                  />
                </>
              )}
              {path === "/trash" && (
                <DocumentTrash
                  data={data}
                  role={active?.role}
                  user={user.id}
                  change={changeDocument}
                />
              )}
              {path === "/storage" && (
                <StorageUsagePage
                  key={`${workspace}:${user.id}`}
                  workspace={workspace}
                  role={active?.role}
                  summary={storage.summary}
                  loading={storage.loading}
                  error={storage.error}
                  refresh={storage.refresh}
                  demo={demo}
                  saveDemoQuota={(quota) =>
                    changeDemo({ ...data, storage_quota_bytes: quota })
                  }
                />
              )}
              {path === "/settings" && (
                <>
                  <PageHeading
                    title="บริษัทและการตั้งค่า"
                    description="ข้อมูลพื้นที่ทำงานและสถานะการเชื่อมต่อ"
                  />
                  <div className="panel settings">
                    <h2>{active?.name}</h2>
                    <p>สิทธิ์ของคุณ: {active?.role}</p>
                    <p>
                      {demo
                        ? "โหมดทดลอง ยังไม่ได้เชื่อมฐานข้อมูลจริง"
                        : "Supabase Auth + RLS + Private Storage"}
                    </p>
                    <p>การเพิ่มสมาชิกใหม่ยังต้องให้ผู้ดูแลระบบดำเนินการ</p>
                    <WorkspaceSetup
                      onCreated={loadWorkspaces}
                      disabled={demo}
                    />
                  </div>
                  {!demo && active?.role === "owner" && (
                    <CompanyMembers
                      key={`${user.id}:${workspace}`}
                      workspace={workspace}
                      workspaceName={active.name}
                    />
                  )}
                  {!demo && active?.role !== "owner" && (
                    <div className="panel">
                      <p>
                        เฉพาะ owner
                        ของบริษัทนี้ที่ดูรายชื่อและจัดการบทบาทสมาชิกได้
                      </p>
                    </div>
                  )}
                </>
              )}
              {![
                "/dashboard",
                "/projects",
                "/reports",
                "/requests",
                "/photos",
                "/storage",
                "/trash",
                "/settings",
                "/",
                "/login",
              ].includes(path) &&
                !reportId &&
                !path.startsWith("/requests/") && (
                  <div className="panel">
                    ไม่พบหน้านี้ <Link href="/dashboard">กลับภาพรวม</Link>
                  </div>
                )}
            </>
          )}
          <footer className="page-footer">
            SiteEN DAILY <span>พื้นที่เล็ก ๆ สำหรับงานก่อสร้างที่ยิ่งใหญ่</span>
            <b>MVP 1.0</b>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Login({ onDemo }: { onDemo: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signup, setSignup] = useState(false);
  return (
    <div className="login">
      <section className="login-story">
        <div className="brand">
          <SiteBrand large />
        </div>
        <div>
          <span className="eyebrow">BUILT FOR THAI CONSTRUCTION TEAMS</span>
          <h1>
            ทุกความคืบหน้า
            <br />
            เริ่มจากบันทึกที่ดี<span>.</span>
          </h1>
          <p>
            รวมโครงการ Daily Report และภาพหน้างาน
            <br />
            ให้ทีมของคุณทำงานบนข้อมูลชุดเดียวกัน
          </p>
          <div className="login-features">
            <span>01 &nbsp; บันทึกง่ายจากมือถือ</span>
            <span>02 &nbsp; เก็บภาพเป็นหลักฐาน</span>
            <span>03 &nbsp; รายงานภาษาไทยพร้อมส่ง</span>
          </div>
        </div>
        <small>ออกแบบเพื่อผู้รับเหมาและวิศวกรไทย</small>
      </section>
      <section className="login-form">
        <div className="login-card">
          <span className="eyebrow">ยินดีต้อนรับสู่ SiteEN DAILY</span>
          <h2>{signup ? "สร้างบัญชีผู้ใช้งาน" : "เข้าสู่ระบบ"}</h2>
          <p>พร้อมให้งานวันนี้เดินหน้ากันหรือยัง?</p>
          <GoogleSignInButton
            busy={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setMessage("");
              try {
                await signInWithGoogle();
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "เข้าสู่ระบบไม่สำเร็จ",
                );
                setBusy(false);
              }
            }}
          />
          <div className="divider login-method-divider">
            หรือใช้อีเมลและรหัสผ่าน
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                if (!supabase)
                  throw new Error(
                    "ยังไม่ได้เชื่อมต่อ Supabase โปรเจกต์พัฒนา กรุณาใช้โหมดทดลองด้านล่าง",
                  );
                const f = new FormData(e.currentTarget);
                const credentials = {
                  email: String(f.get("email")),
                  password: String(f.get("password")),
                };
                const result = signup
                  ? await supabase.auth.signUp(credentials)
                  : await supabase.auth.signInWithPassword(credentials);
                if (result.error) throw result.error;
                if (signup && !result.data.session)
                  setMessage("สร้างบัญชีแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              อีเมล
              <input
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </label>
            <label>
              รหัสผ่าน
              <input
                name="password"
                type="password"
                placeholder="อย่างน้อย 8 ตัวอักษร"
                minLength={8}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
            <button className="button primary w-full" disabled={busy}>
              {busy ? "กำลังดำเนินการ…" : signup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          {message && (
            <p role="status" className="error">
              {message}
            </p>
          )}
          <Link className="text-button" href="/reset-password">
            ลืมรหัสผ่าน?
          </Link>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setSignup(!signup)}
          >
            {signup ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สร้างบัญชี"}
          </button>
          <div className="divider">หรือเริ่มสำรวจการทำงาน</div>
          <button
            className="button secondary w-full"
            disabled={busy}
            onClick={onDemo}
          >
            ทดลองใช้งานด้วยข้อมูลตัวอย่าง <ArrowUpRight size={18} />
          </button>
          <small className="muted block mt-4">
            ไม่ต้องสมัคร • ข้อมูลทดลองเก็บเฉพาะเบราว์เซอร์นี้
          </small>
        </div>
      </section>
    </div>
  );
}
function WorkspaceSetup({
  onCreated,
  disabled = false,
}: {
  onCreated: () => Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="panel workspace-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const name = String(new FormData(e.currentTarget).get("name")).trim();
        if (!name) return;
        setBusy(true);
        try {
          const { error } = await supabase!.rpc("create_workspace", {
            workspace_name: name,
          });
          if (error) throw error;
          await onCreated();
        } catch (e) {
          setError(e instanceof Error ? e.message : "สร้างบริษัทไม่สำเร็จ");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>สร้างพื้นที่บริษัทใหม่</h2>
      <p>โครงการและรายงานจะถูกแยกจากบริษัทอื่น</p>
      <label>
        ชื่อบริษัท
        <input name="name" maxLength={150} required disabled={disabled} />
      </label>
      <button className="button primary" disabled={disabled || busy}>
        {busy ? "กำลังสร้าง…" : "สร้างบริษัท"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Dashboard({
  data,
  canEdit,
  onCoverError,
}: {
  data: Dataset;
  canEdit: boolean;
  onCoverError: () => void;
}) {
  const drafts = data.reports.filter((r) => r.status === "draft");
  const current = data.reports.filter((r) => r.report_date === today());
  return (
    <>
      <div className="greeting">
        <span className="eyebrow">YOUR SITE, AT A GLANCE</span>
        <span>{thaiDate(today())}</span>
      </div>
      <PageHeading
        title="ภาพรวมหน้างาน"
        description="ทุกโครงการ ทุกความคืบหน้า ในที่เดียว"
        action={
          canEdit && (
            <Link className="button primary" href="/reports/new">
              <Plus size={18} />
              สร้างรายงานวันนี้
            </Link>
          )
        }
      />
      <div className="stats-grid">
        {[
          {
            name: "โครงการที่กำลังดำเนินการ",
            value: data.projects.filter((p) => p.status === "active").length,
            unit: "โครงการ",
            icon: FolderKanban,
            tone: "green",
            note: "พร้อมอัปเดตความคืบหน้า",
          },
          {
            name: "รายงานวันนี้",
            value: current.length,
            unit: "ฉบับ",
            icon: ClipboardList,
            tone: "blue",
            note: `จากทั้งหมด ${data.reports.length} ฉบับ`,
          },
          {
            name: "ร่างที่รอบันทึกส่ง",
            value: drafts.length,
            unit: "ฉบับ",
            icon: CloudSun,
            tone: "orange",
            note: "ตรวจสอบก่อนส่งรายงาน",
          },
          {
            name: "แรงงานวันนี้",
            value: current.reduce((n, r) => n + r.workers, 0),
            unit: "คน",
            icon: Users,
            tone: "purple",
            note: "รวมจากรายงานของวันนี้",
          },
        ].map((s) => (
          <div className="stat-card" key={s.name}>
            <div className="stat-top">
              {s.name}
              <span className={`stat-icon ${s.tone}`}>
                <s.icon size={20} />
              </span>
            </div>
            <div className="stat-value">
              {s.value}
              <span>{s.unit}</span>
            </div>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section>
          <div className="section-heading">
            <h2>
              โครงการล่าสุด <span>{data.projects.length}</span>
            </h2>
            <Link href="/projects">
              ดูทั้งหมด <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="project-grid">
            {data.projects.slice(0, 4).map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                reports={data.reports.filter((r) => r.project_id === p.id)}
                index={i}
                onCoverError={onCoverError}
              />
            ))}
            {!data.projects.length && (
              <Empty text="เริ่มสร้างโครงการแรกของคุณ" />
            )}
          </div>
        </section>
        <aside className="daily-note">
          <div className="note-icon">
            <ClipboardList size={26} />
          </div>
          <span className="eyebrow">DAILY REMINDER</span>
          <h2>
            จบวันด้วย
            <br />
            บันทึกที่ครบถ้วน
          </h2>
          <p>อย่าลืมเก็บภาพหน้างาน บันทึกปัญหา และวางแผนงานสำหรับวันพรุ่งนี้</p>
          <Link href="/reports">
            ไปที่ Daily Report <ArrowUpRight size={17} />
          </Link>
          <div className="note-lines">
            <i />
            <i />
            <i />
          </div>
        </aside>
      </div>
      <section className="mt-8">
        <div className="section-heading">
          <h2>รายงานล่าสุด</h2>
          <Link href="/reports">
            ดูทั้งหมด <ArrowUpRight size={15} />
          </Link>
        </div>
        <ReportTable data={{ ...data, reports: data.reports.slice(0, 5) }} />
      </section>
    </>
  );
}
function ProjectCard({
  project: p,
  reports,
  index,
  onCoverError,
}: {
  project: Project;
  reports: Report[];
  index: number;
  onCoverError: () => void;
}) {
  const [failedCover, setFailedCover] = useState("");
  const showCover = !!p.cover_url && p.cover_url !== failedCover;
  return (
    <Link href={`/reports?project=${p.id}`} className="project-card">
      <div className={`project-cover cover-${index % 3}`}>
        {showCover ? (
          <img
            className="project-cover-photo"
            src={p.cover_url}
            alt={`รูปโครงการ ${p.name}`}
            onError={() => {
              setFailedCover(p.cover_url ?? "");
              onCoverError();
            }}
          />
        ) : null}
        <div className="building-art" hidden={showCover}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className={`badge ${p.status === "completed" ? "neutral" : ""}`}>
          {p.status === "active" ? "กำลังดำเนินการ" : "เสร็จสิ้น"}
        </span>
        <span className="project-code">
          SITE / {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="project-body">
        <h3>{p.name}</h3>
        <p>
          <Building2 size={14} />
          {p.location || "ยังไม่ระบุสถานที่"}
        </p>
        <div className="project-meta">
          <span>
            <ClipboardList size={14} />
            {reports.length} รายงาน
          </span>
          <span className="project-arrow">
            <ArrowUpRight size={17} />
          </span>
        </div>
      </div>
    </Link>
  );
}
function Projects({
  data,
  workspace,
  canEdit,
  save,
  saveCover,
  onCoverError,
}: {
  data: Dataset;
  workspace: string;
  canEdit: boolean;
  save: (p: Project) => Promise<void>;
  saveCover: (p: Project, file: File | null) => Promise<void>;
  onCoverError: () => void;
}) {
  const [coverProject, setCoverProject] = useState<Project | null>(null);
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <PageHeading
        title="โครงการ"
        description="ติดตามทุกไซต์งานของทีมคุณ"
        action={
          canEdit && (
            <button className="button primary" onClick={() => setShow(!show)}>
              <Plus size={18} />
              {show ? "ปิดฟอร์ม" : "สร้างโครงการ"}
            </button>
          )
        }
      />
      {show && (
        <form
          className="panel form-grid mb-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            setBusy(true);
            try {
              await save({
                id: crypto.randomUUID(),
                workspace_id: workspace,
                name: String(f.get("name")).trim(),
                location: String(f.get("location")).trim(),
                client: String(f.get("client")).trim(),
                status: "active",
                created_at: new Date().toISOString(),
              });
              setShow(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            ชื่อโครงการ
            <input name="name" required maxLength={200} />
          </label>
          <label>
            สถานที่
            <input name="location" maxLength={300} />
          </label>
          <label>
            ลูกค้า / เจ้าของงาน
            <input name="client" maxLength={200} />
          </label>
          <div className="flex items-end">
            <button className="button primary" disabled={busy}>
              บันทึกโครงการ
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
      <div className="search-box">
        <Search size={18} />
        <input
          aria-label="ค้นหาโครงการ"
          placeholder="ค้นหาชื่อโครงการ สถานที่ หรือลูกค้า…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {canEdit && coverProject && (
        <ProjectCoverEditor
          key={coverProject.id}
          project={coverProject}
          onSave={saveCover}
          onCancel={() => setCoverProject(null)}
        />
      )}
      <div className="projects-page-grid">
        {data.projects
          .filter((p) => `${p.name} ${p.location} ${p.client}`.includes(query))
          .map((p, i) => (
            <div key={p.id}>
              <ProjectCard
                project={p}
                reports={data.reports.filter((r) => r.project_id === p.id)}
                index={i}
                onCoverError={onCoverError}
              />
              {canEdit && (
                <button
                  type="button"
                  className="button secondary project-cover-settings"
                  aria-label={`ตั้งค่ารูปโครงการ — ${p.name}`}
                  onClick={() => {
                    setCoverProject(p);
                    setError("");
                  }}
                >
                  ตั้งค่ารูปโครงการ
                </button>
              )}
              {canEdit && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await save({
                        ...p,
                        status: p.status === "active" ? "completed" : "active",
                      });
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "เปลี่ยนสถานะไม่สำเร็จ",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {p.status === "active"
                    ? "ทำเครื่องหมายว่าเสร็จสิ้น"
                    : "เปิดดำเนินการอีกครั้ง"}
                </button>
              )}
            </div>
          ))}
      </div>
      {!data.projects.length && (
        <Empty text="ยังไม่มีโครงการ กดสร้างโครงการเพื่อเริ่มต้น" />
      )}
      {!show && error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
function ReportList({ data, canEdit }: { data: Dataset; canEdit: boolean }) {
  const searchParams = useSearchParams();
  const [projectOverride, setProject] = useState<string | null>(null);
  const project = projectOverride ?? searchParams.get("project") ?? "";
  const [status, setStatus] = useState("");
  return (
    <>
      <PageHeading
        title="Daily Report"
        description="บันทึกความคืบหน้า ปัญหา และแผนงานในแต่ละวัน"
        action={
          canEdit && (
            <Link className="button primary" href="/reports/new">
              <Plus size={18} />
              สร้างรายงาน
            </Link>
          )
        }
      />
      <div className="filters">
        <label>
          โครงการ
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">ทุกโครงการ</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          สถานะ
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="draft">ฉบับร่าง</option>
            <option value="submitted">ส่งรายงานแล้ว</option>
            <option value="cancelled">ยกเลิกแล้ว</option>
          </select>
        </label>
      </div>
      <ReportTable
        data={{
          ...data,
          reports: data.reports.filter(
            (r) =>
              (!project || r.project_id === project) &&
              (!status || r.status === status),
          ),
        }}
      />
    </>
  );
}
function ReportTable({ data }: { data: Dataset }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>โครงการ / รายงาน</th>
            <th>วันที่รายงาน</th>
            <th>แรงงาน</th>
            <th>สถานะ</th>
            <th>
              <span className="sr-only">เปิดรายงาน</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.reports.map((r) => (
            <tr key={r.id}>
              <td>
                <Link className="report-title" href={`/reports/${r.id}`}>
                  <span className="report-icon">
                    <ClipboardList size={19} />
                  </span>
                  <span>
                    <b>
                      {data.projects.find((p) => p.id === r.project_id)?.name}
                    </b>
                    <small>
                      {r.work_done.slice(0, 55) || "ยังไม่มีรายละเอียด"}
                    </small>
                  </span>
                </Link>
              </td>
              <td>{thaiDate(r.report_date)}</td>
              <td>{r.workers} คน</td>
              <td>
                <span
                  className={`badge ${r.status === "draft" ? "draft" : ""}`}
                >
                  {documentStatus(r)}
                </span>
              </td>
              <td>
                <Link
                  aria-label={`เปิดรายงาน ${r.report_date}`}
                  href={`/reports/${r.id}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data.reports.length && <Empty text="ยังไม่มีรายงานในรายการนี้" />}
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <ClipboardList size={28} />
      <p>{text}</p>
    </div>
  );
}
