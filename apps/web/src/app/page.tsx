"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@spot-on-slot/ui";
import { api } from "@/lib/api";

export default function Home() {
  const systemInfo = useQuery({
    queryKey: ["system-info"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/system/info");
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold">Spot On Slot</h1>
      <p className="text-muted-foreground">
        Panel dla artystów, bookerów i lokali. Tu powstaną profile, kalendarz dostępności i rezerwacje.
      </p>
      <p className="text-sm">
        Backend:{" "}
        {systemInfo.isPending && "łączenie…"}
        {systemInfo.isError && <span className="text-danger">niedostępny</span>}
        {systemInfo.data && (
          <span className="text-success">
            {systemInfo.data.name} {systemInfo.data.version}
          </span>
        )}
      </p>
      <div>
        <Button disabled>Zaloguj się</Button>
      </div>
    </main>
  );
}
