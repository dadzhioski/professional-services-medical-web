import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LanguageLinks } from "@/components/site-shell";
import { Heading, Notice } from "@/components/ui/presentation";
import { Surface } from "@/components/ui/surface";
import { OwnerImage } from "@/features/media/owner-image";
import { ProfilePresentation } from "@/features/professional-profile/presentation";
import { SubmitButton } from "@/features/provider-onboarding/submit-button";
import { checklistPath, ProviderNavigation } from "@/features/provider-onboarding/workspace";
import { createProfileDraft, saveProfileDraft, saveProfileSpecialty } from "@/features/provider-profile/actions";
import { editorMessageKeys, publicationKey, type EditorMessages } from "@/features/provider-profile/fields";
import { PhotoSection } from "@/features/provider-profile/photo-section";
import { ProfileEditor } from "@/features/provider-profile/profile-editor";
import { specialtyMessageKeys, type SpecialtyMessages } from "@/features/provider-profile/specialty";
import { SpecialtyEditor } from "@/features/provider-profile/specialty-editor";
import { recordMessageKeys, type RecordMessages } from "@/features/provider-records/form";
import { currentAccount, googleLoginHref } from "@/lib/api/identity";
import { mediaContentPath } from "@/lib/api/media";
import { readMedical } from "@/lib/api/medical";
import { currentContext } from "@/lib/api/organization";
import { readProfile } from "@/lib/api/profile";
import { listSpecialties } from "@/lib/api/reference";
import { incomingSession, sessionCookieName } from "@/lib/api/session-cookie";
import { getServerEnvironment } from "@/lib/config/server";
import { isLocale, translator } from "@/lib/i18n";
import { referenceLabel } from "@/lib/i18n/reference";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string; photo?: string }> };
const linkClass = "inline-block min-h-11 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white underline hover:bg-teal-900";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: translator(locale)("profileEditor.heading"), description: translator(locale)("profileEditor.description"),
    robots: { index: false, follow: false } };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);
  const name = sessionCookieName(getServerEnvironment().publicOrigin);
  const session = incomingSession((await cookies()).getAll(), name);
  const account = await currentAccount(session);
  const { notice, photo } = await searchParams;
  const safeNotice = notice === "forbidden" || notice === "unavailable" || notice === "expired" ? notice : undefined;
  const path = `/${locale}/provider/profile`;
  const loginHref = await googleLoginHref(locale);
  if (account.state !== "authenticated") {
    return <><SiteHeader locale={locale} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
      <LanguageLinks locale={locale} path={path} />
      <Surface className="space-y-6">
        <Heading>{t("profileEditor.heading")}</Heading>
        <Notice>{t(`account.${safeNotice ?? account.state}`)}</Notice>
        <a className={linkClass} href={loginHref}>{t("account.login")}</a>
      </Surface>
    </main></>;
  }
  // The profile API requires a workspace, so it is only called once the API confirms one exists.
  const workspace = await currentContext(session);
  const [profile, medical, specialties] = workspace.state === "ready" ?
    await Promise.all([readProfile(session), readMedical(session), listSpecialties()]) : [];
  // The specialty editor needs both the reference list and the medical extension (or its confirmed absence).
  const specialty = specialties?.state === "ready" && (medical?.state === "ready" || medical?.state === "missing") ? {
    version: medical.state === "ready" ? medical.medical.version : undefined,
    current: medical.state === "ready" ? medical.medical.specialtyId ?? "" : "",
    options: specialties.records.map(option => ({ id: option.id!, label: referenceLabel(option.labels, option.code!, locale) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale)),
  } : undefined;
  const specialtyFailure = medical && medical.state !== "ready" && medical.state !== "missing" ? medical.state : undefined;
  const specialtyMessages = Object.fromEntries(specialtyMessageKeys.map(key => [key, t(key)])) as SpecialtyMessages;
  const recordMessages = Object.fromEntries(recordMessageKeys.map(key => [key, t(key)])) as RecordMessages;
  const failed = workspace.state !== "ready" && workspace.state !== "notOnboarded" ? workspace.state :
    profile && profile.state !== "ready" && profile.state !== "missing" ? profile.state : undefined;
  // A failure notice never overrides an existing draft.
  const problem = failed ?? (profile?.state === "missing" ? safeNotice : undefined);
  const photoPath = profile?.state === "ready" ? mediaContentPath(profile.profile.photoMediaId) : null;
  const messages = Object.fromEntries(editorMessageKeys.map(key => [key, t(key)])) as EditorMessages;
  const savedLink = { href: checklistPath(locale), label: t("onboarding.backToChecklist") };
  return <><SiteHeader locale={locale} /><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl space-y-6 px-6">
    <LanguageLinks locale={locale} path={path} />
    <ProviderNavigation locale={locale} current="profile" />
    <Surface className="space-y-6">
      <Heading>{t("profileEditor.heading")}</Heading>
      <p>{t("profileEditor.description")}</p>
      {problem && <Notice role="alert">{t(`account.${problem}`)}</Notice>}
      {workspace.state === "notOnboarded" && <div className="space-y-4">
        <p>{t("workspace.missing")}</p>
        <a className={linkClass} href={`/${locale}/provider/onboarding`}>{t("workspace.start")}</a>
      </div>}
      {workspace.state === "ready" && workspace.context.suspended && <Notice>{t("workspace.suspended")}</Notice>}
      {profile?.state === "missing" && <form action={createProfileDraft.bind(null, locale)} className="space-y-4">
        <p>{t("profileEditor.missing")}</p>
        <SubmitButton label={t("profileEditor.create")} pendingLabel={t("profileEditor.creating")} />
      </form>}
      {profile?.state === "ready" && <>
        <dl className="grid gap-1 [overflow-wrap:anywhere]">
          <dt className="font-semibold">{t("profileEditor.slug")}</dt>
          <dd><code>{profile.profile.slug}</code> <span className="block text-sm text-slate-700">{t("profileEditor.slugHint")}</span></dd>
          <dt className="font-semibold">{t("profileEditor.publication")}</dt>
          <dd>{t(publicationKey(profile.profile.publicationState))}</dd>
        </dl>
        <p>{t("profileEditor.publicNote")}</p>
        <p>{t("profileEditor.contactNote")}</p>
        <p>{t("profileEditor.privacy")}</p>
        {/* Photo changes also bump the profile version; remounting on a photo change hands the editor that version. */}
        <ProfileEditor key={profile.profile.photoMediaId ?? "no-photo"} action={saveProfileDraft.bind(null, locale)} messages={messages} loginHref={loginHref} reloadHref={path} savedLink={savedLink}
          initial={{ status: "idle", errors: {}, version: profile.profile.version!,
            values: { displayName: profile.profile.displayName ?? "", biography: profile.profile.biography ?? "" } }} />
      </>}
    </Surface>
    {workspace.state === "ready" && <Surface>
      <section aria-labelledby="specialty-heading" className="space-y-4">
        <h2 id="specialty-heading" className="text-xl font-semibold text-teal-950">{t("specialtyEditor.heading")}</h2>
        <p>{t("specialtyEditor.description")}</p>
        {specialty ? <SpecialtyEditor action={saveProfileSpecialty.bind(null, locale)} messages={specialtyMessages}
          recordMessages={recordMessages} specialties={specialty.options} loginHref={loginHref} reloadHref={path} savedLink={savedLink}
          initial={{ status: "idle", errors: {}, version: specialty.version, values: { specialtyId: specialty.current } }} /> :
          <Notice role="alert">{t(`account.${specialtyFailure ?? "unavailable"}`)}</Notice>}
      </section>
    </Surface>}
    {profile?.state === "ready" && <Surface>
      <PhotoSection locale={locale} version={profile.profile.version!} photoMediaId={profile.profile.photoMediaId} outcome={photo} />
    </Surface>}
    {profile?.state === "ready" && <Surface>
      <section aria-labelledby="profile-preview" className="space-y-4">
        <h2 id="profile-preview" className="text-xl font-semibold text-teal-950">{t("profileEditor.previewHeading")}</h2>
        <p>{t("profileEditor.previewNote")}</p>
        <ProfilePresentation locale={locale} nested name={profile.profile.displayName?.trim() ? profile.profile.displayName : t("profileEditor.unnamed")}
          introduction={profile.profile.biography} photo={photoPath && <OwnerImage path={photoPath} alt="" />} />
      </section>
    </Surface>}
  </main></>;
}
