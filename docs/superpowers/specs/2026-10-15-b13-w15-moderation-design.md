# B13 + W15: Moderacja i panel admina

Status: szkic do akceptacji. Etapy według `architektura/segmenty-mvp.md`: B13 (backend) i W15 (panel `/admin` w aplikacji web), robione razem w jednym PR.

## 1. Konto administratora

- **Pierwsze konto:** backend zakłada je przy starcie z `ADMIN_EMAIL` i `ADMIN_PASSWORD`, jeśli takie konto jeszcze nie istnieje. Konto ma rolę ADMIN i potwierdzony adres. Bez tych zmiennych żadne konto admina nie powstaje.
- **Kolejnych adminów** dodaje admin w panelu, podając adres e-mail. Na ten adres idzie link do ustawienia hasła (jak reset hasła). Konto artysty ani lokalu nie może zostać adminem: to osobne konta.
- **Admin po zalogowaniu** trafia na `/admin`. Nie widzi kreatora, profilu, kalendarza, bookingów ani wiadomości, tylko panel i ustawienia konta.
- **Odebranie roli:** admin nie może zablokować ani usunąć samego siebie. Ostatni admin też nie może zostać zablokowany.

## 2. Zgłoszenia nadużyć

- **Co można zgłosić:**
  - profil artysty i profil lokalu (przycisk „Zgłoś” na `/a/{slug}` i `/v/{slug}`);
  - ogłoszenie (`/o/{id}`);
  - rozmowę (menu w rozmowie).
- **Kto zgłasza:** każdy zalogowany. Niezalogowany przechodzi przez logowanie i wraca.
- **Formularz:**
  - powód z listy: spam, oszustwo, obraźliwe treści, podszywanie się, nieprawdziwe informacje, inne;
  - opis (wymagany przy „inne”, do 1000 znaków).
- **Zgłoszenie rozmowy** zapisuje kopię ostatnich 20 wiadomości. Admin widzi tylko tę kopię, nie całą rozmowę.
- **Limity:**
  - jedno otwarte zgłoszenie tej samej rzeczy od tej samej osoby (ponowne zgłoszenie odpowiada „Już to zgłoszono”);
  - najwyżej 10 zgłoszeń dziennie od jednej osoby.
- **Zgłaszający:** dostaje potwierdzenie „Dziękujemy, sprawdzimy to”. Po rozpatrzeniu nie dostaje informacji o wyniku, żeby nie ujawniać decyzji wobec innej osoby.
- **Samego siebie** nie da się zgłosić.

## 3. Działania admina

- **Ukrycie profilu, lokalu albo ogłoszenia:**
  - profil lub lokal przestaje być publiczny, a ogłoszenie zostaje zamknięte;
  - właściciel widzi na swoim profilu „Ukryte przez moderację” z powodem i nie może sam opublikować go ponownie;
  - admin może cofnąć ukrycie; wtedy właściciel znowu może opublikować profil.
- **Zablokowanie konta:**
  - logowanie i odświeżanie sesji przestają działać, a wszystkie sesje zostają wylogowane;
  - profil, lokale, w których ta osoba jest sama, i jej ogłoszenia znikają publicznie;
  - jej oczekujące zapytania o booking zostają wycofane albo odrzucone;
  - zaakceptowane, nadchodzące bookingi zostają anulowane z powodem „Konto zostało zablokowane”, a druga strona dostaje zwykłe powiadomienie;
  - zablokowana osoba dostaje e-mail z powodem i kontaktem do zespołu.
- **Odblokowanie konta:** konto znowu się loguje. Profil i lokale zostają nieopublikowane, właściciel publikuje je sam, a anulowane bookingi się nie wracają.
- **Zamknięcie zgłoszenia:** „Rozpatrzone” (wybranym działaniem) albo „Odrzucone” (bez naruszenia), z notatką dla innych adminów.
- **Powód:** każde działanie wymaga powodu. Powód trafia do historii, a przy ukryciu i blokadzie także do właściciela.

## 4. Panel `/admin` (W15)

- **Zgłoszenia** (strona startowa):
  - kolejka otwartych zgłoszeń, najstarsze na górze, z filtrem rodzaju (profil, lokal, ogłoszenie, rozmowa);
  - zgłoszenia tej samej rzeczy są zebrane razem z liczbą zgłoszeń;
  - szczegóły pokazują zgłoszoną rzecz (podgląd profilu, ogłoszenia albo kopię rozmowy), wszystkie zgłoszenia z powodami i przyciski działań.
- **Użytkownicy:**
  - wyszukiwanie po e-mailu, pseudonimie i nazwie lokalu;
  - filtr roli i stanu (aktywne, niepotwierdzone, zablokowane, w trakcie usuwania);
  - przy koncie widać datę rejestracji, ostatnie logowanie, profil albo lokale z linkami i liczbę zgłoszeń.
  - Szczegóły konta mają akcje: zablokuj albo odblokuj, ukryj profil albo lokal, cofnij ukrycie, oraz historię działań wobec tego konta.
- **Historia:** wszystkie działania adminów (kto, kiedy, co, wobec kogo, powód), najnowsze na górze, bez możliwości edycji.
- **Admini:** lista adminów i „Dodaj admina”.
- **Licznik w menu:** liczba otwartych zgłoszeń.
- **Wygląd:** ten sam styl arcade co aplikacja. Panel działa na komputerze i na telefonie.

## 5. RODO i dane

- Zgłoszenia i historia działań wchodzą do eksportu danych (zgłoszenia, które ta osoba wysłała).
- Po usunięciu konta zgłaszającego zgłoszenie zostaje, ale bez jego danych („Usunięte konto”). Historia działań zostaje z nazwą „Usunięte konto”.
- Polityka prywatności (landing) dostaje jedno zdanie o zgłoszeniach i moderacji. Wymaga to podbicia wersji regulaminu, więc zrobię to tylko po Twojej zgodzie.

## 6. Poza zakresem

- Automatyczne wykrywanie spamu.
- Odwołania od decyzji w aplikacji (na razie przez e-mail).
- Zgłaszanie pojedynczych zdjęć.
- Statystyki dla adminów.
- Wiele poziomów uprawnień w zespole adminów.

## 7. Testy

- **Backend (integracyjne):**
  - zakładanie pierwszego admina;
  - zgłoszenia z limitami i kopią rozmowy;
  - ukrycie i cofnięcie ukrycia (profil, lokal, ogłoszenie, blokada ponownej publikacji);
  - blokada (sesje, ukrycie, bookingi, e-mail) i odblokowanie;
  - historia działań;
  - tylko ADMIN ma dostęp do `/api/v1/admin/**`.
- **Web (Vitest):** kolejka zgłoszeń, szczegóły z działaniami, lista użytkowników, formularz zgłoszenia.
- **Zrzuty e2e** w `b13-w15-screens/`.
