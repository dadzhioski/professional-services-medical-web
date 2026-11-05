import { Notice } from "@/components/ui/presentation";
import { outcomeMessage, proofOutcomes } from "@/features/media/form";
import { ImageInput } from "@/features/media/image-input";
import { imageLimits } from "@/features/media/limits";
import { OwnerImage } from "@/features/media/owner-image";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import { mediaContentPath } from "@/lib/api/media";
import { translator, type Locale } from "@/lib/i18n";
import { addProfileProof, removeProfileProof } from "./photo-actions";

// Proof images and their IDs only appear on this private owner page; they are never needed to publish.
export function ProofSection({ locale, version, proofMediaIds, outcome }: {
  locale: Locale; version: number; proofMediaIds: readonly string[]; outcome?: string;
}) {
  const t = translator(locale);
  const message = outcomeMessage(proofOutcomes, outcome);
  const images = proofMediaIds.flatMap(mediaId => {
    const path = mediaContentPath(mediaId);
    return path ? [{ mediaId, path }] : [];
  });
  return <section id="proofs" aria-labelledby="proofs-heading" className="space-y-4">
    <h2 id="proofs-heading" className="text-xl font-semibold text-teal-950">{t("proof.heading")}</h2>
    <p>{t("proof.description")}</p>
    <p>{t("proof.privacy")}</p>
    {message && <Notice role={message.success ? "status" : "alert"}>{t(message.key)}</Notice>}
    {images.length ? <ul className="flex flex-wrap gap-4">
      {images.map(({ mediaId, path }, index) => {
        const name = `${t("proof.image")} ${index + 1}`;
        return <li key={mediaId} className="w-40 space-y-2">
          <OwnerImage path={path} alt={name} className="rounded-lg border border-slate-300" />
          <form action={removeProfileProof.bind(null, locale)}>
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="mediaId" value={mediaId} />
            <SubmitButton label={t("proof.remove")} pendingLabel={t("media.removing")} aria-label={`${t("proof.remove")}: ${name}`} />
          </form>
        </li>;
      })}
    </ul> : <p>{t("proof.none")}</p>}
    {images.length < imageLimits.maxEvidence ? <form action={addProfileProof.bind(null, locale)} className="space-y-4">
      <input type="hidden" name="version" value={version} />
      <ImageInput id="profile-proof" name="proof" label={t("proof.file")} hint={t("media.hint")}
        tooLarge={t("media.tooLarge")} unsupported={t("media.unsupported")} />
      <SubmitButton label={t("proof.add")} pendingLabel={t("media.uploading")} />
    </form> : <p>{t("proof.full")}</p>}
  </section>;
}
