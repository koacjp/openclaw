import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentConfig } from "./agent-scope.js";

export type ToolFsPolicy = {
  workspaceOnly: boolean;
  /** When non-empty, path must be under one of these roots (takes precedence over single workspace). */
  allowedRoots: string[];
};

export function createToolFsPolicy(params: {
  workspaceOnly?: boolean;
  allowedRoots?: string[];
}): ToolFsPolicy {
  const allowedRoots = params.allowedRoots ?? [];
  return {
    workspaceOnly: params.workspaceOnly === true,
    allowedRoots: Array.isArray(allowedRoots) ? allowedRoots.filter(Boolean) : [],
  };
}

export function resolveToolFsConfig(params: { cfg?: OpenClawConfig; agentId?: string }): {
  workspaceOnly?: boolean;
  allowedRoots?: string[];
} {
  const cfg = params.cfg;
  const globalFs = cfg?.tools?.fs;
  const agentFs =
    cfg && params.agentId ? resolveAgentConfig(cfg, params.agentId)?.tools?.fs : undefined;
  const allowedRoots = agentFs?.allowedRoots ?? globalFs?.allowedRoots;
  return {
    workspaceOnly: agentFs?.workspaceOnly ?? globalFs?.workspaceOnly,
    allowedRoots:
      Array.isArray(allowedRoots) && allowedRoots.length > 0 ? allowedRoots : undefined,
  };
}

export function resolveEffectiveToolFsWorkspaceOnly(params: {
  cfg?: OpenClawConfig;
  agentId?: string;
}): boolean {
  const resolved = resolveToolFsConfig(params);
  if (resolved.allowedRoots && resolved.allowedRoots.length > 0) {
    return true;
  }
  return resolved.workspaceOnly === true;
}
