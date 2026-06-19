import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LaunchBriefView } from "./LaunchBriefView";
import { generateLaunchBrief } from "@/lib/agents";
import { demoProfile } from "@/lib/seed";

describe("LaunchBriefView", () => {
  it("renders a sample Launch Brief dashboard", () => {
    render(<LaunchBriefView brief={generateLaunchBrief(demoProfile)} />);
    expect(screen.getByText("Launch Brief Workspace")).toBeTruthy();
    expect(screen.getAllByText("Context Copilot")).toHaveLength(2);
    expect(screen.getAllByText("Founder Reality Check").length).toBeGreaterThan(0);
  });
});
