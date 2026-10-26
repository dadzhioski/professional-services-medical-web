import { ImageInput } from "@/features/media/image-input";
import { imageLimits } from "@/features/media/limits";
import { OwnerImage } from "@/features/media/owner-image";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import type { Credential } from "@/lib/api/credentials";
import { mediaContentPath } from "@/lib/api/media";
import { translator, type Locale } from "@/lib/i18n";
import { addCredentialEvidence, removeCredentialEvidence, submitCredential } from "./actions";
import { credentialStateKey, credentialTypeKey } from "./labels";

const linkClass = "inline-block py-2 font-semibold text-blue-800 underline underline-offset-4";
const explanations = { DRAFT: "credentials.explain.draft", SUBMITTED: "credentials.explain.submitted",
  APPROVED: "credentials.explain.approved", REJECTED: "credentials.explain.rejected" } as const;
const explanation = (state: string) => Object.hasOwn(explanations, state) ? explanations[state as keyof typeof explanations] : undefined;

// Dates are local midnight as the generated client parses them, so they are formatted in the same zone.
const formatDate = (locale: Locale, date: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);

// Evidence IDs and review feedback only appear on this private owner page; the reviewer is never known here.
export function CredentialList({ locale, credentials, path }: { locale: Locale; credentials: Credential[]; path: string }) {
  const t = translator(locale);
  if (!credentials.length) return <p>{t("evidence.none")}</p>;
  return <ul className="space-y-6">
    {credentials.map(credential => {
      const id = credential.credentialId;
      const images = credential.evidenceMediaIds.flatMap(mediaId => {
        const contentPath = mediaContentPath(mediaId);
        return contentPath ? [{ mediaId, path: contentPath }] : [];
      });
      const explained = explanation(credential.state);
      // Only the API decides whether submission is allowed; this only hides a button that would be refused.
      const submittable = credential.state === "DRAFT" || credential.state === "REJECTED";
      return <li key={id}>
        <article aria-labelledby={`credential-${id}`} className="min-w-0 space-y-4 rounded-xl border border-slate-300 bg-white p-6 [overflow-wrap:anywhere]">
          <h3 id={`credential-${id}`} className="text-xl font-semibold text-teal-950">{credential.title}</h3>
          <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="font-semibold">{t("credential.type")}</dt><dd>{t(credentialTypeKey(credential.type))}</dd>
            <dt className="font-semibold">{t("credential.issuer")}</dt><dd>{credential.issuer}</dd>
            <dt className="font-semibold">{t("credentials.issued")}</dt><dd>{formatDate(locale, credential.issuedOn)}</dd>
            <dt className="font-semibold">{t("credentials.expires")}</dt>
            <dd>{credential.expiresOn ? formatDate(locale, credential.expiresOn) : t("credentials.noExpiry")}</dd>
            <dt className="font-semibold">{t("credential.state")}</dt><dd>{t(credentialStateKey(credential.state))}</dd>
          </dl>
          {explained && <p>{t(explained)}</p>}
          {credential.state === "REJECTED" && credential.rejectionReason && <div className="space-y-1 rounded-lg border border-slate-400 p-4">
            <h4 className="font-semibold">{t("credentials.feedback")}</h4>
            <p className="whitespace-pre-line">{credential.rejectionReason}</p>
          </div>}
          <p className="flex flex-wrap gap-4">
            <a className={linkClass} href={`${path}?edit=${encodeURIComponent(id)}#credential-edit-heading`}>
              {t("records.edit")}<span className="sr-only">: {credential.title}</span></a>
            <a className={linkClass} href={`${path}?remove=${encodeURIComponent(id)}#credential-remove`}>
              {t("records.remove")}<span className="sr-only">: {credential.title}</span></a>
          </p>
          <h4 className="text-lg font-semibold text-teal-950">{t("credentials.evidence")}</h4>
          {images.length ? <ul className="flex flex-wrap gap-4">
            {images.map(({ mediaId, path: contentPath }, index) => {
              const name = `${t("evidence.image")} ${index + 1}`;
              return <li key={mediaId} className="w-40 space-y-2">
                <OwnerImage path={contentPath} alt={name} className="rounded-lg border border-slate-300" />
                <form action={removeCredentialEvidence.bind(null, locale)}>
                  <input type="hidden" name="credentialId" value={id} />
                  <input type="hidden" name="version" value={credential.version} />
                  <input type="hidden" name="mediaId" value={mediaId} />
                  <SubmitButton label={t("evidence.remove")} pendingLabel={t("media.removing")}
                    aria-label={`${t("evidence.remove")}: ${name}, ${credential.title}`} />
                </form>
              </li>;
            })}
          </ul> : <p>{t("evidence.noEvidence")}</p>}
          {images.length < imageLimits.maxEvidence ? <form action={addCredentialEvidence.bind(null, locale)} className="space-y-4">
            <input type="hidden" name="credentialId" value={id} />
            <input type="hidden" name="version" value={credential.version} />
            <ImageInput id={`evidence-${id}`} name="evidence" label={`${t("media.file")}: ${credential.title}`} hint={t("media.hint")}
              tooLarge={t("media.tooLarge")} unsupported={t("media.unsupported")} />
            <SubmitButton label={t("evidence.add")} pendingLabel={t("media.uploading")} />
          </form> : <p>{t("evidence.full")}</p>}
          {submittable && (images.length ? <form action={submitCredential.bind(null, locale)}>
            <input type="hidden" name="credentialId" value={id} />
            <input type="hidden" name="version" value={credential.version} />
            <SubmitButton label={t("credentials.submit")} pendingLabel={t("credentials.submitting")}
              aria-label={`${t("credentials.submit")}: ${credential.title}`} />
          </form> : <p>{t("credentials.evidenceRequired")}</p>)}
        </article>
      </li>;
    })}
  </ul>;
}
