import type { LucideIcon } from "lucide-react";

export type ClusterNode = {
  icon: LucideIcon;
  x: number;
  y: number;
  accent?: boolean;
  center?: boolean;
};

type IconClusterProps = {
  nodes: ClusterNode[];
  connections?: [number, number][];
  className?: string;
};

export function IconCluster({ nodes, connections, className = "" }: IconClusterProps) {
  const edges =
    connections ??
    nodes.map((_, index) => [0, index] as [number, number]).filter(([, target]) => target !== 0);

  return (
    <div className={`icon-cluster ${className}`}>
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {edges.map(([from, to]) => {
          const a = nodes[from];
          const b = nodes[to];
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}`}
              x1={`${a.x}%`}
              y1={`${a.y}%`}
              x2={`${b.x}%`}
              y2={`${b.y}%`}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      {nodes.map((node, index) => {
        const Icon = node.icon;
        return (
          <div
            key={index}
            className={`icon-cluster-node ${node.center ? "icon-cluster-node--center" : ""} ${node.accent ? "icon-cluster-node--accent" : ""}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        );
      })}
    </div>
  );
}
