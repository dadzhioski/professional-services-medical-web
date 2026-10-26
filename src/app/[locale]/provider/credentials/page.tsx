import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { credentialOutcomes, evidenceOutcomes, outcomeMessage } from "@/features/media/form";
import { removeCredential, saveCredential } from "@/features/provider-credentials/actions";
import { CredentialEditor } from "@/features/provider-credentials/credential-editor";
import { CredentialList } from "@/features/provider-credentials/credential-list";
import { credentialLimits, credentialMessageKeys, credentialTypes, dateText, emptyCredential,
  type CredentialMessages } from "@/features/provider-credentials/fields";
import { recordMessageKeys, type RecordMessages } from "@/features/provider-records/form";
import { actionLinkClass, ProviderFrame, providerGate, PublicationStatus, SignedOutView } from "@/features/provider-records/page-frame";
import { RemoveConfirmation } from "@/features/provider-records/remove-confirmation";
import { readCredentials, type Credential } from "@/lib/api/credentials";
import { readProfile } from "@/lib/api/profile";
import { isLocale, translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>;
  searchParams: Promise<{ evidence?: string; credential?: string; edit?: string; remove?: string }> };
const linkClass = "inline-block py-2 font-semibold text-blue-800 underline underline-offset-4";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Credentials, evidence and feedback are private: nothing about them reaches metadata, and the page is never indexed.
  return { title: translator(locale)("credentials.heading"), robots: { index: false, follow: false } };
}

export default async function CredentialsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const path = `/${locale}/provider/credentials`;
  const gate = await providerGate(locale);
  if (gate.state !== "authenticated") {
    return <SignedOutView locale={locale} path={path} heading="credentials.heading" state={gate.state} loginHref={gate.loginHref} />;
  }
  const { session, workspace, loginHref } = gate;
  // Credentials require a workspace, so they are only read once the API confirms one exists.
  const [credentials, profile] = workspace.state === "ready" ? await Promise.all([readCredentials(session), readProfile(session)]) : [];
  const failed = workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state :
    credentials && credentials.state !== "ready" ? credentials.state : undefined;
  const records = credentials?.state === "ready" ? credentials.credentials : undefined;
  const query = await searchParams;
  const editing = records && query.edit ? records.find(credential => credential.credentialId === query.edit) : undefined;
  const removing = records && query.remove ? records.find(credential => credential.credentialId === query.remove) : undefined;
  const lost = records && ((query.edit && !editing) || (query.remove && !removing));
  const evidenceMessage = outcomeMessage(evidenceOutcomes, query.evidence);
  const credentialMessage = outcomeMessage(credentialOutcomes, lost ? "missing" : query.credential);
  const messages = Object.fromEntries(credentialMessageKeys.map(key => [key, t(key)])) as CredentialMessages;
  const recordMessages = Object.fromEntries(recordMessageKeys.map(key => [key, t(key)])) as RecordMessages;
  const editor = (credential?: Credential) => <CredentialEditor id={credential ? "credential-edit" : "credential-new"}
    action={saveCredential.bind(null, locale, credential?.credentialId)} messages={messages} recordMessages={recordMessages}
    types={credentialTypes} loginHref={loginHref}
    reloadHref={credential ? `${path}?edit=${encodeURIComponent(credential.credentialId)}` : path}
    initial={{ status: "idle", errors: {}, version: credential?.version, values: credential ? {
      type: credential.type, title: credential.title, issuer: credential.issuer, issuedOn: dateText(credential.issuedOn),
      expiresOn: dateText(credential.expiresOn),
    } : emptyCredential }} />;
  return <ProviderFrame locale={locale} path={path} current="credentials">
    <Surface className="space-y-6">
      <Heading>{t("credentials.heading")}</Heading>
      <p>{t("credentials.description")}</p>
      <p>{t("credentials.privacy")}</p>
      <p>{t("evidence.description")}</p>
      <p>{t("evidence.privacy")}</p>
      <p>{t("evidence.revision")}</p>
      {credentialMessage && <div id="credential-outcome">
        <Notice role={credentialMessage.success ? "status" : "alert"}>{t(credentialMessage.key)}</Notice></div>}
      {evidenceMessage && <div id="evidence-outcome">
        <Notice role={evidenceMessage.success ? "status" : "alert"}>{t(evidenceMessage.key)}</Notice></div>}
      {failed && <Notice role="alert">{t(`account.${failed}`)}</Notice>}
      {workspace.state === "notOnboarded" && <div className="space-y-4">
        <p>{t("workspace.missing")}</p>
        <a className={actionLinkClass} href={`/${locale}/provider/onboarding`}>{t("workspace.start")}</a>
      </div>}
      {workspace.state === "ready" && workspace.context.suspended && <Notice>{t("workspace.suspended")}</Notice>}
      {profile?.state === "ready" && <PublicationStatus locale={locale} state={profile.profile.publicationState} />}
    </Surface>
    {removing && <RemoveConfirmation id="credential-remove" heading={t("credentials.removeHeading")} item={removing.title}
      note={t("credentials.removeNote")} confirmLabel={t("records.removeConfirm")} pendingLabel={t("records.removing")}
      cancelLabel={t("records.cancel")} cancelHref={path}
      action={removeCredential.bind(null, locale, removing.credentialId, removing.version)} />}
    {editing && <Surface>
      <section aria-labelledby="credential-edit-heading" className="space-y-4">
        <h2 id="credential-edit-heading" className="text-xl font-semibold text-teal-950">{t("credentials.editHeading")}</h2>
        {(editing.state === "SUBMITTED" || editing.state === "APPROVED") && <Notice>{t("credentials.reviewedEditNote")}</Notice>}
        {editor(editing)}
        <a className={linkClass} href={path}>{t("records.cancel")}</a>
      </section>
    </Surface>}
    {records && <Surface>
      <section aria-labelledby="credential-list" className="space-y-4">
        <h2 id="credential-list" className="text-xl font-semibold text-teal-950">{t("credentials.listHeading")}</h2>
        <CredentialList locale={locale} credentials={records} path={path} />
      </section>
    </Surface>}
    {records && !editing && <Surface>
      <section aria-labelledby="credential-add" className="space-y-4">
        <h2 id="credential-add" className="text-xl font-semibold text-teal-950">{t("credentials.add")}</h2>
        {records.length < credentialLimits.count ? editor() : <p>{t("credentials.limit")}</p>}
      </section>
    </Surface>}
  </ProviderFrame>;
}
