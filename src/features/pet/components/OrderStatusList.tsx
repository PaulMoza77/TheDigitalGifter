import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { PetSceneProgress, PetSceneStatus } from "../types";
import { cn } from "@/lib/utils";
import { sceneIcon } from "./SceneCard";

const STATUS_COPY: Record<PetSceneStatus, string> = {
  queued: "Waiting in the studio",
  generating: "Painting this secret life",
  quality_control: "Human checking the face",
  ready: "Ready to download",
  failed: "Needs another look",
};

export function OrderStatusList({
  scenes,
  petName,
}: {
  scenes: PetSceneProgress[];
  petName: string;
}) {
  const readyCount = scenes.filter((scene) => scene.status === "ready").length;

  return (
    <section aria-labelledby="pet-order-status-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="pet-order-status-heading" className="text-2xl font-semibold tracking-tight text-[#f6efe4]">
            {petName}’s twelve lives
          </h2>
          <p className="mt-1 text-sm text-[#f6efe4]/70">
            {readyCount} of {scenes.length} portraits ready
          </p>
        </div>
      </div>

      <ol className="space-y-2">
        {scenes.map((scene) => {
          const Icon = sceneIcon(scene.sceneId);
          return (
            <li
              key={scene.sceneId}
              className="rounded-2xl border border-[#f6efe4]/10 bg-[#1a1410]/70 p-3 sm:p-4"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#d4a84b]/12 text-[#d4a84b]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-[#f6efe4]">{scene.title}</p>
                    <StatusChip status={scene.status} />
                  </div>
                  <p className="mt-1 text-sm text-[#f6efe4]/65">{STATUS_COPY[scene.status]}</p>
                  {scene.errorMessage ? (
                    <p className="mt-2 text-sm text-[#f0b4a0]">{scene.errorMessage}</p>
                  ) : null}
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f6efe4]/10"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={scene.progressPercent}
                    aria-label={`${scene.title} progress`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        scene.status === "failed" ? "bg-[#e07a5f]" : "bg-[#d4a84b]"
                      )}
                      style={{ width: `${scene.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StatusChip({ status }: { status: PetSceneStatus }) {
  const Icon =
    status === "ready"
      ? CheckCircle2
      : status === "failed"
        ? AlertCircle
        : status === "quality_control"
          ? ShieldCheck
          : status === "generating"
            ? Loader2
            : Clock3;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]",
        status === "ready" && "bg-emerald-500/15 text-emerald-200",
        status === "failed" && "bg-[#e07a5f]/15 text-[#f0b4a0]",
        status === "quality_control" && "bg-[#d4a84b]/15 text-[#f3d48a]",
        status === "generating" && "bg-sky-500/15 text-sky-200",
        status === "queued" && "bg-[#f6efe4]/8 text-[#f6efe4]/70"
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5", status === "generating" && "animate-spin")}
        aria-hidden="true"
      />
      {status.replace("_", " ")}
    </span>
  );
}
