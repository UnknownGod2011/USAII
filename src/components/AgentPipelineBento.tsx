import { IconCluster } from "@/components/IconCluster";
import { Bot, Brain, Radar, Search, ShieldCheck, Target } from "lucide-react";

const agents = [
  { name: "Lead Research", icon: Brain },
  { name: "Competitor", icon: Search },
  { name: "Pain Point", icon: Target },
  { name: "Opportunity", icon: Radar },
  { name: "Skill Gap", icon: Bot },
  { name: "Source Quality", icon: ShieldCheck },
];

export function AgentPipelineBento() {
  const nodes = [
    { icon: Brain, x: 50, y: 50, center: true, accent: true },
    { icon: Search, x: 18, y: 28 },
    { icon: Target, x: 82, y: 28 },
    { icon: Radar, x: 12, y: 72 },
    { icon: Bot, x: 88, y: 72 },
    { icon: ShieldCheck, x: 50, y: 88, accent: true },
  ];

  return (
    <div className="bento-card flex h-full flex-col">
      <IconCluster nodes={nodes} className="mb-5 flex-1 min-h-[160px]" />
      <p className="mono-label">Multi-agent pipeline</p>
      <h3 className="mt-2 text-lg font-semibold text-stone-100">Six agents, one grounded verdict</h3>
      <p className="mt-2 text-sm leading-6 text-lp-muted">
        Lead Research orchestrates competitors, pain points, opportunities, skill gaps, and source quality — each labeled with evidence confidence.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {agents.map((agent) => (
          <span
            key={agent.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-lp-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-lp-subtle"
          >
            <agent.icon className="h-3 w-3 text-lp-accent-soft" />
            {agent.name}
          </span>
        ))}
      </div>
    </div>
  );
}
