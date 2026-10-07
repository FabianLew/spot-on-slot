# W10: ekrany wiadomości

Status: zaakceptowana przez Fabiana 2026-10-07. Etap według `architektura/segmenty-mvp.md`: W10, na backendzie z B11 (PR #24).

## 1. Zakładka „Wiadomości” (`/messages`)

- **Lista rozmów, najnowsza aktywność na górze.** Przy każdej rozmowie widać:
  - zdjęcie i nazwę drugiej strony;
  - początek ostatniej wiadomości i jej czas;
  - licznik nieprzeczytanych.
- **Wątki bookingów** mają znacznik „Booking” z datą występu.
- **Konto z kilkoma lokalami** zawęża listę przełącznikiem lokalu (jak w Bookingach). Domyślnie widzi wszystkie swoje lokale.
- **Komputer:** lista po lewej, otwarta rozmowa po prawej.
- **Telefon:** najpierw lista, a rozmowa otwiera się na całym ekranie z przyciskiem „Wróć”.
- **Adres rozmowy** to `/messages/{id}`. Ten sam link jest w e-mailu o nieprzeczytanej wiadomości.
- **Pusta lista** wyjaśnia, jak zacząć rozmowę: przyciskiem „Napisz” na profilu artysty albo lokalu.

## 2. Rozmowa

- **Nagłówek:**
  - nazwa drugiej strony z linkiem do jej profilu;
  - w wątku bookingu link „Zobacz booking”;
  - w rozmowie 1:1 menu z „Zablokuj” albo „Odblokuj”.
- **Wiadomości:**
  - moje po prawej, drugiej strony po lewej;
  - oddzielone dniami (czas polski), z godziną przy każdej wiadomości;
  - w zespole lokalu wiadomości współpracowników też są po stronie „moje”, bo lokal odpowiada jako całość.
- **„Przeczytane”** pod moją ostatnią wiadomością, którą druga strona już przeczytała.
- **Przewinięcie do góry** doczytuje starsze wiadomości, po 50 naraz.
- **Pole wiadomości:**
  - Enter wysyła, Shift+Enter dodaje nową linię;
  - licznik znaków pojawia się przy końcu limitu 2000.
- **Wysyłanie:**
  - wiadomość pojawia się od razu jako „Wysyłanie…”;
  - po błędzie ma „Nie wysłano” z przyciskiem „Spróbuj ponownie”;
  - ponowienie nie tworzy duplikatu.
- **Błędy:**
  - po przekroczeniu limitu na minutę pole pokazuje komunikat z backendu;
  - w zablokowanej rozmowie zamiast pola jest informacja „W tej rozmowie nie można teraz pisać” (z „Odblokuj”, jeśli to ja blokuję).
- **Odczytanie:** otwarta rozmowa oznacza wiadomości jako przeczytane, gdy karta jest na wierzchu.

## 3. Na żywo

- **Jedno połączenie na zalogowaną sesję** (WebSocket, STOMP na `/ws`). Token idzie przy łączeniu.
- **Ponowne łączenie:** po zerwaniu aplikacja łączy się sama, w razie potrzeby z odświeżonym tokenem.
- **Co dociera od razu:** nowe wiadomości trafiają do otwartej rozmowy, na listę i do licznika w menu; „Przeczytane” też pojawia się bez odświeżania.
- **Bez połączenia:** lista i licznik odświeżają się co minutę jako zapas, a po powrocie połączenia otwarta rozmowa doczytuje to, co przyszło w międzyczasie.
- **Adres WebSocket** wynika z adresu API, więc nie trzeba nowej zmiennej środowiskowej.

## 4. Licznik w menu

Pozycja „Wiadomości” w menu bocznym i na dolnym pasku na telefonie dostaje licznik rozmów z nieprzeczytanymi wiadomościami, jak Bookingi.

## 5. Gdzie zaczyna się rozmowa

- **„Napisz”:**
  - lokal widzi ten przycisk na profilu artysty `/a/{slug}`;
  - artysta widzi go na profilu lokalu `/v/{slug}`;
  - przycisk prowadzi do `/messages/new?artist=…` albo `?venue=…`.
- **Ekran nowej wiadomości:**
  - pole pierwszej wiadomości;
  - konto z kilkoma lokalami wybiera, w imieniu którego pisze;
  - po wysłaniu otwiera się rozmowa;
  - jeśli rozmowa z tą osobą już istnieje, przycisk od razu otwiera ją.
- **Wymóg publikacji:** bez opublikowanego profilu albo lokalu ekran mówi, że trzeba go najpierw opublikować, i linkuje do profilu.
- **Booking:** szczegóły bookingu mają przycisk „Wiadomości”, który otwiera wątek tego bookingu.
- **Niezalogowany** odwiedzający po kliknięciu „Napisz” przechodzi przez logowanie i wraca.

## 6. Ustawienia

W panelu powiadomień (`/settings#notifications`) dochodzi przełącznik „E-maile o nieprzeczytanych wiadomościach” (domyślnie włączony).

## 7. Poza zakresem

Dashboard z licznikiem (W12), powiadomienia push (W13), wyszukiwanie w wiadomościach, załączniki, „pisze…”.

## 8. Testy

- **Vitest:**
  - lista i przełącznik lokalu;
  - wysyłanie z „Wysyłanie…” i ponowieniem;
  - doczytywanie starszych;
  - „Przeczytane”;
  - blokada;
  - ekran nowej wiadomości (istniejąca rozmowa, brak publikacji);
  - licznik w menu;
  - przychodzące wiadomości z połączenia na żywo (połączenie zastąpione atrapą).
- **Zrzuty ekranu:** komputer i telefon, w `/mnt/project-files/w10-screens/`, z dwiema przeglądarkami, żeby było widać wiadomość docierającą na żywo.
