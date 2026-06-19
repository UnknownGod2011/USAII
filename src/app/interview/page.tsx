"use client";

import { FounderInterview } from "@/components/FounderInterview";
import { Nav } from "@/components/Nav";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function InterviewContent() {
  const params = useSearchParams();
  return <FounderInterview initialMode={params.get("mode") === "voice" ? "voice" : "chat"} />;
}

export default function InterviewPage() {
  return <main className="shell-bg min-h-screen"><Nav /><Suspense><InterviewContent /></Suspense></main>;
}
