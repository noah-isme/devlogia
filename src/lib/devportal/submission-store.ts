import { randomUUID } from "node:crypto";

export type SubmissionStatus = "draft" | "in_review" | "approved" | "rejected";

export type Submission = {
  id: string;
  ownerId: string;
  repoUrl: string;
  version: string;
  manifest: string;
  scopes: string[];
  status: SubmissionStatus;
  badges: string[];
  notes?: string;
  reviewerId?: string;
  reviewChecklist?: string[];
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
};

export type SubmissionInput = Pick<Submission, "repoUrl" | "version" | "manifest" | "scopes">;

export type SubmissionUpdate = Partial<Pick<Submission, "repoUrl" | "version" | "manifest" | "scopes" | "status" | "badges" | "notes" | "reviewChecklist" | "reviewerId" | "decidedAt">>;

type SubmissionStore = Map<string, Submission>;

type SubmissionStoreContainer = {
  submissions: SubmissionStore;
};

const globalKey = Symbol.for("devlogia.devportal.submissions");

function resolveStore(): SubmissionStore {
  const globalScope = globalThis as unknown as Record<string | symbol, SubmissionStoreContainer | undefined>;
  const symbolScoped = globalScope as Record<symbol, SubmissionStoreContainer | undefined>;
  const existing = symbolScoped[globalKey];
  if (existing?.submissions) {
    pruneExpired(existing.submissions);
    return existing.submissions;
  }

  const container: SubmissionStoreContainer = {
    submissions: new Map(),
  };
  symbolScoped[globalKey] = container;
  return container.submissions;
}

function pruneExpired(store: SubmissionStore) {
  const threshold = Date.now() - 1000 * 60 * 60 * 24 * 30;
  for (const [id, submission] of store.entries()) {
    const updatedAt = Date.parse(submission.updatedAt);
    if (Number.isFinite(updatedAt) && updatedAt < threshold && submission.status === "approved") {
      store.delete(id);
    }
  }
}

export function listSubmissions(ownerId?: string) {
  const store = resolveStore();
  const entries = Array.from(store.values());
  return ownerId ? entries.filter((submission) => submission.ownerId === ownerId) : entries;
}

export function getSubmission(id: string) {
  const store = resolveStore();
  return store.get(id);
}

export function createSubmission(ownerId: string, input: SubmissionInput): Submission {
  const store = resolveStore();
  const now = new Date().toISOString();
  const submission: Submission = {
    id: randomUUID(),
    ownerId,
    repoUrl: input.repoUrl,
    version: input.version,
    manifest: input.manifest,
    scopes: [...new Set(input.scopes.map((scope) => scope.trim()).filter(Boolean))],
    status: "in_review",
    badges: [],
    createdAt: now,
    updatedAt: now,
  };
  store.set(submission.id, submission);
  return submission;
}

export function updateSubmission(id: string, changes: SubmissionUpdate) {
  const store = resolveStore();
  const current = store.get(id);
  if (!current) {
    return undefined;
  }

  const updated: Submission = {
    ...current,
    ...changes,
    scopes: changes.scopes ? [...new Set(changes.scopes.map((scope) => scope.trim()).filter(Boolean))] : current.scopes,
    badges: changes.badges ? Array.from(new Set(changes.badges)) : current.badges,
    updatedAt: new Date().toISOString(),
  };

  if (changes.status && ["approved", "rejected"].includes(changes.status) && !changes.decidedAt) {
    updated.decidedAt = new Date().toISOString();
  }

  store.set(id, updated);
  return updated;
}

export function resetSubmissionStore() {
  const store = resolveStore();
  store.clear();
}
