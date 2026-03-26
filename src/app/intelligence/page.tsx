"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, RefreshCw, Network, GitBranch, Zap, FileText, Loader2, Clock, TrendingUp, BarChart3 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface Project {
  id: string;
  name: string;
}

interface ReportSection {
  title: string;
  content: string;
}

interface ReportData {
  sections: ReportSection[];
  generatedAt: string;
}

interface TimelineData {
  totalCards: number;
  doneCards: number;
  inProgressCards: number;
  todoCards: number;
  remainingCards: number;
  completionRate: number;
  avgRunTimeSeconds: number;
  parallelism: number;
  estimatedCompletionDate: string;
  estimatedDaysRemaining: number;
  velocityPerDay: number;
  cardsByColumn: Record<string, number>;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  // layout fields (mutable)
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  weight: number;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const NODE_COLORS: Record<string, string> = {
  task: "#3b82f6",
  agent: "#22c55e",
  label: "#a855f7",
  code_module: "#f59e0b",
  milestone: "#ef4444",
  dependency: "#6b7280",
};

const NODE_RADIUS: Record<string, number> = {
  task: 20,
  agent: 24,
  label: 16,
  code_module: 18,
  milestone: 22,
  dependency: 14,
};

/* -------------------------------------------------------------------------- */
/*  Force simulation (simple spring model)                                    */
/* -------------------------------------------------------------------------- */

function initPositions(nodes: GraphNode[], w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(w, h) * 0.3;
    n.x = cx + r * Math.cos(angle) + (Math.random() - 0.5) * 40;
    n.y = cy + r * Math.sin(angle) + (Math.random() - 0.5) * 40;
    n.vx = 0;
    n.vy = 0;
  });
}

function simulationStep(
  nodes: GraphNode[],
  edges: GraphEdge[],
  w: number,
  h: number
) {
  const REPULSION = 3000;
  const ATTRACTION = 0.005;
  const DAMPING = 0.85;
  const CENTER_GRAVITY = 0.01;
  const cx = w / 2;
  const cy = h / 2;

  // Repulsion between every pair of nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy) || 1);
      const force = REPULSION / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  // Attraction along edges
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const s = nodeMap.get(edge.sourceId);
    const t = nodeMap.get(edge.targetId);
    if (!s || !t) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = dist * ATTRACTION * edge.weight;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    s.vx += fx;
    s.vy += fy;
    t.vx -= fx;
    t.vy -= fy;
  }

  // Center gravity + update positions
  for (const n of nodes) {
    n.vx += (cx - n.x) * CENTER_GRAVITY;
    n.vy += (cy - n.y) * CENTER_GRAVITY;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    // Keep nodes within bounds with padding
    n.x = Math.max(30, Math.min(w - 30, n.x));
    n.y = Math.max(30, Math.min(h - 30, n.y));
  }
}

/* -------------------------------------------------------------------------- */
/*  Graph Visualization Component                                             */
/* -------------------------------------------------------------------------- */

function GraphVisualization({
  nodes: rawNodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animFrameRef = useRef<number>(0);
  const [, forceRender] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    node: GraphNode | null;
    offset: { x: number; y: number };
  }>({ node: null, offset: { x: 0, y: 0 } });

  const WIDTH = 900;
  const HEIGHT = 560;

  // Initialize nodes
  useEffect(() => {
    const mapped: GraphNode[] = rawNodes.map((n) => ({
      ...n,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    }));
    initPositions(mapped, WIDTH, HEIGHT);

    // Run initial warm-up iterations
    for (let i = 0; i < 80; i++) {
      simulationStep(mapped, edges, WIDTH, HEIGHT);
    }

    nodesRef.current = mapped;
    forceRender((v) => v + 1);

    // Continuous animation for smooth layout
    let running = true;
    const animate = () => {
      if (!running) return;
      simulationStep(nodesRef.current, edges, WIDTH, HEIGHT);
      forceRender((v) => v + 1);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [rawNodes, edges]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, node: GraphNode) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      dragRef.current = {
        node,
        offset: {
          x: e.clientX - rect.left - node.x,
          y: e.clientY - rect.top - node.y,
        },
      };
    },
    []
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    if (dragRef.current.node) {
      const n = dragRef.current.node;
      n.x = e.clientX - rect.left - dragRef.current.offset.x;
      n.y = e.clientY - rect.top - dragRef.current.offset.y;
      n.vx = 0;
      n.vy = 0;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.node = null;
  }, []);

  const currentNodes = nodesRef.current;
  const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={WIDTH}
        height={HEIGHT}
        className="rounded-lg border border-gray-200 bg-gray-50"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Marker for arrowheads */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const src = nodeMap.get(edge.sourceId);
          const tgt = nodeMap.get(edge.targetId);
          if (!src || !tgt) return null;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const tgtRadius = NODE_RADIUS[tgt.type] || 18;
          const endX = tgt.x - (dx / dist) * (tgtRadius + 8);
          const endY = tgt.y - (dy / dist) * (tgtRadius + 8);
          return (
            <g key={edge.id}>
              <line
                x1={src.x}
                y1={src.y}
                x2={endX}
                y2={endY}
                stroke="#94a3b8"
                strokeWidth={Math.max(1, edge.weight)}
                strokeOpacity={0.6}
                markerEnd="url(#arrowhead)"
              />
              {/* Edge label at midpoint */}
              <text
                x={(src.x + tgt.x) / 2}
                y={(src.y + tgt.y) / 2 - 6}
                textAnchor="middle"
                fill="#64748b"
                fontSize={9}
                fontFamily="sans-serif"
              >
                {edge.relation}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {currentNodes.map((node) => {
          const r = NODE_RADIUS[node.type] || 18;
          const color = NODE_COLORS[node.type] || "#6b7280";
          return (
            <g
              key={node.id}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => handleMouseDown(e, node)}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Glow on hover */}
              {hoveredNode?.id === node.id && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 6}
                  fill={color}
                  opacity={0.2}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={color}
                stroke="white"
                strokeWidth={2}
                opacity={0.9}
              />
              {/* Type icon letter */}
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={10}
                fontWeight="bold"
                fontFamily="sans-serif"
                style={{ pointerEvents: "none" }}
              >
                {node.type === "task"
                  ? "T"
                  : node.type === "agent"
                  ? "A"
                  : node.type === "label"
                  ? "L"
                  : node.type[0].toUpperCase()}
              </text>
              {/* Name label below */}
              <text
                x={node.x}
                y={node.y + r + 14}
                textAnchor="middle"
                fill="#334155"
                fontSize={10}
                fontFamily="sans-serif"
                style={{ pointerEvents: "none" }}
              >
                {node.name.length > 18
                  ? node.name.slice(0, 16) + "..."
                  : node.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-50 max-w-xs rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
          style={{
            left: Math.min(mousePos.x + 16, WIDTH - 200),
            top: Math.min(mousePos.y + 16, HEIGHT - 80),
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: NODE_COLORS[hoveredNode.type] || "#6b7280",
              }}
            />
            <span className="text-sm font-semibold text-neutral-900">
              {hoveredNode.name}
            </span>
          </div>
          <div className="text-xs text-secondary">
            Type: {hoveredNode.type}
          </div>
          {hoveredNode.summary && (
            <div className="mt-1 text-xs text-secondary line-clamp-2">
              {hoveredNode.summary}
            </div>
          )}
          {hoveredNode.metadata ? (() => {
            const meta = hoveredNode.metadata as Record<string, unknown>;
            return (
              <div className="mt-1 space-y-0.5">
                {meta.columnTitle ? (
                  <div className="text-xs text-secondary">
                    Column: {String(meta.columnTitle)}
                  </div>
                ) : null}
                {meta.boardName ? (
                  <div className="text-xs text-secondary">
                    Board: {String(meta.boardName)}
                  </div>
                ) : null}
              </div>
            );
          })() : null}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs capitalize text-secondary">{type.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page Component                                                            */
/* -------------------------------------------------------------------------- */

export default function IntelligencePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  } | null>(null);
  const [building, setBuilding] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [stats, setStats] = useState<{
    nodeCount: number;
    edgeCount: number;
  } | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Load projects
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        const list = (data || []).map(
          (p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          })
        );
        setProjects(list);
        if (list.length > 0) setSelectedProjectId(list[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  // Fetch graph when project changes
  const fetchGraph = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoadingGraph(true);
    try {
      const res = await fetch(
        `/api/intelligence/graph?projectId=${encodeURIComponent(pid)}`
      );
      const data = await res.json();
      setGraphData(data);
      setStats({
        nodeCount: data.nodes?.length || 0,
        edgeCount: data.edges?.length || 0,
      });
    } catch {
      setGraphData(null);
      setStats(null);
    } finally {
      setLoadingGraph(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) fetchGraph(selectedProjectId);
  }, [selectedProjectId, fetchGraph]);

  // Fetch timeline when project changes
  const fetchTimeline = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoadingTimeline(true);
    try {
      const res = await fetch(`/api/intelligence/timeline?projectId=${encodeURIComponent(pid)}`);
      const data = await res.json();
      if (data && data.totalCards !== undefined) {
        setTimeline(data);
      } else {
        setTimeline(null);
      }
    } catch {
      setTimeline(null);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) fetchTimeline(selectedProjectId);
  }, [selectedProjectId, fetchTimeline]);

  async function handleBuildGraph() {
    if (!selectedProjectId) return;
    setBuilding(true);
    try {
      const res = await fetch("/api/intelligence/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const result = await res.json();
      setStats({ nodeCount: result.nodeCount, edgeCount: result.edgeCount });
      // Refetch the graph data
      await fetchGraph(selectedProjectId);
    } catch {
      // silent
    } finally {
      setBuilding(false);
    }
  }

  async function handleGenerateReport() {
    if (!selectedProjectId) return;
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/intelligence/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const data = await res.json();
      setReport(data);
    } catch {
      // silent
    } finally {
      setGeneratingReport(false);
    }
  }

  const hasGraph =
    graphData && graphData.nodes.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
              <Brain className="h-7 w-7 text-primary" />
              Intelligence
            </h1>
            <p className="text-secondary">
              Knowledge Graph Engine -- visualize project structure and
              relationships
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-64">
            <Select
              value={selectedProjectId}
              onValueChange={(val) => { if (val) setSelectedProjectId(val); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleBuildGraph}
            disabled={building || !selectedProjectId}
            className="bg-primary hover:bg-primary-600"
          >
            {building ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            {building ? "Building..." : "Build Graph"}
          </Button>

          <Button
            onClick={handleGenerateReport}
            disabled={generatingReport || !selectedProjectId}
            variant="outline"
          >
            {generatingReport ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {generatingReport ? "Generating..." : "Generate Report"}
          </Button>

          {stats && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <Network className="h-3 w-3" />
                {stats.nodeCount} nodes
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <GitBranch className="h-3 w-3" />
                {stats.edgeCount} edges
              </Badge>
            </div>
          )}
        </div>

        {/* Graph Visualization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-5 w-5 text-primary" />
              Knowledge Graph
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingGraph ? (
              <div className="flex h-[560px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <span className="text-sm text-secondary">
                    Loading graph...
                  </span>
                </div>
              </div>
            ) : hasGraph ? (
              <GraphVisualization
                nodes={graphData.nodes}
                edges={graphData.edges}
              />
            ) : (
              <div className="flex h-[560px] flex-col items-center justify-center gap-4 text-secondary">
                <Network className="h-16 w-16 text-gray-300" />
                <div className="text-center">
                  <p className="text-lg font-medium text-neutral-900">
                    No graph data yet
                  </p>
                  <p className="mt-1 text-sm">
                    Select a project and click &quot;Build Graph&quot; to
                    generate the knowledge graph from your board data.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {hasGraph && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <div className="h-4 w-4 rounded-full bg-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-neutral-900">
                      {
                        graphData.nodes.filter((n) => n.type === "task")
                          .length
                      }
                    </p>
                    <p className="text-xs text-secondary">Task Nodes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <div className="h-4 w-4 rounded-full bg-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-neutral-900">
                      {
                        graphData.nodes.filter((n) => n.type === "agent")
                          .length
                      }
                    </p>
                    <p className="text-xs text-secondary">Agent Nodes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <div className="h-4 w-4 rounded-full bg-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-neutral-900">
                      {
                        graphData.nodes.filter((n) => n.type === "label")
                          .length
                      }
                    </p>
                    <p className="text-xs text-secondary">Label Nodes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Timeline Prediction */}
        {(timeline || loadingTimeline) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Timeline Prediction
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTimeline ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <span className="ml-3 text-sm text-secondary">Calculating timeline...</span>
                </div>
              ) : timeline ? (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-neutral-900">
                        Project Progress
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {timeline.completionRate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-primary h-3 rounded-full transition-all"
                        style={{ width: `${timeline.completionRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-secondary">
                      <span>{timeline.doneCards} done</span>
                      <span>{timeline.inProgressCards} in progress</span>
                      <span>{timeline.todoCards} to do</span>
                      <span>{timeline.totalCards} total</span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-secondary">Est. Completion</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {new Date(timeline.estimatedCompletionDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-secondary">
                        {timeline.estimatedDaysRemaining} days remaining
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-secondary">Velocity</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {timeline.velocityPerDay} cards/day
                      </p>
                      <p className="text-xs text-secondary">
                        Last 7 days
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-secondary">Avg Run Time</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {timeline.avgRunTimeSeconds}s
                      </p>
                      <p className="text-xs text-secondary">
                        Per card
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-purple-500" />
                        <span className="text-xs text-secondary">Parallelism</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {timeline.parallelism}x
                      </p>
                      <p className="text-xs text-secondary">
                        Concurrent agents
                      </p>
                    </div>
                  </div>

                  {/* Cards by column breakdown */}
                  {Object.keys(timeline.cardsByColumn).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-neutral-900 mb-2">Cards by Column</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(timeline.cardsByColumn).map(([col, count]) => (
                          <Badge key={col} variant="secondary" className="text-xs">
                            {col}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Report Section */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Intelligence Report
                <span className="ml-auto text-xs font-normal text-secondary">
                  Generated {new Date(report.generatedAt).toLocaleString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {report.sections.map((section, idx) => (
                  <Card key={idx} className={section.title.toLowerCase().includes("executive") ? "md:col-span-2" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none text-secondary whitespace-pre-line">
                        {section.content}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
