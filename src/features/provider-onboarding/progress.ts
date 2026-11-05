import "server-only";
import { missingPart } from "@/features/provider-publication/labels";
import type { ContextResult } from "@/lib/api/organization";
import type { ProfileResult, PublicationResult } from "@/lib/api/profile";
import type { TranslationKey } from "@/lib/i18n/en";

export type StepId = "workspace" | "profile" | "service" | "location" | "photo" | "review" | "publish";
export type StepState = "done" | "current" | "todo" | "blocked" | "optional";
// `page` is relative to /[locale]/provider; workspace and review are completed by forms on the checklist itself.
export type Step = { id: StepId; state: StepState; reason?: TranslationKey; details: TranslationKey[]; page?: string };
export type ProgressReads = { context: ContextResult; publication?: PublicationResult; profile?: ProfileResult };

const editorPages = { profile: "profile", service: "services", location: "locations" } as const;
type EditorStep = keyof typeof editorPages;
const order: StepId[] = ["workspace", "profile", "service", "location", "photo", "review", "publish"];
const unavailable = "onboarding.reason.unavailable";

const approvalDetails: Record<string, TranslationKey> = { PENDING: "onboarding.review.pending", REJECTED: "onboarding.review.rejected" };

// Pure derivation from API reads. Failed reads and unknown values are never done, and the only current step is
// the first required step still to do; a blocked step there (suspension, failed read) leaves no current step.
export function onboardingProgress({ context, publication, profile }: ProgressReads): Step[] {
  if (context.state !== "ready") {
    const before = context.state === "notOnboarded";
    return order.map(id => id === "workspace" && before ? { id, state: "current", details: [] } :
      before ? { id, state: "todo", details: [] } : { id, state: "blocked", reason: unavailable, details: [] });
  }
  const { approvalState, suspended } = context.context;
  const missing = publication?.state === "ready" ? publication.publication.missing : undefined;
  const publicationFailed = publication?.state !== "ready" && publication?.state !== "missing";

  const editor = (id: EditorStep): Step => {
    const page = editorPages[id];
    if (publicationFailed) return { id, state: "blocked", reason: unavailable, details: [], page };
    const parts = (missing ?? []).filter(part => missingPart(part).page === page);
    const done = !!missing && !parts.length;
    const details = id === "profile" ? parts.map(part => missingPart(part).key) : [];
    return { id, state: done ? "done" : "todo", details, page };
  };

  const photo: Step = profile?.state === "ready" ? { id: "photo", state: profile.profile.photoMediaId ? "done" : "optional", details: [], page: "profile#photo" } :
    profile?.state === "missing" ? { id: "photo", state: "optional", details: [], page: "profile#photo" } :
      { id: "photo", state: "blocked", reason: unavailable, details: [], page: "profile#photo" };

  const review: Step = approvalState === "APPROVED" ? { id: "review", state: "done", details: [] } : {
    id: "review", state: suspended ? "blocked" : "todo", reason: suspended ? "onboarding.reason.suspended" : undefined,
    details: [Object.hasOwn(approvalDetails, approvalState) ? approvalDetails[approvalState] : "workspace.approval.unknown"] };

  const publish = ((): Step => {
    const page = "publication";
    if (publicationFailed) return { id: "publish", state: "blocked", reason: unavailable, details: [], page };
    if (publication?.state !== "ready") return { id: "publish", state: "blocked", reason: "onboarding.reason.completeAbove", details: [], page };
    const current = publication.publication;
    if (current.publicationState === "PUBLISHED") return { id: "publish", state: "done", details: [], page };
    // The same rule the publication page applies before it offers the confirmation step.
    if (current.approved && !current.suspended && !current.missing.length) return { id: "publish", state: "todo", details: [], page };
    const unknown = current.missing.some(part => !missingPart(part).page) ? ["publication.missing.unknown" as const] : [];
    // Parts this web does not know cannot be attributed to a step above, so they read as unavailable rather than "complete above".
    const reason = current.suspended ? "onboarding.reason.suspended" : current.missing.length && unknown.length === current.missing.length ?
      unavailable : current.missing.length ? "onboarding.reason.completeAbove" : "onboarding.reason.waitingApproval";
    return { id: "publish", state: "blocked", reason, details: unknown, page };
  })();

  const steps: Step[] = [{ id: "workspace", state: "done", details: [] }, editor("profile"), editor("service"), editor("location"), photo, review, publish];
  const next = steps.find(step => step.id !== "photo" && step.state !== "done");
  if (next?.state === "todo") next.state = "current";
  return steps;
}
