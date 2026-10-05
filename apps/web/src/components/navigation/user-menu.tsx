"use client";

import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@spot-on-slot/ui";
import { LanguageMenu } from "@/components/preferences/language-menu";
import { ThemeMenu } from "@/components/preferences/theme-menu";

export function UserMenu() {
  const t = useTranslations("nav");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-3 px-3">
          <Avatar className="size-8">
            <AvatarFallback>
              <UserRound className="size-4" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          {t("menu")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <LanguageMenu />
        <DropdownMenuSeparator />
        <ThemeMenu />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
