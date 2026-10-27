import type { ContextResponse } from "@dadzhioski/professional-services-api-client";
import { actionLinkClass } from "@/features/provider-records/page-frame";
import { translator, type Locale } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { Step, StepId } from "./progress";
import { SubmitButton } from "./submit-button";
import { approvalKey } from "./workspace";

type FormAction = (form: FormData) => Promise<void>;
const names = { workspace: "onboarding.step.workspace", profile: "onboarding.step.profile", service: "onboarding.step.service",
  location: "onboarding.step.location", credentials: "onboarding.step.credentials", photo: "onboarding.step.photo",
  review: "onboarding.step.review", publish: "onboarding.step.publication" } as const satisfies Record<StepId, TranslationKey>;
const linkClass = "inline-block min-h-11 py-2.5 font-semibold text-blue-800 underline underline-offset-4";

// Approval status and the owner's own rejection feedback, rendered as text only. Resubmission is offered while
// rejected and not suspended; the API decides at the shown revision and refuses anything else.
function ReviewDetail({ locale, context, resubmit }: { locale: Locale; context: ContextResponse; resubmit?: FormAction }) {
  const t = translator(locale);
  const rejected = context.approvalState === "REJECTED";
  return <>
    <dl className="grid gap-1">
      <dt className="font-semibold">{t("workspace.approval")}</dt>
      <dd>{t(approvalKey(context.approvalState))}</dd>
    </dl>
    {rejected && context.rejectionReason && <div className="space-y-1 rounded-lg border border-slate-400 p-4 [overflow-wrap:anywhere]">
      <h4 className="font-semibold">{t("workspace.feedback")}</h4>
      <p className="whitespace-pre-line">{context.rejectionReason}</p>
    </div>}
    {rejected && !context.suspended && resubmit && <form action={resubmit} className="space-y-4">
      <p>{t("workspace.resubmitNote")}</p>
      <input type="hidden" name="revision" value={context.approvalRevision} />
      <SubmitButton label={t("workspace.resubmit")} pendingLabel={t("workspace.resubmitting")} />
    </form>}
  </>;
}

// What is still needed for one step; shown once, with the next step or in the list.
function StepBody({ locale, step, context, resubmit }: { locale: Locale; step: Step; context?: ContextResponse; resubmit?: FormAction }) {
  const t = translator(locale);
  return <>
    {step.id === "workspace" && step.state === "done" && <p>{t("workspace.ready")}</p>}
    {step.reason && <p>{t(step.reason)}</p>}
    {step.id === "profile" && step.details.length > 0 ? <>
      <p>{t("onboarding.stillNeeded")}</p>
      <ul className="list-disc space-y-1 pl-6">{step.details.map(key => <li key={key}>{t(key)}</li>)}</ul>
    </> : step.details.map(key => <p key={key}>{t(key)}</p>)}
    {step.id === "review" && context && <ReviewDetail locale={locale} context={context} resubmit={resubmit} />}
  </>;
}

export function OnboardingChecklist({ locale, steps, context, create, resubmit }: {
  locale: Locale; steps: Step[]; context?: ContextResponse; create: FormAction; resubmit: FormAction;
}) {
  const t = translator(locale);
  const href = (step: Step) => step.page && `/${locale}/provider/${step.page}`;
  const current = steps.find(step => step.state === "current");
  // The optional photo never holds back completion.
  const allDone = steps.every(step => step.state === "done" || step.state === "optional");
  return <>
    <section aria-labelledby="next-step-heading" className="space-y-4 rounded-lg border-2 border-teal-800 p-4 [overflow-wrap:anywhere]">
      <h2 id="next-step-heading" className="text-xl font-semibold text-teal-950">{t("onboarding.next")}</h2>
      {current ? <>
        <h3 className="text-lg font-semibold">{t(names[current.id])}</h3>
        {current.id === "workspace" ? <form action={create} className="space-y-4">
          <p>{t("workspace.missing")}</p>
          <p>{t("onboarding.privacy")}</p>
          <SubmitButton label={t("onboarding.create")} pendingLabel={t("onboarding.creating")} />
        </form> : <StepBody locale={locale} step={current} context={context} resubmit={resubmit} />}
        {href(current) && <a className={actionLinkClass} href={href(current)}>
          {t("onboarding.action.open")}<span className="sr-only">: {t(names[current.id])}</span></a>}
      </> : <p>{t(allDone ? "onboarding.allDone" : "onboarding.noNext")}</p>}
    </section>
    <section aria-labelledby="checklist-heading" className="space-y-4">
      <h2 id="checklist-heading" className="text-xl font-semibold text-teal-950">{t("onboarding.checklist")}</h2>
      <ol className="list-decimal space-y-4 pl-6">
        {steps.map(step => {
          const link = step.state !== "current" && step.state !== "blocked" ? href(step) : undefined;
          return <li key={step.id} aria-current={step.state === "current" ? "step" : undefined} className="space-y-2 [overflow-wrap:anywhere]">
            <h3 className="font-semibold">{t(names[step.id])}</h3>
            <p><strong>{t(`onboarding.state.${step.state}`)}</strong></p>
            {step.state !== "current" && <StepBody locale={locale} step={step} context={context} resubmit={resubmit} />}
            {link && <a className={linkClass} href={link}>
              {t(step.state !== "done" ? "onboarding.action.open" : step.id === "publish" ? "onboarding.action.view" : "onboarding.action.edit")}
              <span className="sr-only">: {t(names[step.id])}</span></a>}
          </li>;
        })}
      </ol>
    </section>
  </>;
}
