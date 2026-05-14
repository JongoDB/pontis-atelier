import type { PontisModule } from '../types';

export function buildDependencyIndex(modules: PontisModule[]) {
  const byId = new Map(modules.map((m) => [m.id, m] as const));
  const dependents = new Map<string, string[]>();
  for (const m of modules) {
    for (const dep of m.dependencies) {
      const list = dependents.get(dep) ?? [];
      list.push(m.id);
      dependents.set(dep, list);
    }
  }
  return { byId, dependents };
}

export function missingDependencies(
  module: PontisModule,
  selected: Set<string>,
  byId: Map<string, PontisModule>
): PontisModule[] {
  return module.dependencies
    .map((id) => byId.get(id))
    .filter((m): m is PontisModule => !!m && !selected.has(m.id));
}

// Transitive closure: when Maggie auto-resolves, pull in *all* prerequisites
// in topo order — closest-first, then their prereqs, etc.
export function expandPrerequisites(
  rootId: string,
  byId: Map<string, PontisModule>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    if (!node) return;
    for (const dep of node.dependencies) visit(dep);
    out.push(id);
  };
  visit(rootId);
  // Drop the root itself; caller already has it.
  return out.filter((id) => id !== rootId);
}
