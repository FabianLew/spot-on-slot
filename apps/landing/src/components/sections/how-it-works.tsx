import { useTranslations } from "next-intl";

const STEPS = ["step1", "step2", "step3"] as const;

export function HowItWorks() {
  const t = useTranslations("howItWorks");

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-muted text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((key, index) => (
            <li key={key} className="flex flex-col gap-3">
              <span aria-hidden="true" className="text-4xl font-semibold text-primary">
                {index + 1}
              </span>
              <p>
                <strong className="font-semibold">{t(`${key}.title`)}</strong>{" "}
                <span className="text-muted-foreground">{t(`${key}.text`)}</span>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
