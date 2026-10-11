import URI from '@theia/core/lib/common/uri';
import {
  createTextDocumentModel,
  type TextDocumentModel
} from '@commodore-commander/language-support/runtime';

interface DocumentSnapshot {
  resource: URI;
  document: Promise<TextDocumentModel | undefined>;
  expiresAt?: number;
}

/** Disk snapshots only. The caller always applies current editor text first. */
export class KickAssemblerWorkspaceDocuments {
  private readonly snapshots = new Map<string, DocumentSnapshot>();
  private activeUris: ReadonlySet<string> | undefined;
  private generation = 0;

  constructor(
    private readonly read: (resource: URI) => Promise<string>,
    private readonly now: () => number = Date.now
  ) {}

  getDocument(resource: URI): Promise<TextDocumentModel | undefined> {
    const key = resource.toString();
    const cached = this.snapshots.get(key);
    if (cached && (cached.expiresAt === undefined || cached.expiresAt > this.now())) {
      return cached.document;
    }

    const generation = this.generation;
    const snapshot: DocumentSnapshot = {
      resource,
      document: Promise.resolve().then(() => this.read(resource)).then(text => {
        if (generation !== this.generation) return undefined;
        if (this.snapshots.get(key) !== snapshot) return this.getDocument(resource);
        if (!this.activeUris || this.activeUris.has(key)) {
          snapshot.expiresAt = this.now() + 5000;
        } else {
          this.snapshots.delete(key);
        }
        return createTextDocumentModel({ uri: key, text });
      }, () => {
        if (generation !== this.generation) return undefined;
        if (this.snapshots.get(key) !== snapshot) return this.getDocument(resource);
        // Missing/unreadable files are opportunistically skipped and retried.
        this.snapshots.delete(key);
        return undefined;
      })
    };
    this.snapshots.set(key, snapshot);
    return snapshot.document;
  }

  retain(resources: readonly URI[]): void {
    this.activeUris = new Set(resources.map(resource => resource.toString()));
    for (const key of this.snapshots.keys()) {
      // Concurrent requests may still need a previous root's in-flight read.
      // Let it finish for its callers, then discard it outside the latest set.
      const snapshot = this.snapshots.get(key)!;
      if (!this.activeUris.has(key) && snapshot.expiresAt !== undefined) {
        this.snapshots.delete(key);
      }
    }
  }

  invalidate(resources: readonly URI[]): void {
    for (const [key, snapshot] of this.snapshots) {
      if (resources.some(resource => resource.isEqualOrParent(snapshot.resource))) {
        this.snapshots.delete(key);
      }
    }
  }

  clear(): void {
    this.generation++;
    this.activeUris = undefined;
    this.snapshots.clear();
  }
}
