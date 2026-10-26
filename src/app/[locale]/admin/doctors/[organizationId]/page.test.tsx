import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header /> }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "platform-session-local", value: "synthetic" }] }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/features/admin-review/actions", () => ({ decideDoctorAction: vi.fn() }));
vi.mock("@/lib/api/identity", () => ({ currentAccount: vi.fn(), googleLoginHref: async () => "/api/auth/login?returnTo=%2Fen%2Fprovider" }));
vi.mock("@/lib/api/review", () => ({ doctorForReview: vi.fn(), submittedCredentials: vi.fn() }));
import type { DoctorReviewResponse } from "@dadzhioski/professional-services-api-client";
import { currentAccount } from "@/lib/api/identity";
import { doctorForReview, submittedCredentials, type ReviewCredential } from "@/lib/api/review";
import { localeCodes, translator } from "@/lib/i18n";
import Page, { generateMetadata } from "./page";

const authenticated = { state: "authenticated", account: {
  accountId: "synthetic-private-id", emailVerified: true, sessionExpiresAt: new Date("2099-01-01") } } as const;
const organizationId = "0b3f9c2e-6a1d-4c58-9e7f-2d4a8b1c5e60";
const credentialId = "6c1f0d7a-3b2e-4f9a-8c5d-1e2f3a4b5c6d";
const doctor: DoctorReviewResponse = { organizationId, approvalState: "PENDING", registeredAt: new Date("2026-10-01T08:00:00Z"),
  revision: 4, suspended: false };
const credential: ReviewCredential = { credentialId, organizationId, revision: 3, state: "SUBMITTED", type: "LICENSE",
  title: "Synthetic licence", issuer: "Synthetic board", issuedOn: new Date(2020, 0, 15), evidenceMediaIds: [] };
const render = async (query: { outcome?: string; decide?: string } = {}, locale = "en", id = organizationId) =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ locale, organizationId: id }), searchParams: Promise.resolve(query) }));
const reviewing = (overrides: Partial<DoctorReviewResponse> = {}, profile: object | null = {
  displayName: '<script>alert("x")</script>', biography: "Synthetic biography", publicationState: "DRAFT" }) => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(doctorForReview).mockResolvedValue({ state: "ready", doctor: { ...doctor, ...overrides }, profile: profile ?? undefined });
  vi.mocked(submittedCredentials).mockResolvedValue({ state: "ready", credentials: [credential,
    { ...credential, credentialId: "a1a1a1a1-b2b2-4c3c-8d4d-e5e5e5e5e5e5", organizationId: "1c4fad3f-7b2e-4d69-8f80-3e5b9c2d6f71", title: "Other doctor" }] });
};

beforeEach(() => vi.clearAllMocks());
for (const locale of localeCodes) {
  test(`${locale} shows separate approval, suspension and credential sections without a decision form`, async () => {
    const t = translator(locale);
    reviewing();
    const html = await render({}, locale);
    expect(html).toContain(t("review.approval"));
    expect(html).toContain(t("review.suspension"));
    expect(html).toContain(t("review.doctorCredentials"));
    expect(html).toContain(`href="/${locale}/admin/credentials/${credentialId}"`);
    expect(html).not.toContain("Other doctor");
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
  vi.mocked(submittedCredentials).mockResolvedValue({ state: "ready", credentials: [] });
  await expect(render()).rejects.toThrow("not-found");
});
test("a denied administrator sees no doctor data", async () => {
  vi.mocked(currentAccount).mockResolvedValue(authenticated);
  vi.mocked(doctorForReview).mockResolvedValue({ state: "forbidden" });
  vi.mocked(submittedCredentials).mockResolvedValue({ state: "forbidden" });
  const html = await render();
  expect(html).toContain(translator("en")("admin.denied"));
  expect(html).not.toContain(translator("en")("review.approval"));
});
test("a failed credential queue is a safe notice next to the application", async () => {
  reviewing();
  vi.mocked(submittedCredentials).mockResolvedValue({ state: "unavailable" });
  expect(await render()).toMatch(new RegExp(`role="alert"[^>]*>${translator("en")("account.unavailable")}`));
});
