import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Panel } from "@spot-on-slot/ui";
import { ScreenHeader } from "@/components/design/screen-header";
import { UploadDemo } from "@/components/design/upload-demo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("design.screens");
  return { title: t("upload") };
}

export default async function Page() {
  const t = await getTranslations("design");
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t("screens.upload")} />
      <Panel>
        <p className="text-sm">{t("upload.intro")}</p>
      </Panel>
      <UploadDemo />
    </section>
  );
}
