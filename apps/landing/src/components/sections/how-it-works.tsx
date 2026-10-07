import { useTranslations } from "next-intl";

const STEPS = ["step1", "step2", "step3"] as const;

export function HowItWorks() {
  const t = useTranslations("howItWorks");

  return (
    <section id="how-it-works" className="scroll-mt-20 border-y-2 border-border bg-card text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <h2 className="font-display text-2xl sm:text-3xl">{t("heading")}</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((key, index) => (
            <li key={key} className="flex flex-col gap-3">
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center border-2 border-border bg-highlight font-display text-3xl text-highlight-foreground shadow-md"
              >
                {index + 1}
              </span>
              <p>
                <strong className="font-bold">{t(`${key}.title`)}</strong>{" "}
                <span className="text-muted-foreground">{t(`${key}.text`)}</span>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
