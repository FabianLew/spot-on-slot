# B12 + W11: powiadomienia (moduł `notification`)

Status: zaakceptowany przez Fabiana 2026-10-06 (w MVP bez RabbitMQ, zdarzenia Modulith, Rabbit później przez `@Externalized`; alert pomija zabookowanych w terminie). Etap według `architektura/segmenty-mvp.md`: B12 (backend) i W11 (dzwonek i ustawienia). Ten szkic proponuje zrobić je teraz, przed bookingiem (sekcja 8).

## 1. Co użytkownicy dostają

1. **Alert „nowe ogłoszenie w okolicy”**, gdy ktoś opublikuje ogłoszenie, które do nich pasuje:
   - **„Szukam artysty” (lokal) → artyści.** Dostaje go artysta z opublikowanym profilem, gdy:
     - lokal leży w jego zasięgu dojazdu (z profilu, domyślnie 50 km, liczone od jego przybliżonego punktu);
     - ogłoszenie ma choć jeden jego gatunek (ogłoszenie bez gatunków pasuje do wszystkich);
     - artysta nie ma zarezerwowanego czasu (BOOKED w kalendarzu), który zachodzi na termin ogłoszenia.
     - Brak wolnego slotu nie wyklucza (pusty dzień to dziś „niedostępny”, a mało kto wypełni kalendarz na tygodnie naprzód). Jeśli artysta ma wtedy wolne, alert to mówi („Masz wtedy wolne”).
   - **„Jestem wolny” (artysta) → lokale.** Dostaje go każda osoba z zespołu opublikowanego lokalu (właściciel i menedżerowie), gdy:
     - lokal leży w zasięgu dojazdu z ogłoszenia (domyślnie z profilu artysty);
     - lokal gra choć jeden gatunek z ogłoszenia;
     - lokal nie ma zaakceptowanego bookingu, który zachodzi na termin ogłoszenia. Lokale nie mają dziś kalendarza, więc ten warunek zacznie działać z bookingiem (B10, fasada `Bookings`); do tego czasu nic nie wyklucza.
   - **„Zabookowany” znaczy: czas zachodzi na termin ogłoszenia**, a nie cały dzień. Artysta grający 22:00–02:00 nadal dostanie alert o sobotnim popołudniu, a lokal z jednym artystą na wieczór może szukać supportu przez inne ogłoszenie, ale nie dostanie „Jestem wolny” na tę samą godzinę.
   - **Nigdy nie dostaje go autor** ani zespół lokalu, który ogłoszenie dodał. Osoba w kilku pasujących lokalach dostaje jeden alert (z nazwą najbliższego lokalu).
   - Alert idzie raz, przy publikacji. Nowi użytkownicy w okolicy nie dostają alertów o starszych ogłoszeniach (od tego jest wyszukiwarka). Edycja ogłoszenia nie wysyła drugiego alertu.
2. **Lista powiadomień (dzwonek)** w aplikacji: najnowsze na górze, nieprzeczytane wyróżnione, licznik na dzwonku, „Oznacz wszystkie jako przeczytane”. Kliknięcie otwiera ogłoszenie (`/o/{id}`) i oznacza jako przeczytane. Ogłoszenie już zamknięte lub wygasłe pokazuje się wyszarzone z dopiskiem „Nieaktualne”.
3. **E-mail** z tym samym alertem: tytuł, termin, miasto, odległość, gatunki, budżet lub stawka, przycisk „Zobacz ogłoszenie” i link „Wyłącz te powiadomienia” (działa bez logowania).
4. **Ustawienia powiadomień** (W11, w „Ustawieniach”), osobno dla każdej kategorii:
   - kanały: w aplikacji (zawsze włączony), e-mail (wł./wył.), push (pojawi się z PWA/aplikacją mobilną);
   - dla alertów o ogłoszeniach dodatkowo: wł./wył., promień (artysta: domyślnie zasięg dojazdu z profilu; lokal: 50 km; 5–200 km) i gatunki (domyślnie te z profilu).
   - E-maile konta (weryfikacja, reset hasła, zaproszenie do zespołu) nie podlegają ustawieniom.

Kategorie w MVP: „Ogłoszenia w okolicy” teraz; „Booking” i „Wiadomości” dojdą w B10/B11 jako kolejne typy, bez zmian w mechanizmie.

## 2. Domyślne ustawienia i limity

- **Domyślnie włączone:** alerty o ogłoszeniach w aplikacji i e-mailem.
- **Limit e-maili:** najwyżej 5 e-maili z alertami o ogłoszeniach na osobę na dobę (czas polski). Kolejne trafiają tylko do aplikacji. Booking (B10) limitu mieć nie będzie.
- **Nieaktualne przed wysłaniem:** jeśli ogłoszenie zamknięto lub wygasło, zanim e-mail wyszedł, e-mail się nie wysyła.
- **Przechowywanie:** powiadomienia starsze niż 90 dni są usuwane.
- **Podsumowanie dzienne** zamiast pojedynczych e-maili: po MVP, jeśli limit okaże się za mało.

## 3. Asynchroniczność: RabbitMQ czy to, co już mamy

Propozycja Fabiana: RabbitMQ, żeby to samo zdarzenie odebrać później w aplikacji web i mobilnej.

| | Zdarzenia Spring Modulith + rejestr publikacji (już działa) | RabbitMQ |
|---|---|---|
| Asynchronicznie, po commicie | Tak (`@ApplicationModuleListener`, osobna transakcja i wątek) | Tak |
| Zdarzenie nie ginie przy awarii | Tak, zapisuje się w tej samej transakcji co ogłoszenie (to jest outbox), niedokończone wznawiają się po restarcie | Tylko z outboxem po stronie aplikacji; bez niego zapis do bazy i wysłanie do kolejki mogą się rozjechać |
| Dostarczenie do przeglądarki i telefonu | Nie bezpośrednio | Też nie: przeglądarka i aplikacja mobilna nie łączą się z Rabbitem. Do nich trafia się przez WebSocket (B11), web push lub Expo Push |
| Koszt | Zero, działa w testach i lokalnie | Kolejny kontener w produkcji i w Testcontainers, monitoring, kolejka błędów, konfiguracja |
| Kiedy się opłaca | Jeden backend (MVP) | Kilka instancji backendu lub osobne usługi |

**Rekomendacja: w MVP bez RabbitMQ, ale z furtką.** To, co ma trafić do web i mobile, to zapisane powiadomienie, a nie wiadomość z kolejki. Każde powiadomienie publikuje zdarzenie `NotificationCreated`, a kanały są jego słuchaczami: e-mail teraz, WebSocket z B11, push z PWA (W13) i z Expo. Gdy backend wyjdzie poza jedną instancję, ten sam `NotificationCreated` wypychamy do RabbitMQ zmianą konfiguracji (`spring-modulith-events-amqp`, adnotacja `@Externalized`), a Rabbit posłuży też jako broker STOMP dla WebSocketu. Kod modułów się nie zmienia.

## 4. Jak to działa

1. `listing` publikuje `ListingPublished` (już istnieje: rodzaj, autor, termin, gatunki, punkt).
2. `notification` w słuchaczu wyszukuje odbiorców przez fasady:
   - artyści: `Locations.findWithin` (do 200 km) → `ArtistProfiles` (opublikowany, gatunki, zasięg dojazdu, nowa metoda dla powiadomień) → bez tych z czasem BOOKED w terminie (nowa metoda `Availability.bookedAmong`, odpowiednik `freeAmong`);
   - lokale z bookingiem w terminie odpadają po B10;
   - lokale: `Venues.findPublishedWithin` + członkowie zespołu (nowa metoda w `Venues`);
   - filtr ustawień odbiorcy (promień, gatunki, wyłączone).
3. Dla każdego odbiorcy zapisuje wiersz `notification` (jedna transakcja) i publikuje `NotificationCreated`.
4. Słuchacz e-mail sprawdza ustawienia, limit dzienny i czy ogłoszenie jest wciąż aktywne (`Listings`), potem wysyła przez istniejący `MailSender` w języku odbiorcy. Błąd wysyłki zostawia zdarzenie w rejestrze do ponowienia.
5. Górny limit odbiorców na jedno ogłoszenie: 1000 najbliższych (jak w wyszukiwarce).

**Tabele (Flyway):**
- `notification`: odbiorca, typ, dane do wyświetlenia (jsonb: ogłoszenie, nazwa, miasto, termin, odległość), `read_at`;
- `notification_preference`: użytkownik, kategoria, kanały, promień, gatunki;
- `notification_email_log`: do limitu dziennego.
- Rejestracja urządzeń push (`notification_device`) dopiero z W13.

**API:**
- `GET /api/v1/notifications` (strony), `GET /api/v1/notifications/unread-count`;
- `POST /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all`;
- `GET`/`PUT /api/v1/notifications/preferences`;
- `POST /api/v1/public/notifications/unsubscribe?token=` (link z e-maila, podpisany, nagłówek `List-Unsubscribe` dla jednego kliknięcia w Gmailu).

**Odświeżanie w aplikacji:** licznik pobierany co 60 s i przy powrocie do karty. Gdy B11 da WebSocket, licznik i nowe powiadomienia przyjdą od razu, bez zmian w API.

## 5. Prywatność

- Alert o artyście pokazuje pseudonim, miasto i odległość zaokrągloną do kilometra; nigdy dokładnego punktu ani imienia i nazwiska.
- E-mail ma link wypisania i informację, dlaczego przyszedł („bo jesteś w promieniu 50 km i grasz techno”).

## 6. Ekrany (W11)

- **Dzwonek** w pasku bocznym (desktop) i w górnym pasku (mobile) z licznikiem; lista jako panel (desktop) lub osobny ekran `/notifications` (mobile).
- **Ustawienia → Powiadomienia:** przełączniki kanałów, promień (suwak), gatunki (`ChoiceChips`).
- Teksty w `messages/{pl,en}.json`, styl pikselowy jak reszta aplikacji.

## 7. Testy

- Integracyjne: kto dostaje alert (promień, zasięg dojazdu, gatunki, artysta zarezerwowany w terminie pominięty, autor i jego zespół wykluczeni, deduplikacja zespołów), ustawienia, limit e-maili, ogłoszenie zamknięte przed wysyłką, wypisanie z linku, ponowienie po błędzie SMTP (Mailpit/GreenMail).
- Web: dzwonek i licznik, oznaczanie przeczytanych, formularz ustawień.

## 8. Kolejność etapów

W `segmenty-mvp.md` B12 i W11 są po bookingu i wiadomościach. Proponuję teraz, po W8: B12 (powiadomienia in-app i e-mail, alerty o ogłoszeniach, ustawienia) → W11 (dzwonek i ustawienia). Booking (B10) i wiadomości (B11) dodadzą swoje typy powiadomień do gotowego mechanizmu. Web push zostaje przy PWA (W13), push mobilny przy aplikacji Expo.
