# W2: kreator po rejestracji

Status: szkic do akceptacji Fabiana. Etap według `architektura/segmenty-mvp.md`: W2 (`apps/web`), na backendzie B3, B4 i B5. Kreator można pominąć (Fabian wybrał 2026-10-06).

## 1. Co użytkownik dostaje

1. Po pierwszym zalogowaniu osoba bez profilu trafia na `/onboarding`, czyli kreator na pełny ekran w stylu arcade z makiet:
   - pasek kroków u góry;
   - pod nim jeden krok naraz;
   - przyciski „Dalej” i „Wstecz”.
2. Artysta przechodzi cztery kroki:
   1. pseudonim i gatunki (1–5 z listy, nazwy PL/EN);
   2. zdjęcie główne (`ImagePicker` z B2);
   3. lokalizacja (zgoda przeglądarki albo wybór miasta z podpowiedzi, `LocationPicker` z B3);
   4. podsumowanie z podglądem karty i wyborem: „Opublikuj profil” albo „Zostaw szkic”.
3. Klub przechodzi cztery kroki:
   1. nazwa i typ lokalu;
   2. adres: wpisanie adresu z podpowiedziami, a wybrana podpowiedź uzupełnia ulicę, kod i miasto, z możliwością poprawki ręcznie;
   3. gatunki grane w lokalu i zdjęcie główne;
   4. podsumowanie z publikacją albo szkicem.
4. Każdy krok zapisuje się od razu. Kto przerwie, przy następnym wejściu wraca do pierwszego niezrobionego kroku, który wynika z listy `missingForPublication` z backendu.
5. Kreator można pominąć („Uzupełnię później”). Wtedy na pulpicie stoi karta „Dokończ profil” z liczbą brakujących rzeczy, aż profil zostanie opublikowany. Pominięcie pamięta przeglądarka, więc kreator nie wyskakuje przy każdym wejściu.
6. Po zakończeniu kreatora użytkownik trafia na pulpit. Pełna edycja (opis, linki, stawki, galeria, zespół lokalu) przyjdzie w W3 i W4, a kreator na koniec do niej odsyła.

Poza zakresem:
- pełne formularze profilu i strona publiczna (W3, W4);
- zespół lokalu i zaproszenia (W4);
- przełącznik lokali (W4): kreator zakłada pierwszy lokal, kolejne doda W4.

## 2. Jak to działa w aplikacji

- **Wejście do kreatora:** w `(app)/layout.tsx` po `AuthGate` działa `OnboardingGate`. Gdy profilu jeszcze nie ma i kreator nie był pominięty, przekierowuje na `/onboarding`:
  - dla artysty brak profilu oznacza 404 z `GET /api/v1/artists/me`;
  - dla klubu oznacza pustą listę z `GET /api/v1/venues/mine`.
- **Strona:** `/onboarding` ma własny układ, bez paska bocznego, ale z logo, językiem, motywem i wylogowaniem.
- **Zapis:** każdy krok wysyła pełny profil (`PUT /api/v1/artists/me`, `POST` albo `PUT /api/v1/venues/{id}`), łącząc nowe pola z tym, co już zapisane, żeby nic nie ginęło.
- **Lokalizacja artysty:** `PUT /api/v1/locations/me`.
- **Adres klubu:** podpowiedzi z `GET /api/v1/locations/search` (pola `street`, `postalCode`, `city` i punkt z B5).
- **Teksty:** PL/EN w `messages`, w tym nazwy gatunków (`genres.*`) i typów lokali (`venueTypes.*`), które przydadzą się też w W3 i W4.
- **Błędy:**
  - błędy walidacji z backendu trafiają do pól przez `applyServerErrors`;
  - brak geokodera daje komunikat z ikoną i możliwość wpisania adresu ręcznie.
- **Komponenty:** w `packages/ui` dochodzą `Stepper` (pasek kroków) i `ChoiceChips` (wybór gatunków), z tekstami z propsów.

## 3. Testy

- Vitest + Testing Library:
  - kroki artysty i klubu z mockowanym `fetch`;
  - powrót do pierwszego niezrobionego kroku;
  - pominięcie i karta na pulpicie;
  - `OnboardingGate` dla obu ról i dla osoby z profilem;
  - `Stepper` i `ChoiceChips` w `packages/ui`.
- Sprawdzenie end-to-end z prawdziwym backendem (stub Photon):
  - rejestracja artysty i klubu, przejście kreatora, publikacja;
  - zrzuty ekranu desktop i mobile, jasny i ciemny motyw, do `w2-screens/`.

## 4. Decyzje domyślne (do zmiany jednym słowem)

1. Kreator można pominąć, a pulpit przypomina o profilu.
2. Kreator pyta tylko o to, co potrzebne do publikacji; resztę uzupełnia się w W3 i W4.
3. Na końcu kreatora użytkownik sam wybiera publikację albo szkic.
4. Każdy krok zapisuje się od razu, a powrót trafia do pierwszego brakującego kroku.
5. Pominięcie pamięta przeglądarka (bez zapisu w backendzie).
