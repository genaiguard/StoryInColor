"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getFirestore, doc, getDoc } from "firebase/firestore";

interface ShareDoc {
  shareId: string;
  pendingToken: string;
  tierLabel: string | null;
  overallScore: number | null;
}

export default function SharedFaceReadingView() {
  const sp = useSearchParams();
  const id = sp.get("id");
  const { initialized } = useFirebase();
  const [shareDoc, setShareDoc] = useState<ShareDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!initialized || !id) {
      if (initialized && !id) {
        setErr("Missing share id.");
        setLoading(false);
      }
      return;
    }
    (async () => {
      try {
        const db = getFirestore();
        const ref = doc(db, "sharedFaceReadings", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setErr("This shared rating doesn't exist or was disabled.");
        } else {
          setShareDoc(snap.data() as ShareDoc);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [initialized, id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  }
  if (err || !shareDoc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-rose-300">{err || "Not found."}</p>
        <Link
          href="/face-rating"
          className="rounded-full bg-white px-6 py-3 text-sm text-black"
        >
          Get your own rating
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-5 py-16 text-center md:px-8">
        <p className="text-xs uppercase tracking-[0.18em] text-white/40">
          Shared face rating
        </p>
        <div className="mt-6 text-7xl font-light tracking-tight md:text-8xl">
          {shareDoc.overallScore != null
            ? shareDoc.overallScore.toFixed(1)
            : "—"}
          <span className="text-3xl text-white/40">/10</span>
        </div>
        {shareDoc.tierLabel && (
          <div className="mt-3 text-2xl font-light italic md:text-3xl">
            {shareDoc.tierLabel}
          </div>
        )}
        <p className="mt-8 text-sm text-white/65">
          Want your own honest face rating?
        </p>
        <Link
          href="/face-rating"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black hover:bg-white/90"
        >
          Get my rating — $4.99
        </Link>
        <p className="mt-12 text-[11px] text-white/30">
          For entertainment. Not a clinical assessment.
        </p>
      </div>
    </div>
  );
}
