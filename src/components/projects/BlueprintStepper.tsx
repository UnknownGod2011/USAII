type BlueprintStepperProps = {
  blueprint: string[];
};

export function BlueprintStepper({ blueprint }: BlueprintStepperProps) {
  if (blueprint.length === 0) {
    return (
      <div className="terminal-card p-6">
        <p className="font-mono text-sm text-lp-muted">
          Blueprint steps will appear once there is enough interview data to generate a build roadmap.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {blueprint.map((step, index) => {
        const [horizon, ...rest] = step.split(":");
        const title = rest.join(":").trim() || step;

        return (
          <li key={`${index}-${step.slice(0, 24)}`} className="flex gap-4 border border-white/10 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/20 font-mono text-xs text-white">
              {index + 1}
            </div>
            <div>
              {rest.length > 0 ? (
                <>
                  <p className="mono-label">{horizon.trim()}</p>
                  <p className="mt-1 text-sm leading-6 text-lp-muted">{title}</p>
                </>
              ) : (
                <p className="text-sm leading-6 text-lp-muted">{step}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
