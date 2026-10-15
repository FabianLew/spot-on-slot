"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Input,
  Label,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { Empty, LoadMore, StateTag, useWhen } from "./admin-ui";
import { ACCOUNT_ROLES, ACCOUNT_STATES, useAdminUsers, type AdminUser, type UserFilter } from "./queries";

const ANY = "any";

export function usersHref(filter: UserFilter) {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.role) params.set("role", filter.role);
  if (filter.state) params.set("state", filter.state);
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

/** "Użytkownicy": accounts by e-mail, stage name or venue name, role and state; the filter lives in the address. */
export function UsersScreen({ filter }: { filter: UserFilter }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [query, setQuery] = useState(filter.q ?? "");
  const users = useAdminUsers(filter);
  const go = (next: UserFilter) => router.replace(usersHref(next), { scroll: false });

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("users.title")} />
      <Panel>
        <form
          role="search"
          className="flex flex-col gap-3 md:flex-row md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            go({ ...filter, q: query.trim() || undefined });
          }}
        >
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="admin-user-query">{t("users.query")}</Label>
            <Input
              id="admin-user-query"
              type="search"
              value={query}
              placeholder={t("users.queryHint")}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 md:w-44">
            <Label htmlFor="admin-user-role">{t("users.role")}</Label>
            <Select
              value={filter.role ?? ANY}
              onValueChange={(role) => go({ ...filter, role: role === ANY ? undefined : (role as UserFilter["role"]) })}
            >
              <SelectTrigger id="admin-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("users.anyRole")}</SelectItem>
                {ACCOUNT_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`role.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 md:w-52">
            <Label htmlFor="admin-user-state">{t("users.state")}</Label>
            <Select
              value={filter.state ?? ANY}
              onValueChange={(state) =>
                go({ ...filter, state: state === ANY ? undefined : (state as UserFilter["state"]) })
              }
            >
              <SelectTrigger id="admin-user-state" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("users.anyState")}</SelectItem>
                {ACCOUNT_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {t(`state.${state}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">{t("users.search")}</Button>
        </form>
      </Panel>
      {users.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : users.isError ? (
        <ApiErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : users.data.pages[0]!.items.length === 0 ? (
        <Empty>{t("users.empty")}</Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {t("users.found", { count: users.data.pages[0]!.totalElements })}
          </p>
          <ul aria-label={t("users.listLabel")} className="flex flex-col gap-3">
            {users.data.pages.flatMap((page) => page.items.map((user) => <UserRow key={user.account.id} user={user} />))}
          </ul>
          <LoadMore show={users.hasNextPage} loading={users.isFetchingNextPage} onClick={() => users.fetchNextPage()} />
        </>
      )}
    </section>
  );
}

/** Stage name or venue names: what the account runs. */
export function runs(user: AdminUser): string | null {
  if (user.artist != null) return user.artist.stageName ?? user.artist.slug;
  if (user.venues.length > 0) return user.venues.map((venue) => venue.name).join(", ");
  return null;
}

function UserRow({ user }: { user: AdminUser }) {
  const t = useTranslations("admin");
  const when = useWhen();
  const what = runs(user);
  return (
    <li>
      <Link
        href={`/admin/users/${user.account.id}`}
        className="flex flex-col gap-1 border-2 border-border bg-card p-4 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold break-all">{user.account.email}</span>
          <StateTag state={user.account.state} />
          <span className="text-xs uppercase text-muted-foreground">{t(`role.${user.account.role}`)}</span>
          {user.reportsOpen > 0 && (
            <span className="ml-auto text-xs font-bold uppercase">{t("users.openReports", { count: user.reportsOpen })}</span>
          )}
        </span>
        {what != null && <span className="text-sm break-all">{what}</span>}
        <span className="text-xs text-muted-foreground">
          {t("users.joined", { when: when(user.account.createdAt) })}
          {user.account.lastSignInAt != null && ` · ${t("users.lastSignIn", { when: when(user.account.lastSignInAt) })}`}
        </span>
      </Link>
    </li>
  );
}
