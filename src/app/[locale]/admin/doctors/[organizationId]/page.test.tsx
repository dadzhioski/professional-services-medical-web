import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/features/admin-review/actions", () => ({ decideDoctorAction: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async () => "/api/auth/login?returnTo=%2Fen%2Fprovider" }));
vi.mock("@/lib/api/review", () => ({ doctorForReview: vi.fn() }));
import type { DoctorReviewResponse } from "@dadzhioski/professional-services-api-client";
import { currentAccount } from "@/lib/api/identity";
import { doctorForReview } from "@/lib/api/review";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const organizationId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const proofId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const doctor: DoctorReviewResponse = { organizationId, approvalState: "PENDING", registeredAt: new Date("2026-10-01T08:00:00Z"),
  revision: 4, suspended: false };
const render = async (query: { outcome?: string; decide?: string } = {}, locale = "en", id = organizationId) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale, organizationId: id }), searchParams: Promise.resolve(query) }));
const reviewing = (overrides: Partial<DoctorReviewResponse> = {}, profile: object | null = {
  displayName: '<script>alert("x")</script>', biography: "Synthetic biography", publicationState: "DRAFT",
  education: "Synthetic University\n<b>Medicine</b>", specialties: "Synthetic cardiology", certificates: null, evidenceMediaIds: [proofId] }) => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(doctorForReview).mockResolvedValue({ state: "ready", doctor: { ...doctor, ...overrides }, profile: profile ?? undefined });
};

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} shows the qualifications and proofs with separate approval and suspension sections without a decision form`, async () => {
    const t = translator(locale);
    reviewing();
    const html = await render({}, locale);
    expect(html).toContain(t("review.approval"));
    expect(html).toContain(t("review.suspension"));
    expect(html).toContain(t("qualifications.heading"));
    expect(html).toContain("Synthetic University\n&lt;b&gt;Medicine&lt;/b&gt;");
    expect(html).toContain("Synthetic cardiology");
    expect(html).toContain(t("review.notProvided"));
    expect(html).toContain(`src="/api/v1/admin/media/${proofId}/content"`);
    expect(html).not.toContain(`/api/v1/media/${proofId}`);
    expect(html).not.toContain("/admin/credentials");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<form");
    expect(html).toContain(`?decide=approve#decision`);
    expect(html).toContain(`?decide=suspend#decision`);
    expect(html).not.toContain(`?decide=reinstate`);
    expect(await generateMetadata({ params: Promise.resolve({ locale, organizationId }) }))
      .toEqual({ title: t("review.doctor.heading"), robots: { index: false, follow: false } });
  });
}
test("confirming a rejection renders a reason field and the reviewed revision", async () => {
  reviewing();
  const html = await render({ decide: "reject" });
  expect(html).toContain('<input type="hidden" name="revision" value="4"/>');
  expect(html).toMatch(/<textarea[^>]*name="reason"[^>]*required/);
  expect(html).toContain(translator("en")("review.confirm.rejectNote"));
});
test("a missing reason keeps the rejection step open with the error tied to the field", async () => {
  reviewing();
  const html = await render({ decide: "reject", outcome: "reasonRequired" });
  expect(html).toMatch(/<textarea[^>]*aria-describedby="decision-reason-hint decision-reason-error"[^>]*aria-invalid="true"/);
  expect(html).toContain(`id="decision-reason-error" class="font-medium text-red-800">${translator("en")("review.outcome.reasonRequired")}`);
});
test.each([["approve", { approvalState: "APPROVED" }], ["reject", { approvalState: "REJECTED" }], ["reinstate", {}],
  ["suspend", { suspended: true }], ["delete", {}]] as const)("decision %s is not offered for this state", async (decide, overrides) => {
  reviewing(overrides);
  expect(await render({ decide })).not.toContain("<form");
});
test("a suspended doctor is offered reinstatement with the republication note", async () => {
  reviewing({ approvalState: "APPROVED", suspended: true });
  const html = await render({ decide: "reinstate" });
  expect(html).toContain('name="revision" value="4"');
  expect(html).toContain(translator("en")("review.confirm.reinstateNote"));
  expect(html).not.toContain("?decide=approve");
});
test("a doctor without a profile is still reviewable", async () => {
  reviewing({}, null);
  expect(await render()).toContain(translator("en")("review.noProfile"));
});
test.each([["conflict", "alert", "review.outcome.conflict"], ["suspended", "status", "review.outcome.suspended"],
  ["reasonRequired", "alert", "review.outcome.reasonRequired"]] as const)("outcome %s is announced as %s", async (outcome, role, key) => {
  reviewing();
  expect(await render({ outcome })).toMatch(new RegExp(`role="${role}"[^>]*>${translator("en")(key)}`));
});
test("unknown outcomes are ignored", async () => {
  reviewing();
  expect(await render({ outcome: "raw-private-error" })).not.toContain("raw-private-error");
});
test("an unknown doctor is not found", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(doctorForReview).mockResolvedValue({ state: "notFound" });
  await expect(render()).rejects.toThrow("not-found");
});
test("a denied administrator sees no doctor data", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(doctorForReview).mockResolvedValue({ state: "forbidden" });
  const html = await render();
  expect(html).toContain(translator("en")("admin.denied"));
  expect(html).not.toContain(translator("en")("review.approval"));
});
test("a doctor without proofs is shown as having none", async () => {
  reviewing({}, { displayName: "Dr Synthetic", education: "Synthetic University", specialties: "Synthetic cardiology" });
  const html = await render();
  expect(html).toContain(translator("en")("proof.none"));
  expect(html).not.toContain("<img");
});
