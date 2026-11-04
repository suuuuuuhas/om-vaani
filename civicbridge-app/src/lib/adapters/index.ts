import type { RailwaySubflow, SystemId, TriageResult } from "@/lib/types";
import { epfoAdapter } from "./epfo";
import { nchAdapter } from "./nch";
import { railwaysAdapter } from "./railways";
import type { SystemAdapter } from "./types";

export const ADAPTERS: Record<SystemId, SystemAdapter> = {
  nch: nchAdapter,
  epfo: epfoAdapter,
  railways: railwaysAdapter
};

export function getAdapter(system: SystemId): SystemAdapter {
  return ADAPTERS[system];
}

/** Adapter lookup from a triage result, resolving the railway subflow. */
export function adapterForTriage(triage: TriageResult): {
  adapter: SystemAdapter;
  railwaySubflow?: RailwaySubflow;
} {
  return {
    adapter: getAdapter(triage.system),
    railwaySubflow: triage.railwaySubflow
  };
}

export type { SystemAdapter } from "./types";
