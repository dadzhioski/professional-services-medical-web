import { ImageInput } from "@/features/media/image-input";
import { imageLimits } from "@/features/media/limits";
import { OwnerImage } from "@/features/media/owner-image";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import type { Credential } from "@/lib/api/credentials";
import { mediaContentPath } from "@/lib/api/media";
import { translator, type Locale } from "@/lib/i18n";
import { addCredentialEvidence, removeCredentialEvidence } from "./actions";
import { credentialStateKey, credentialTypeKey } from "./labels";

// Evidence IDs only appear on this private owner page, in form fields and owner content URLs.
export function EvidenceList({ locale, credentials }: { locale: Locale; credentials: Credential[] }) {
  const t = translator(locale);
  if (!credentials.length) return <p>{t("evidence.none")}</p>;
  return <ul className="space-y-6">
    {credentials.map(credential => {
      const id = credential.credentialId;
      const images = credential.evidenceMediaIds.flatMap(mediaId => {
        const path = mediaContentPath(mediaId);
        return path ? [{ mediaId, path }] : [];
      });
      return <li key={id}>
        <article aria-labelledby={`credential-${id}`} className="min-w-0 space-y-4 rounded-xl border border-slate-300 bg-white p-6 [overflow-wrap:anywhere]">
          <h2 id={`credential-${id}`} className="text-xl font-semibold text-teal-950">{credential.title}</h2>
          <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="font-semibold">{t("credential.type")}</dt><dd>{t(credentialTypeKey(credential.type))}</dd>
            <dt className="font-semibold">{t("credential.issuer")}</dt><dd>{credential.issuer}</dd>
            <dt className="font-semibold">{t("credential.state")}</dt><dd>{t(credentialStateKey(credential.state))}</dd>
          </dl>
          {images.length ? <ul className="flex flex-wrap gap-4">
            {images.map(({ mediaId, path }, index) => {
              const name = `${t("evidence.image")} ${index + 1}`;
              return <li key={mediaId} className="w-40 space-y-2">
                <OwnerImage path={path} alt={name} className="rounded-lg border border-slate-300" />
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
        </article>
      </li>;
    })}
  </ul>;
}
