import { Notice } from "@/components/ui/presentation";
import { outcomeMessage, photoOutcomes } from "@/features/media/form";
import { ImageInput } from "@/features/media/image-input";
import { OwnerImage } from "@/features/media/owner-image";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import { ChecklistLink } from "@/features/provider-onboarding/workspace";
import { mediaContentPath } from "@/lib/api/media";
import { translator, type Locale } from "@/lib/i18n";
import { changeProfilePhoto, removeProfilePhoto } from "./photo-actions";

export function PhotoSection({ locale, version, photoMediaId, outcome }: {
  locale: Locale; version: number; photoMediaId?: string; outcome?: string;
}) {
  const t = translator(locale);
  const path = mediaContentPath(photoMediaId);
  const message = outcomeMessage(photoOutcomes, outcome);
  return <section id="photo" aria-labelledby="photo-heading" className="space-y-4">
    <h2 id="photo-heading" className="text-xl font-semibold text-teal-950">{t("photo.heading")}</h2>
    <p>{t("photo.description")}</p>
    {message && <Notice role={message.success ? "status" : "alert"}>{t(message.key)}
      {message.success && <> <ChecklistLink locale={locale} /></>}</Notice>}
    {path ? <OwnerImage path={path} alt={t("photo.current")} className="w-40 rounded-xl" /> : <p>{t("photo.none")}</p>}
    <form action={changeProfilePhoto.bind(null, locale)} className="space-y-4">
      <input type="hidden" name="version" value={version} />
      <ImageInput id="profile-photo" name="photo" label={t("media.file")} hint={t("media.hint")}
        tooLarge={t("media.tooLarge")} unsupported={t("media.unsupported")} />
      <SubmitButton label={t(path ? "photo.replace" : "photo.upload")} pendingLabel={t("media.uploading")} />
    </form>
    {path && <form action={removeProfilePhoto.bind(null, locale)}>
      <input type="hidden" name="version" value={version} />
      <SubmitButton label={t("photo.remove")} pendingLabel={t("media.removing")} />
    </form>}
  </section>;
}
