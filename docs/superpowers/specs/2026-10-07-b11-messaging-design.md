# B11: wiadomości (moduł `messaging`)

Status: zaakceptowana przez Fabiana 2026-10-07 („Ok”). Etap według `architektura/segmenty-mvp.md`: B11 (backend), ekrany przyjdą w W10. Kto zaczyna rozmowę: „Każdy z profilem” (wybór Fabiana na karcie, 2026-10-07).

## 1. Co użytkownicy dostają

1. **Rozmowa artysta–lokal.**
   - Zalogowany artysta może napisać do opublikowanego lokalu, a członek zespołu lokalu (właściciel albo menedżer) do opublikowanego artysty.
   - Na rozmowę po stronie lokalu odpowiada cały jego zespół. Konto z kilkoma lokalami wybiera, w imieniu którego pisze.
   - Jedna para artysta–lokal ma jedną rozmowę. Kolejne „Napisz” otwiera tę samą rozmowę.
   - W MVP nie ma rozmów artysta–artysta ani lokal–lokal.
2. **Wątek przy bookingu.**
   - Każdy booking dostaje własny wątek: od chwili zapytania, dla artysty i całego zespołu lokalu.
   - Wątek zostaje po zakończeniu bookingu i można w nim dalej pisać, np. po występie.
   - Wiadomości dołączone do kroków bookingu (zapytanie, kontroferta, powód odwołania) zostają w historii bookingu, tak jak dziś. Wątek służy do zwykłej rozmowy.
3. **Wiadomości.**
   - Sam tekst, do 2000 znaków. Zdjęć i plików w MVP nie ma.
   - Wiadomości nie można edytować ani usuwać.
   - Widać, czy druga strona przeczytała ostatnią wiadomość („Przeczytane”).
   - Nie filtrujemy numerów telefonów ani adresów. Strony mogą się wymienić kontaktem, jeśli chcą.
4. **Na żywo.** Nowe wiadomości i „Przeczytane” przychodzą od razu przez WebSocket, bez odświeżania strony.
5. **Nieprzeczytane.** Licznik w menu (jak przy bookingach) i przy każdej rozmowie na liście.
6. **Ochrona przed spamem.**
   - Jedna osoba może zacząć najwyżej 20 nowych rozmów dziennie (czas polski). Odpowiadanie i pisanie w istniejących rozmowach nie ma tego limitu.
   - Najwyżej 30 wiadomości na minutę od jednej osoby.
   - Odbiorca może zablokować drugą stronę. Zablokowany nie może pisać w rozmowie 1:1 ani zacząć nowej, a widzi tylko, że wiadomości nie da się wysłać. Wątki bookingów działają dalej, bo dotyczą umówionego występu. Blokadę można zdjąć.
7. **E-mail o nieprzeczytanej wiadomości.**
   - Gdy wiadomość leży nieprzeczytana 10 minut, odbiorca dostaje jeden e-mail „Masz nową wiadomość od X” z linkiem do rozmowy.
   - Kolejny e-mail z tej samej rozmowy przyjdzie dopiero, gdy przeczyta poprzednie wiadomości.
   - Wiadomości nie trafiają do dzwonka, bo mają własny licznik. E-mail można wyłączyć w ustawieniach powiadomień („E-maile o wiadomościach”).

## 2. API

- `GET /api/v1/conversations`: rozmowy konta, najnowsza aktywność najpierw, strony po 20. Konto lokalu zawęża przez `venueId`. Każda rozmowa ma: rodzaj (`DIRECT` albo `BOOKING` z `bookingId`), drugą stronę (nazwa, slug, zdjęcie), ostatnią wiadomość i liczbę nieprzeczytanych.
- `POST /api/v1/conversations`: zaczyna albo otwiera rozmowę 1:1 (`artistSlug` albo `venueSlug`, lokal podaje też `venueId`) z pierwszą wiadomością.
- `GET /api/v1/conversations/{id}/messages`: historia od najnowszych, stronicowana kursorem (`before`, do 50 naraz).
- `POST /api/v1/conversations/{id}/messages`: wysyła wiadomość. `clientId` od przeglądarki sprawia, że ponowiona wysyłka nie tworzy duplikatu.
- `POST /api/v1/conversations/{id}/read`: oznacza przeczytane do podanej wiadomości.
- `GET /api/v1/conversations/unread-count`: licznik do menu.
- `PUT` i `DELETE /api/v1/conversations/{id}/block`: blokuje i odblokowuje drugą stronę.
- `GET /api/v1/bookings/{id}` dostaje `conversationId`, żeby szczegóły bookingu linkowały do wątku.
- WebSocket: `/ws` (STOMP). Token JWT idzie w nagłówku `CONNECT`, bez niego połączenie jest odrzucane. Każdy użytkownik subskrybuje `/user/queue/messages` i dostaje nowe wiadomości oraz „Przeczytane” ze swoich rozmów.

## 3. Reguły

- Rozmowę widzą tylko jej strony: artysta i obecny zespół lokalu. Ktoś usunięty z zespołu traci dostęp, nowy członek widzi całą historię. Inni dostają 404.
- Nowa rozmowa 1:1 wymaga opublikowanego profilu odbiorcy i opublikowanego profilu albo lokalu nadawcy.
- Kody błędów: `MESSAGING_LIMIT` (dzienny limit nowych rozmów), `MESSAGING_RATE` (za szybko), `MESSAGING_BLOCKED` (druga strona zablokowała), `MESSAGING_NOT_PUBLISHED`.
- Broker STOMP w pamięci aplikacji, bo backend działa jako jedna instancja. Przy kilku instancjach przejdziemy na zewnętrzny broker; nie zmieni to API.
- `messaging` słucha `booking.BookingRequested`, żeby założyć wątek. E-maile wysyła `notification` po zdarzeniu `MessageUnread` (nowy typ powiadomienia bez wpisu w dzwonku).
- Inne moduły (W12 dashboard) dostają fasadę `Conversations` z licznikiem nieprzeczytanych.

## 4. Poza zakresem MVP

Zgłaszanie wiadomości do moderacji (z panelem admina), załączniki, wyszukiwanie w wiadomościach, „pisze…”, push na telefon (przyjdzie z PWA w W13).

## 5. Testy

Testy integracyjne dla: kto widzi rozmowę (artysta, zespół, zmiana zespołu, obcy 404), jedna rozmowa na parę, wątek przy zapytaniu, stronicowanie kursorem, `clientId` bez duplikatów, przeczytane i licznik, limit 20 rozmów dziennie, limit na minutę, blokada (1:1 zablokowane, booking działa), e-mail po 10 minutach i tylko raz do przeczytania, WebSocket: odrzucony bez tokenu, wiadomość dociera do drugiej strony i do całego zespołu. Do tego `ModularityTest`.
