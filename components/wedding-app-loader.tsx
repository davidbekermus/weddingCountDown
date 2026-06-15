"use client";

import dynamic from "next/dynamic";

const WeddingApp = dynamic(() => import("./wedding-app"), {
  ssr: false,
  loading: () => <main className="loading-screen">Opening the vault...</main>,
});

export default function WeddingAppLoader({
  view = "home",
}: {
  view?: "home" | "gallery";
}) {
  return <WeddingApp view={view} />;
}
