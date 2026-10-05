"use client";

import { Logout } from "pixelarticons/react/Logout";
import { User } from "pixelarticons/react/User";
import { useTranslations } from "next-intl";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@spot-on-slot/ui";
import { LanguageMenu } from "@/components/preferences/language-menu";
import { ThemeMenu } from "@/components/preferences/theme-menu";
import { useSession } from "@/components/session/session-provider";

export function UserMenu() {
  const t = useTranslations();
  const { session, signOut } = useSession();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-3 border-2 border-border px-3">
          <Avatar className="size-8 rounded-none border-2 border-border">
            <AvatarFallback className="rounded-none">
              <User className="size-4" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          {t("nav.menu")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        {session.status === "authenticated" && (
          <>
            <DropdownMenuLabel className="truncate font-sans font-normal">{session.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <LanguageMenu />
        <DropdownMenuSeparator />
        <ThemeMenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <Logout className="size-4" aria-hidden="true" />
          {t("auth.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
