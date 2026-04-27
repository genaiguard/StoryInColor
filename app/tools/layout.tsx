"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFirebase } from "@/app/firebase/firebase-provider";

export default function ToolsLayout({ children }: { children: ReactNode }) {
  const { user, loading, initialized } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (initialized && !loading && !user) {
      router.push("/login?register=true");
    }
  }, [user, loading, initialized, router]);

  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
