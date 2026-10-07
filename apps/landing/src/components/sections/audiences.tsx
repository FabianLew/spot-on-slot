import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@spot-on-slot/ui";

const AUDIENCES = ["artists", "venues", "bookers"] as const;

export function Audiences() {
  const t = useTranslations("audiences");

  return (
    <section id="audiences" className="scroll-mt-20 bg-background pattern-grid text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <h2 className="font-display text-2xl sm:text-3xl">{t("heading")}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {AUDIENCES.map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{t(`${key}.title`)}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">{t(`${key}.text`)}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
