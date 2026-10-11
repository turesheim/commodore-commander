import URI from '@theia/core/lib/common/uri';

interface WorkspaceFileStat {
  resource: URI;
  isFile: boolean;
  children?: readonly {
    resource: URI;
    name: string;
    isFile: boolean;
    isDirectory: boolean;
  }[];
}

interface FileSnapshot {
  root: URI;
  files: Promise<readonly URI[]>;
  expiresAt?: number;
}

/** Theia URI/file-selection policy; document analysis stays in language-support. */
export class KickAssemblerWorkspaceFiles {
  private readonly snapshots = new Map<string, FileSnapshot>();
  private generation = 0;

  constructor(
    private readonly resolve: (resource: URI) => Promise<WorkspaceFileStat>,
    private readonly isSourceFile: (resource: URI) => boolean,
    private readonly excludedDirectories: ReadonlySet<string>,
    private readonly now: () => number = Date.now
  ) {}

  getFiles(root: URI): Promise<readonly URI[]> {
    const key = root.toString();
    const cached = this.snapshots.get(key);
    if (cached && (cached.expiresAt === undefined || cached.expiresAt > this.now())) {
      return cached.files;
    }

    const generation = this.generation;
    const snapshot: FileSnapshot = {
      root,
      files: this.discover(root).then(({ files, complete }) => {
        if (generation !== this.generation) {
          return [];
        }
        // A structural change during discovery makes even its current callers
        // wait for a fresh snapshot instead of returning an obsolete file list.
        if (this.snapshots.get(key) !== snapshot) {
          return this.getFiles(root);
        }
        if (complete) {
          // Workspace watchers may exclude files or miss events. Bound reuse
          // to five seconds. Disk snapshots have a separate invalidation boundary.
          snapshot.expiresAt = this.now() + 5000;
        } else {
          this.snapshots.delete(key);
        }
        return Object.freeze(files);
      })
    };
    this.snapshots.set(key, snapshot);
    return snapshot.files;
  }

  invalidate(resources: readonly URI[]): void {
    for (const [key, snapshot] of this.snapshots) {
      if (resources.some(resource => (
        snapshot.root.isEqualOrParent(resource) ||
        resource.isEqualOrParent(snapshot.root)
      ))) {
        this.snapshots.delete(key);
      }
    }
  }

  clear(): void {
    this.generation++;
    this.snapshots.clear();
  }

  private async discover(root: URI): Promise<{ files: URI[]; complete: boolean }> {
    const files: URI[] = [];
    const pending: URI[] = [root];
    const seen = new Set<string>();
    let complete = true;

    while (pending.length > 0) {
      const candidate = pending.pop()!;
      const key = candidate.toString();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      let stat: WorkspaceFileStat;
      try {
        stat = await this.resolve(candidate);
      } catch {
        // Keep opportunistic lookup working, but retry incomplete discovery on
        // the next request rather than caching a transient filesystem failure.
        complete = false;
        continue;
      }

      if (stat.isFile) {
        if (this.isSourceFile(stat.resource)) {
          files.push(stat.resource);
        }
        continue;
      }

      for (const child of stat.children ?? []) {
        if (child.isDirectory) {
          if (!this.excludedDirectories.has(child.name)) {
            pending.push(child.resource);
          }
        } else if (child.isFile && this.isSourceFile(child.resource)) {
          files.push(child.resource);
        }
      }
    }
    return { files, complete };
  }
}
