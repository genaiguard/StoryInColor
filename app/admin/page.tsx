"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CreditCard,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  User,
  Users,
  Wand2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getToolById } from "@/lib/tools/registry";

// --- Type Definitions (Matching Cloud Function Response) ---
// Field names mirror the server contract — `creditBalance` and
// `generationCount` are how the Cloud Function returns the data; the UI
// surfaces them as "Readings" since 1 credit == 1 reading.
interface AggregatedStats {
  totalUsers: number;
  totalRevenue: number; // dollars
  payingCustomers: number;
  totalUploads: number;
  completedGenerations: number;
  failedGenerations: number;
}

interface UserGenerationSummary {
  id: string;
  toolId: string;
  status: string;
  createdAt: string | null;
}

// Mirror of UserAttributionPayload + AttributionTouch in functions/src/index.ts.
// Kept in sync by hand because the two npm trees don't share modules.
interface AttributionTouch {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrer: string | null;
  landingPath: string;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  capturedAt: string;
}

interface UserAttributionPayload {
  firstTouch: AttributionTouch | null;
  lastTouch: AttributionTouch | null;
  anonId: string | null;
  gaClientId: string | null;
  fbp: string | null;
  fbc: string | null;
  clarityCustomId: string | null;
}

interface EnrichedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  disabled: boolean;
  deleted: boolean;
  creditBalance: number;
  totalSpent: number;
  generationCount: number;
  failedGenerationCount: number;
  latestGenerationCreatedAt: string | null;
  generations: UserGenerationSummary[];
  attribution: UserAttributionPayload | null;
}

interface SourceFunnelRow {
  source: string;
  signups: number;
  activatedUsers: number;
  payingCustomers: number;
  revenue: number;
  completedReadings: number;
}

interface AdminDashboardData {
  success: boolean;
  aggregatedStats?: AggregatedStats;
  users?: EnrichedUser[];
  sourceBreakdown?: SourceFunnelRow[];
  message?: string;
  error?: string;
}

// Source of truth for admin authorization is the `admin: true` Firebase
// Auth custom claim. firestore.rules / storage.rules /
// functions/src/index.ts:getAdminDashboardData all check
// `request.auth.token.admin == true`. This client-side array is purely
// a UX hint for the SPA gate so we don't have to await a token-claims
// fetch on every dashboard mount — the server is what actually enforces
// auth. To rotate: setCustomUserClaims(newUid, {admin:true}) via Admin
// SDK, then update this array. No rule/function redeploy needed.
const ADMIN_EMAILS = ["ipekcioglu@me.com"];

type SortKey =
  | "userCreatedAt"
  | "lastGenerationCreatedAt"
  | "email"
  | "totalSpent";
type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Small reusable shells
// ---------------------------------------------------------------------------

function PageHeader({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="liquid-glass inline-flex h-10 w-10 items-center justify-center rounded-full"
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
        <Link
          href="/"
          className="text-base font-semibold tracking-[-0.02em] text-white sm:text-lg"
        >
          <span className="font-light">Story</span>
          <span className="font-semibold">In</span>
          <span className="font-light">Color</span>
        </Link>
      </div>
    </header>
  );
}

function CenteredState({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <PageHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="liquid-glass mx-auto max-w-md rounded-2xl p-8 text-center">
          <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            {icon}
          </span>
          <h2 className="text-2xl font-normal tracking-[-0.02em]">{title}</h2>
          <p className="mt-2 text-sm text-gray-400">{body}</p>
          {cta && (
            <Link
              href={cta.href}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              {cta.label}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <PageHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-white" />
          <p className="text-sm text-gray-400">{label}</p>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceFunnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyUsersWithReadings, setShowOnlyUsersWithReadings] =
    useState(false);
  const [showOnlyPaidUsers, setShowOnlyPaidUsers] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("userCreatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [refreshKey, setRefreshKey] = useState(0);

  const { user, initialized } = useFirebase() ?? {
    user: null,
    initialized: false,
  };
  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email || "");

  useEffect(() => {
    if (!initialized || !user || !isAdmin) {
      if (initialized && user && !isAdmin) {
        setError("You don't have permission to access this page.");
      }
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadAdminData = async () => {
      setLoading(true);
      setError("");

      try {
        const functions = getFunctions();
        const fn = httpsCallable<unknown, AdminDashboardData>(
          functions,
          "getAdminDashboardData",
        );
        const result = await fn();
        const data = result.data;

        if (cancelled) return;

        if (data.success && data.aggregatedStats && data.users) {
          setStats(data.aggregatedStats);
          setUsers(data.users);
          setSourceBreakdown(data.sourceBreakdown ?? []);
        } else {
          setError(
            data.message ||
              data.error ||
              "Failed to load admin dashboard data.",
          );
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          `An error occurred: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAdminData();
    return () => {
      cancelled = true;
    };
  }, [initialized, user, isAdmin, refreshKey]);

  // Distinct first-touch sources observed across all users — used to populate
  // the Source filter dropdown. "(unknown)" lumps users with no attribution
  // record together so legacy users don't disappear when the admin filters.
  const availableSources = useMemo(() => {
    const seen = new Set<string>();
    for (const u of users) {
      const s = u.attribution?.firstTouch?.source;
      seen.add(s && s.length > 0 ? s : "(unknown)");
    }
    return Array.from(seen).sort();
  }, [users]);

  const processedUsers = useMemo(() => {
    let processed = users;

    if (showOnlyUsersWithReadings) {
      processed = processed.filter((u) => u.generationCount > 0);
    }
    if (showOnlyPaidUsers) {
      processed = processed.filter((u) => u.totalSpent > 0);
    }
    if (sourceFilter !== "all") {
      processed = processed.filter((u) => {
        const src = u.attribution?.firstTouch?.source;
        const labeled = src && src.length > 0 ? src : "(unknown)";
        return labeled === sourceFilter;
      });
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      processed = processed.filter(
        (u) =>
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.displayName && u.displayName.toLowerCase().includes(q)) ||
          u.id.toLowerCase().includes(q) ||
          // Search also matches first-touch / last-touch source + campaign so
          // typing "facebook" or "summer-launch" narrows the user list.
          (u.attribution?.firstTouch?.source ?? "").toLowerCase().includes(q) ||
          (u.attribution?.firstTouch?.campaign ?? "").toLowerCase().includes(q) ||
          (u.attribution?.lastTouch?.source ?? "").toLowerCase().includes(q) ||
          (u.attribution?.lastTouch?.campaign ?? "").toLowerCase().includes(q) ||
          u.generations.some(
            (g) =>
              g.id.toLowerCase().includes(q) ||
              g.toolId.toLowerCase().includes(q) ||
              g.status.toLowerCase().includes(q),
          ),
      );
    }

    processed.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "userCreatedAt":
          cmp =
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime();
          break;
        case "lastGenerationCreatedAt": {
          const da = a.latestGenerationCreatedAt
            ? new Date(a.latestGenerationCreatedAt).getTime()
            : 0;
          const db = b.latestGenerationCreatedAt
            ? new Date(b.latestGenerationCreatedAt).getTime()
            : 0;
          cmp = da - db;
          break;
        }
        case "email":
          cmp = (a.email || "").localeCompare(b.email || "");
          break;
        case "totalSpent":
          cmp = a.totalSpent - b.totalSpent;
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return processed;
  }, [
    users,
    showOnlyUsersWithReadings,
    showOnlyPaidUsers,
    sourceFilter,
    searchTerm,
    sortBy,
    sortDirection,
  ]);

  if (loading && (!initialized || !user || !isAdmin)) {
    return <FullScreenSpinner label="Loading…" />;
  }
  if (loading) {
    return <FullScreenSpinner label="Loading admin dashboard…" />;
  }
  if (initialized && user && !isAdmin) {
    return (
      <CenteredState
        icon={<AlertCircle className="h-6 w-6 text-red-300" />}
        title="Access denied"
        body="You don't have permission to access this page."
        cta={{ label: "Return to dashboard", href: "/dashboard" }}
      />
    );
  }
  if (initialized && !user) {
    return (
      <CenteredState
        icon={<AlertCircle className="h-6 w-6 text-amber-300" />}
        title="Not signed in"
        body="Please sign in to access the admin dashboard."
        cta={{ label: "Sign in", href: "/login" }}
      />
    );
  }

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <PageHeader onRefresh={refresh} />

      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="container mx-auto max-w-7xl">
          {/* Title row */}
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
                <span
                  className="h-px w-8 bg-white/20"
                  aria-hidden="true"
                />
                Admin
              </div>
              <h1
                className="text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl"
              >
                Operator{" "}
                <span className="italic font-light text-gray-400">
                  console.
                </span>
              </h1>
              <p className="mt-3 text-base text-gray-400 md:text-lg">
                Users, readings, and revenue at a glance.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                placeholder="Search users or readings…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-white placeholder-gray-500 transition-colors focus:border-white/30 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
              <div>
                <p className="font-medium">Error loading data</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Aggregated KPI tiles */}
          {stats && (
            <div className="mb-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <StatCard
                label="Total users"
                value={stats.totalUsers.toLocaleString()}
                icon={Users}
              />
              <StatCard
                label="Paying customers"
                value={stats.payingCustomers.toLocaleString()}
                icon={CreditCard}
              />
              <StatCard
                label="Total revenue"
                value={`$${stats.totalRevenue.toFixed(2)}`}
                icon={DollarSign}
              />
              <StatCard
                label="Photos uploaded"
                value={stats.totalUploads.toLocaleString()}
                icon={ImageIcon}
              />
              <StatCard
                label="Readings completed"
                value={stats.completedGenerations.toLocaleString()}
                icon={Wand2}
              />
              <StatCard
                label="Readings failed"
                value={stats.failedGenerations.toLocaleString()}
                icon={AlertCircle}
              />
            </div>
          )}

          {/* Per-source funnel breakdown — derived server-side from
              users[].attribution.firstTouch.source. Hidden until at least
              one user with attribution data exists (legacy-only state). */}
          {sourceBreakdown.length > 0 && (
            <SourceBreakdownTable rows={sourceBreakdown} />
          )}

          {/* Filters + sort */}
          <div className="liquid-glass mb-8 rounded-2xl p-6 md:p-7">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
                  Filters
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <FilterChip
                    on={showOnlyUsersWithReadings}
                    onClick={() =>
                      setShowOnlyUsersWithReadings((v) => !v)
                    }
                    label="Has readings"
                  />
                  <FilterChip
                    on={showOnlyPaidUsers}
                    onClick={() => setShowOnlyPaidUsers((v) => !v)}
                    label="Paying users"
                  />
                  <Select
                    value={sourceFilter}
                    onValueChange={(v) => setSourceFilter(v)}
                  >
                    <SelectTrigger className="h-9 w-[200px] rounded-full border-white/10 bg-white/[0.04] text-sm text-white">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-black text-white">
                      <SelectItem value="all">All sources</SelectItem>
                      {availableSources.map((src) => (
                        <SelectItem key={src} value={src}>
                          {src}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
                  Sort
                </h2>
                <div className="flex items-center gap-2">
                  <Select
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as SortKey)}
                  >
                    <SelectTrigger className="w-[220px] rounded-full border-white/10 bg-white/[0.04] text-sm text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-black text-white">
                      <SelectItem value="userCreatedAt">
                        Signup date
                      </SelectItem>
                      <SelectItem value="lastGenerationCreatedAt">
                        Latest reading
                      </SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="totalSpent">Total spent</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() =>
                      setSortDirection((p) =>
                        p === "asc" ? "desc" : "asc",
                      )
                    }
                    className="liquid-glass inline-flex h-10 w-10 items-center justify-center rounded-full"
                    aria-label={`Sort ${
                      sortDirection === "asc" ? "ascending" : "descending"
                    }`}
                    title={`Sort ${
                      sortDirection === "asc" ? "ascending" : "descending"
                    }`}
                  >
                    {sortDirection === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Users list */}
          {processedUsers.length > 0 ? (
            <div className="space-y-5">
              {processedUsers.map((u) => (
                <UserDetailCard key={u.id} userData={u} />
              ))}
            </div>
          ) : (
            <div className="liquid-glass rounded-2xl p-10 text-center">
              <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <User className="h-5 w-5 text-gray-300" />
              </span>
              <h3 className="text-lg font-medium text-white">
                No users found
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                {searchTerm
                  ? "No users match your search criteria."
                  : "No users have been created yet."}
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 bg-black">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Story In Color. Admin console.
          </p>
          <p className="text-xs text-gray-500">
            Read-only — actions disabled in this view.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="liquid-glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div
        className="mt-3 text-2xl font-normal text-white sm:text-3xl"
        style={{ letterSpacing: "-0.03em" }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
        on ? "bg-white text-black" : "liquid-glass text-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "neutral" | "warn" | "danger" | "good";
  label: string;
}) {
  const cls = {
    neutral: "border-white/10 bg-white/[0.04] text-gray-200",
    warn: "border-amber-500/30 bg-amber-500/[0.08] text-amber-200",
    danger: "border-red-500/30 bg-red-500/[0.08] text-red-200",
    good: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function GenerationStatusBadge({ status }: { status: string }) {
  const tone =
    status === "complete"
      ? "good"
      : status === "failed"
        ? "danger"
        : status === "processing"
          ? "warn"
          : "neutral";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <StatusPill tone={tone} label={label} />;
}

function UserDetailCard({ userData }: { userData: EnrichedUser }) {
  const dimmed = userData.disabled || userData.deleted;
  const balanceLabel =
    userData.creditBalance === 1
      ? "1 reading"
      : `${userData.creditBalance} readings`;

  return (
    <div
      className={`liquid-glass overflow-hidden rounded-2xl ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      {/* Header */}
      <div className="border-b border-white/5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/5">
              <User className="h-5 w-5 text-gray-300" />
            </div>
            <div className="min-w-0">
              <h3
                className="truncate text-base font-medium text-white md:text-lg"
                title={userData.email || userData.id}
              >
                {userData.email || "No email"}
              </h3>
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {userData.displayName ? (
                  <span title={userData.displayName}>
                    {userData.displayName} ·{" "}
                  </span>
                ) : null}
                <span title={userData.id} className="font-mono">
                  {userData.id.slice(0, 12)}…
                </span>
                <span> · Joined {formatDate(userData.createdAt)}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {userData.deleted && <StatusPill tone="danger" label="Deleted" />}
            {userData.disabled && (
              <StatusPill tone="warn" label="Disabled" />
            )}
            <StatusPill
              tone="neutral"
              label={`${userData.generationCount} reading${userData.generationCount === 1 ? "" : "s"}`}
            />
            {userData.failedGenerationCount > 0 && (
              <StatusPill
                tone="warn"
                label={`${userData.failedGenerationCount} failed`}
              />
            )}
            <StatusPill
              tone="good"
              label={`$${userData.totalSpent.toFixed(2)} spent`}
            />
            <StatusPill tone="neutral" label={balanceLabel} />
          </div>
        </div>
      </div>

      {/* Attribution — first-touch + last-touch + linked tracker IDs.
          Hidden when the user has no attribution record at all (legacy
          accounts created before capture was deployed). */}
      {userData.attribution &&
        (userData.attribution.firstTouch ||
          userData.attribution.lastTouch ||
          userData.attribution.gaClientId ||
          userData.attribution.fbp) && (
          <div className="border-b border-white/5 p-5">
            <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              Attribution
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              <AttributionTouchBlock
                label="First touch"
                touch={userData.attribution.firstTouch}
              />
              <AttributionTouchBlock
                label="Last touch"
                touch={userData.attribution.lastTouch}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
              {userData.attribution.gaClientId && (
                <span title="GA4 client_id (from _ga cookie)">
                  GA: <span className="font-mono">{userData.attribution.gaClientId}</span>
                </span>
              )}
              {userData.attribution.fbp && (
                <span title="Meta browser id (_fbp cookie)">
                  fbp: <span className="font-mono">{userData.attribution.fbp.slice(0, 24)}…</span>
                </span>
              )}
              {userData.attribution.clarityCustomId && (
                <span title="Clarity custom-id (we send the Firebase UID; Clarity hashes server-side)">
                  Clarity: <span className="font-mono">{userData.attribution.clarityCustomId.slice(0, 12)}…</span>
                </span>
              )}
              {userData.attribution.anonId && (
                <span title="Pre-auth anon-id stored in localStorage / cookie">
                  anon: <span className="font-mono">{userData.attribution.anonId.slice(0, 8)}…</span>
                </span>
              )}
            </div>
          </div>
        )}

      {/* Recent readings */}
      <div className="p-5">
        <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
          Recent readings
          {userData.generations.length > 0
            ? ` · showing ${userData.generations.length}`
            : ""}
        </h4>
        {userData.generations.length > 0 ? (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            {userData.generations.map((g) => {
              const tool = getToolById(g.toolId);
              const toolName = tool?.name ?? g.toolId;
              return (
                <li
                  key={g.id}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {toolName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      <span className="font-mono">{g.id.slice(0, 8)}…</span>
                      {g.createdAt
                        ? ` · ${formatDateTime(g.createdAt)}`
                        : ""}
                    </p>
                  </div>
                  <GenerationStatusBadge status={g.status} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-500">
            No readings yet.
          </p>
        )}
      </div>
    </div>
  );
}

function SourceBreakdownTable({ rows }: { rows: SourceFunnelRow[] }) {
  // Derive a totals row so the percentages are easy to sanity-check.
  const totals = rows.reduce(
    (acc, r) => ({
      signups: acc.signups + r.signups,
      activatedUsers: acc.activatedUsers + r.activatedUsers,
      payingCustomers: acc.payingCustomers + r.payingCustomers,
      revenue: acc.revenue + r.revenue,
      completedReadings: acc.completedReadings + r.completedReadings,
    }),
    { signups: 0, activatedUsers: 0, payingCustomers: 0, revenue: 0, completedReadings: 0 },
  );
  return (
    <div className="liquid-glass mb-8 overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/5 p-5 md:p-6">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
            Funnel by source
          </h2>
          <p className="mt-2 text-base text-white">
            First-touch attribution rolled up across all signups.
          </p>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
          {rows.length} sources
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <th className="px-5 py-3 md:px-6">Source</th>
              <th className="px-3 py-3 text-right">Signups</th>
              <th className="px-3 py-3 text-right">Activated</th>
              <th className="px-3 py-3 text-right">Paying</th>
              <th className="px-3 py-3 text-right">Revenue</th>
              <th className="px-3 py-3 text-right">Conv. rate</th>
              <th className="px-3 py-3 text-right">Activation</th>
              <th className="px-3 py-3 text-right md:px-6">Readings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => {
              const convRate =
                r.signups > 0 ? (r.payingCustomers / r.signups) * 100 : 0;
              const actRate =
                r.signups > 0 ? (r.activatedUsers / r.signups) * 100 : 0;
              return (
                <tr key={r.source} className="text-gray-200">
                  <td className="px-5 py-3 font-medium text-white md:px-6">
                    {r.source}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.signups.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.activatedUsers.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.payingCustomers.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    ${r.revenue.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-300">
                    {convRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-200">
                    {actRate.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums md:px-6">
                    {r.completedReadings.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10 text-sm font-medium text-gray-300">
              <td className="px-5 py-3 md:px-6">All sources</td>
              <td className="px-3 py-3 text-right tabular-nums">
                {totals.signups.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {totals.activatedUsers.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {totals.payingCustomers.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                ${totals.revenue.toFixed(2)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {totals.signups > 0
                  ? ((totals.payingCustomers / totals.signups) * 100).toFixed(1)
                  : "0.0"}
                %
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {totals.signups > 0
                  ? ((totals.activatedUsers / totals.signups) * 100).toFixed(1)
                  : "0.0"}
                %
              </td>
              <td className="px-3 py-3 text-right tabular-nums md:px-6">
                {totals.completedReadings.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function AttributionTouchBlock({
  label,
  touch,
}: {
  label: string;
  touch: AttributionTouch | null;
}) {
  if (!touch) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-gray-500">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
          {label}
        </div>
        <p className="text-gray-500">— no record —</p>
      </div>
    );
  }
  const detailRows: Array<[string, string | null]> = [
    ["medium", touch.medium],
    ["campaign", touch.campaign],
    ["term", touch.term],
    ["content", touch.content],
    ["referrer", touch.referrer],
    ["landing", touch.landingPath],
  ];
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
        <span>{label}</span>
        <span>{formatDateTime(touch.capturedAt)}</span>
      </div>
      <p className="text-sm font-medium text-white">
        {touch.source ?? "—"}
      </p>
      <dl className="mt-1.5 space-y-0.5 text-[11px] text-gray-400">
        {detailRows
          .filter(([, v]) => v && v.length > 0)
          .map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-16 flex-shrink-0 text-gray-500">{k}</dt>
              <dd className="truncate" title={v ?? ""}>
                {v}
              </dd>
            </div>
          ))}
        {(touch.gclid || touch.fbclid || touch.msclkid) && (
          <div className="flex gap-2">
            <dt className="w-16 flex-shrink-0 text-gray-500">click-id</dt>
            <dd className="truncate font-mono">
              {touch.gclid
                ? `gclid:${touch.gclid.slice(0, 18)}…`
                : touch.fbclid
                  ? `fbclid:${touch.fbclid.slice(0, 18)}…`
                  : `msclkid:${touch.msclkid?.slice(0, 18)}…`}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
