"use client";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">Something went wrong</h2>
      <p className="text-sm text-secondary">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
