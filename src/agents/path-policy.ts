import path from "node:path";
import { isPathInside, normalizeWindowsPathForComparison } from "../infra/path-guards.js";
import { resolveSandboxInputPath } from "./sandbox-paths.js";

type RelativePathOptions = {
  allowRoot?: boolean;
  cwd?: string;
  boundaryLabel?: string;
  includeRootInError?: boolean;
};

function throwPathEscapesBoundary(params: {
  options?: RelativePathOptions;
  rootResolved: string;
  candidate: string;
}): never {
  const boundary = params.options?.boundaryLabel ?? "workspace root";
  const suffix = params.options?.includeRootInError ? ` (${params.rootResolved})` : "";
  throw new Error(`Path escapes ${boundary}${suffix}: ${params.candidate}`);
}

function toRelativePathUnderRoot(params: {
  root: string;
  candidate: string;
  options?: RelativePathOptions;
}): string {
  const resolvedInput = resolveSandboxInputPath(
    params.candidate,
    params.options?.cwd ?? params.root,
  );

  if (process.platform === "win32") {
    const rootResolved = path.win32.resolve(params.root);
    const resolvedCandidate = path.win32.resolve(resolvedInput);
    const rootForCompare = normalizeWindowsPathForComparison(rootResolved);
    const targetForCompare = normalizeWindowsPathForComparison(resolvedCandidate);
    const relative = path.win32.relative(rootForCompare, targetForCompare);
    if (relative === "" || relative === ".") {
      if (params.options?.allowRoot) {
        return "";
      }
      throwPathEscapesBoundary({
        options: params.options,
        rootResolved,
        candidate: params.candidate,
      });
    }
    if (relative.startsWith("..") || path.win32.isAbsolute(relative)) {
      throwPathEscapesBoundary({
        options: params.options,
        rootResolved,
        candidate: params.candidate,
      });
    }
    return relative;
  }

  const rootResolved = path.resolve(params.root);
  const resolvedCandidate = path.resolve(resolvedInput);
  const relative = path.relative(rootResolved, resolvedCandidate);
  if (relative === "" || relative === ".") {
    if (params.options?.allowRoot) {
      return "";
    }
    throwPathEscapesBoundary({
      options: params.options,
      rootResolved,
      candidate: params.candidate,
    });
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throwPathEscapesBoundary({
      options: params.options,
      rootResolved,
      candidate: params.candidate,
    });
  }
  return relative;
}

export function toRelativeWorkspacePath(
  root: string,
  candidate: string,
  options?: Pick<RelativePathOptions, "allowRoot" | "cwd">,
): string {
  return toRelativePathUnderRoot({
    root,
    candidate,
    options: {
      allowRoot: options?.allowRoot,
      cwd: options?.cwd,
      boundaryLabel: "workspace root",
    },
  });
}

export function toRelativeSandboxPath(
  root: string,
  candidate: string,
  options?: Pick<RelativePathOptions, "allowRoot" | "cwd">,
): string {
  return toRelativePathUnderRoot({
    root,
    candidate,
    options: {
      allowRoot: options?.allowRoot,
      cwd: options?.cwd,
      boundaryLabel: "sandbox root",
      includeRootInError: true,
    },
  });
}

export function resolvePathFromInput(filePath: string, cwd: string): string {
  return path.normalize(resolveSandboxInputPath(filePath, cwd));
}

/**
 * Resolve a path to the first matching root and its relative path.
 * Used when tools.fs.allowedRoots is set: path must be under one of the roots.
 */
export function findRootAndRelative(
  candidate: string,
  roots: string[],
  options?: { cwd?: string },
): { root: string; relative: string } {
  if (roots.length === 0) {
    throw new Error("allowedRoots is empty");
  }
  const cwd = options?.cwd ?? path.resolve(roots[0]);
  const resolved = path.resolve(resolveSandboxInputPath(candidate, cwd));
  for (const r of roots) {
    const rootResolved = path.resolve(r);
    if (!isPathInside(rootResolved, resolved)) {
      continue;
    }
    if (process.platform === "win32") {
      const rootNorm = normalizeWindowsPathForComparison(rootResolved);
      const targetNorm = normalizeWindowsPathForComparison(resolved);
      const relative = path.win32.relative(rootNorm, targetNorm);
      return { root: rootResolved, relative: relative || "." };
    }
    const relative = path.relative(rootResolved, resolved);
    return { root: rootResolved, relative: relative || "." };
  }
  const rootsList = roots.slice(0, 3).join(", ") + (roots.length > 3 ? "…" : "");
  throw new Error(`Path escapes allowed roots (${rootsList}): ${candidate}`);
}
