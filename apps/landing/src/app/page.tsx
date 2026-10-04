import { Button } from "@spot-on-slot/ui";

const audiences = [
  { title: "Artyści", text: "Pokaż, kiedy jesteś wolny, i dostawaj zapytania o występy w okolicy." },
  { title: "Kluby i lokale", text: "Znajdź artystę na konkretny termin bez dziesiątek wiadomości." },
  { title: "Bookerzy", text: "Zarządzaj kalendarzami swoich artystów w jednym miejscu." },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-24">
        <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">Wkrótce</span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Idealny artysta na Twoje wydarzenie, bez stresu z organizacją.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Spot On Slot łączy artystów, bookerów i lokale. Sprawdzasz dostępność, umawiasz występ i oszczędzasz czas.
        </p>
        <Button>Dołącz do listy oczekujących</Button>
      </section>
      <section className="bg-muted">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-16 sm:grid-cols-3">
          {audiences.map((item) => (
            <div key={item.title} className="rounded-lg bg-background p-6">
              <h2 className="mb-2 text-lg font-semibold">{item.title}</h2>
              <p className="text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
