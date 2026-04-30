"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, AlertTriangle } from "lucide-react";

import { useFirebase } from "@/app/firebase/firebase-provider";
import { getToolBySlug } from "@/lib/tools/registry";
import type { Tool } from "@/lib/tools/types";

interface SharedReading {
  shareId: string;
  toolId: string;
  imageUrl: string;
  createdBy: string;
  jobId: string;
}

function BrandHeader() {
  return (
    <header className="border-b border-white/5 bg-black/60 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link
          href="/"
          className="text-base font-semibold tracking-[-0.02em] sm:text-lg"
        >
          <span className="font-light">Story</span>
          <span className="font-semibold">In</span>
          <span className="font-light">Color</span>
        </Link>
        <Link
          href="/readings"
          className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
        >
          <Sparkles className="h-4 w-4" />
          Try it
        </Link>
      </div>
    </header>
  );
}

function NotFoundState() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <BrandHeader />
      <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-16 md:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-amber-300" />
          <h1 className="text-2xl font-normal tracking-[-0.02em]">
            Reading not found
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            This share link is invalid or has been removed.
          </p>
          <Link
            href="/readings"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            Get your own reading
          </Link>
        </div>
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <BrandHeader />
      <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-16 md:px-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </main>
    </div>
  );
}

// shareId format: 16 lowercase hex chars (crypto.randomBytes(8).toString('hex')).
// In the wild we've seen the query param polluted by share targets that
// concatenate text+url before handing it off (e.g. some messaging apps,
// some "copy link" UIs, some clipboard round-trips). Be tolerant: pull
// the leading hex run, ignore the rest.
const SHARE_ID_RE = /^[a-f0-9]{16}/;
function extractShareId(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.toLowerCase().match(SHARE_ID_RE);
  return match ? match[0] : null;
}

export default function ShareView() {
  const searchParams = useSearchParams();
  const shareId = extractShareId(searchParams?.get("id") ?? null);
  // FirebaseProvider initializes lazily inside its own useEffect, and child
  // effects run before parent effects in React — so we MUST wait for
  // `initialized` before calling getFirestore() or it throws "No Firebase
  // App '[DEFAULT]' has been created."
  const { initialized } = useFirebase();

  const [shared, setShared] = useState<SharedReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (!initialized) return; // wait for FirebaseProvider to finish init

    let cancelled = false;
    (async () => {
      try {
        // Lazy-load the Firestore SDK so this page (and its small
        // dependency footprint) doesn't bloat first paint of every other
        // route. /share is the public landing page for shared content
        // and is the most likely entry point from social previews.
        const { getFirestore, doc, getDoc } = await import(
          "firebase/firestore"
        );
        const db = getFirestore();
        const ref = doc(db, "sharedReadings", shareId);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        setShared(snap.data() as SharedReading);
      } catch (err) {
        // Network / permission failures look the same as missing to the
        // user; logging keeps the production diagnostic path intact.
        console.error("[share] failed to load shareId:", shareId, err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareId, initialized]);

  if (loading) return <LoadingState />;
  if (notFound || !shared) return <NotFoundState />;

  // Map server-stored toolId back to the marketing-side Tool object so we
  // can render the proper headline + CTA. If the tool was renamed since
  // the share was created, fall back to a generic label.
  const tool: Tool | undefined = getToolBySlug(shared.toolId);
  const toolName = tool?.name ?? "reading";
  const tryHref = tool ? `/readings/${tool.slug}` : "/readings";

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <BrandHeader />
      <main className="container mx-auto max-w-4xl flex-1 px-4 py-12 md:px-8 md:py-16">
        <div className="animate-blur-fade-up">
          <div className="mb-4 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
            <span className="h-px w-8 bg-white/20" aria-hidden="true" />
            Shared from StoryInColor
          </div>
          <h1 className="mb-8 text-center text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl">
            A {toolName.toLowerCase()}{" "}
            <span className="italic font-light text-gray-300">
              worth keeping.
            </span>
          </h1>
          <div className="liquid-glass overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shared.imageUrl}
              alt={`${toolName} from StoryInColor`}
              loading="eager"
              className="mx-auto block w-full object-contain"
            />
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-3">
            <p className="text-center text-sm text-gray-400">
              Made with StoryInColor — turn one photo into a magazine-quality
              reading.
            </p>
            <Link
              href={tryHref}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Sparkles className="h-4 w-4" />
              Get your own {tool ? toolName.toLowerCase() : "reading"}
            </Link>
            <Link
              href="/readings"
              className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
            >
              See all readings
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
