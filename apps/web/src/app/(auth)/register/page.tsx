import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { cn, PixelBlob, PixelHeadphones } from "@spot-on-slot/ui";
import { authLinkClass } from "@/components/auth/auth-card";
import { REGISTER_ROLES, type RegisterRole } from "@/components/auth/auth-schemas";
import { RegisterForm } from "@/components/auth/register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: t("title") };
}

function parseRole(value: string | string[] | undefined): RegisterRole | null {
  const role = typeof value === "string" ? value.toUpperCase() : "";
  return REGISTER_ROLES.find((r) => r === role) ?? null;
}

function RoleChoice({
  href,
  title,
  lines,
  checker,
  tile,
}: {
  href: string;
  title: string;
  lines: string;
  checker: string;
  tile: ReactNode;
}) {
  return (
    <li className="flex">
      <Link
        href={href}
        className="group flex flex-1 flex-col gap-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <span aria-hidden="true" className="flex flex-col">
          <span className={cn("pattern-checker h-3", checker)} />
          {tile}
        </span>
        <span className="font-display text-3xl leading-[0.9] text-heading group-hover:text-primary sm:text-5xl">
          {title}
        </span>
        <span className="flex flex-col gap-3">
          <span aria-hidden="true" className="text-xl text-primary">
            →
          </span>
          <span className="whitespace-pre-line text-xs uppercase leading-relaxed">{lines}</span>
        </span>
      </Link>
    </li>
  );
}

/** Step 1 is the role select from the mockups (`?role=` empty), step 2 the form for the chosen role. */
export default async function Page({ searchParams }: PageProps<"/register">) {
  const role = parseRole((await searchParams).role);
  if (role) return <RegisterForm key={role} role={role} />;

  const t = await getTranslations();
  return (
    <>
      <section className="flex flex-col gap-6">
        <h1 className="font-display text-xl text-heading sm:text-2xl">{t("auth.role.heading")}</h1>
        <ul className="grid grid-cols-2 gap-4 sm:gap-8">
          <RoleChoice
            href="/register?role=artist"
            title={t("auth.role.slot.title")}
            lines={t("auth.role.slot.lines")}
            checker="text-heading dark:text-primary"
            tile={
              <span className="flex aspect-[3/4] sm:aspect-[4/3] items-center justify-center border-2 border-border bg-heading dark:bg-card">
                <span className="size-1/3 bg-highlight dark:bg-primary" />
              </span>
            }
          />
          <RoleChoice
            href="/register?role=venue"
            title={t("auth.role.spot.title")}
            lines={t("auth.role.spot.lines")}
            checker="text-highlight"
            tile={
              <span className="flex aspect-[3/4] sm:aspect-[4/3] items-center justify-center border-2 border-border bg-field dark:bg-highlight">
                <PixelHeadphones className="w-1/2 text-heading dark:text-highlight-foreground" />
              </span>
            }
          />
        </ul>
        <Link href="/login" className={cn(authLinkClass, "self-start text-sm")}>
          {t("auth.role.hasAccount")}
        </Link>
      </section>
      <footer className="flex items-end justify-between gap-6 border-t-2 border-border pt-6">
        <PixelBlob className="h-16 w-auto text-heading" />
        <div className="flex flex-col items-end gap-2">
          <p className="whitespace-pre-line text-right text-xs uppercase leading-snug">{t("auth.role.tagline")}</p>
          <span aria-hidden="true" className="pattern-checker h-3 w-20 text-heading" />
        </div>
      </footer>
    </>
  );
}
