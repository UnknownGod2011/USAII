"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ResearchStep } from "@/lib/research/researchAgent";

type ResearchProgressProps = {
  steps: ResearchStep[];
  currentStep?: number;
};

export function ResearchProgress({ steps, currentStep }: ResearchProgressProps) {
  void currentStep;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-stone-950">Research in progress</h2>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const isComplete = step.status === "complete";
          const isRunning = step.status === "running";

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-start gap-3 rounded-2xl p-4 ${
                isComplete
                  ? "bg-emerald-50 border border-emerald-200"
                  : isRunning
                    ? "bg-violet-50 border border-violet-200"
                    : "bg-stone-50 border border-stone-200"
              }`}
            >
              <div className="flex-shrink-0 pt-1">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : isRunning ? (
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-stone-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3
                  className={`text-sm font-semibold ${
                    isComplete ? "text-emerald-900" : isRunning ? "text-violet-900" : "text-stone-700"
                  }`}
                >
                  {step.label}
                </h3>

                {step.finding && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-2 text-sm leading-6 text-stone-600"
                  >
                    {step.finding}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
