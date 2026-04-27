"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/tools/coloring-book");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
    </div>
  );
}
