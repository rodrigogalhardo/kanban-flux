"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, FlaskConical, Zap } from "lucide-react";

interface PromptExperimentProps {
  cardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExperimentResult {
  id: string;
  promptA: string;
  promptB: string;
  resultA: string | null;
  resultB: string | null;
  tokensA: number | null;
  tokensB: number | null;
  winner: string | null;
  error?: string;
}

export function PromptExperiment({ cardId, open, onOpenChange }: PromptExperimentProps) {
  const [promptA, setPromptA] = useState("");
  const [promptB, setPromptB] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [pickingWinner, setPickingWinner] = useState(false);

  async function runExperiment() {
    if (!promptA.trim() || !promptB.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, promptA, promptB }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({
        id: "",
        promptA,
        promptB,
        resultA: "Error running experiment",
        resultB: "Error running experiment",
        tokensA: null,
        tokensB: null,
        winner: null,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function pickWinner(winner: "A" | "B") {
    if (!result?.id) return;
    setPickingWinner(true);
    try {
      const res = await fetch("/api/experiments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.id, winner }),
      });
      const data = await res.json();
      setResult({ ...result, winner: data.winner });
    } catch {
      // ignore
    } finally {
      setPickingWinner(false);
    }
  }

  function handleClose(val: boolean) {
    if (!val) {
      setResult(null);
      setPromptA("");
      setPromptB("");
    }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[800px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-600" />
            Prompt A/B Test
          </DialogTitle>
        </DialogHeader>

        {/* Input Phase */}
        {!result && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              Run the same card through two different system prompts and compare the outputs side by side.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">A</Badge>
                  System Prompt A
                </label>
                <Textarea
                  placeholder="You are a senior engineer who writes concise, production-ready code..."
                  value={promptA}
                  onChange={(e) => setPromptA(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">B</Badge>
                  System Prompt B
                </label>
                <Textarea
                  placeholder="You are a creative problem solver who explores multiple approaches..."
                  value={promptB}
                  onChange={(e) => setPromptB(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
              </div>
            </div>
            <Button
              onClick={runExperiment}
              disabled={loading || !promptA.trim() || !promptB.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running both prompts...
                </>
              ) : (
                <>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Run A/B Test
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results Phase */}
        {result && (
          <div className="space-y-4">
            {result.error && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Note: {result.error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Result A */}
              <div className={`space-y-2 rounded-lg border p-3 ${result.winner === "A" ? "border-green-400 bg-green-50" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">A</Badge>
                  <div className="flex items-center gap-2">
                    {result.tokensA != null && (
                      <span className="flex items-center gap-1 text-[11px] text-secondary">
                        <Zap className="h-3 w-3" />
                        {result.tokensA} tokens
                      </span>
                    )}
                    {result.winner === "A" && (
                      <Trophy className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto rounded bg-surface p-2 text-xs whitespace-pre-wrap">
                  {result.resultA || "No result"}
                </div>
                {!result.winner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => pickWinner("A")}
                    disabled={pickingWinner}
                  >
                    <Trophy className="mr-1 h-3 w-3" />
                    Pick A as Winner
                  </Button>
                )}
              </div>

              {/* Result B */}
              <div className={`space-y-2 rounded-lg border p-3 ${result.winner === "B" ? "border-green-400 bg-green-50" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">B</Badge>
                  <div className="flex items-center gap-2">
                    {result.tokensB != null && (
                      <span className="flex items-center gap-1 text-[11px] text-secondary">
                        <Zap className="h-3 w-3" />
                        {result.tokensB} tokens
                      </span>
                    )}
                    {result.winner === "B" && (
                      <Trophy className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto rounded bg-surface p-2 text-xs whitespace-pre-wrap">
                  {result.resultB || "No result"}
                </div>
                {!result.winner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => pickWinner("B")}
                    disabled={pickingWinner}
                  >
                    <Trophy className="mr-1 h-3 w-3" />
                    Pick B as Winner
                  </Button>
                )}
              </div>
            </div>

            {result.winner && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-sm font-medium text-green-700">
                  Winner: Prompt {result.winner}
                </p>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setPromptA("");
                setPromptB("");
              }}
              className="w-full"
            >
              Run Another Test
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
