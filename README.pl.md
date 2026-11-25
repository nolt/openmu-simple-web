# openmu-simple-web

🇬🇧 [English version](README.md)

Prosta strona internetowa dla serwera OpenMU.

Strona powstała dla mojego zestawu do budowania serwera OpenMU: https://github.com/nolt/openmu-docker  
Łączy się z tą samą siecią Dockera, w której działa baza danych.

Strona jest wielojęzyczna: angielski i polski.

## Co oferuje strona:
- rejestracja nowego konta
- zmiana hasła
- status serwera
- ranking TOP 10
- informacje o eventach (BC/DS/CC itd.)
- armory (podgląd ekwipunku postaci): obrazek klasy postaci i opisy przedmiotów jak w grze
  (statystyki, wymagania, opcje, bonusy zestawów ancient, sockety); rendery klas, obrazki przedmiotów
  i dane przedmiotów w `wwwroot/data` pochodzą z klienta gry MU Online (MuMain, Season 6)
- lista komend czatu

## Wymagania
- Docker
- Docker Compose

## Budowanie
- sklonuj to repozytorium
- podmień wartości w `.env` na własne
- zbuduj

Zbuduj usługę:

```docker compose up -d --build```

## Licznik graczy online (klucz API OpenMU)

Licznik graczy online czyta `/api/status` z panelu administracyjnego OpenMU (port 8080).
OpenMU chroni swoje API kluczami: gdy tylko powstanie pierwsze konto administratora, zapytania
bez klucza dostają `401` i licznik znika.

1. W panelu administracyjnym otwórz **API keys**, utwórz klucz (np. `website`) z rolą **Viewer**
   i skopiuj go — jest pokazywany tylko raz.
2. Wpisz go do `.env` jako `SERVER_CHECK_API_KEY=...` i zrestartuj stronę.

Klucz jest wysyłany po stronie serwera w nagłówku `X-Api-Key`; nigdy nie trafia do przeglądarki.
Zrób to przed utworzeniem pierwszego administratora, żeby licznik nie znikał.

## Dodawanie nowego języka

Wszystkie podstrony korzystają z jednego układu Razor (`Pages/Shared/_Layout.cshtml`), więc dodanie
języka oznacza edycję **jednej listy w konfiguracji** — bez zmian w poszczególnych podstronach (tylko
opisy przedmiotów w armory mają własny plik tekstów, patrz krok 4).

1. **Utwórz plik tłumaczenia**
   - Skopiuj `wwwroot/template_lang.js` (pusty szkielet ze wszystkimi kluczami) — albo już
     przetłumaczony `wwwroot/en.js` — pod nazwą z kodem swojego języka, np. `de.js` dla niemieckiego.
   - Zmień klucz obiektu w linii 2 (`window.muTranslations.xx`) na swój kod, np. `.de`.
   - Uzupełnij każdą wartość swoim tłumaczeniem.

2. **Zarejestruj go w konfiguracji strony**
   Dodaj kod do tablicy `Site:Languages` w `appsettings.json` — to jedyne miejsce, w którym
   trzymana jest lista języków. Wspólny układ automatycznie wstawia znacznik `<script>` dla
   każdego języka z listy na każdej podstronie:
   ```json
   "Site": {
     "Languages": [ "en", "pl", "de" ],
     "DefaultLanguage": "en"
   }
   ```

3. **Uzupełnij content.js (opcjonalnie)**
   Stawki i tekst powitalny na stronie głównej pochodzą z `window.muContent` w `wwwroot/content.js`.
   Dodaj tam sekcję swojego języka, według tego samego wzoru co `en` i `pl`.

4. **Przetłumacz opisy przedmiotów w armory (opcjonalnie)**
   Teksty tooltipa mają własny plik: skopiuj `wwwroot/js/item-texts.pl.js` np. do
   `item-texts.de.js`, zmień `window.muItemTexts.pl` na `.de`, przetłumacz wartości (kluczami są
   teksty angielskie) i dołącz plik w `Pages/Armory.cshtml` obok polskiego. Bez tego tooltip zostaje
   po angielsku.

5. **Gotowe**
   `lang.js` sam buduje przyciski przełączania z każdego języka znalezionego w
   `window.muTranslations` — bez ręcznej edycji przycisków na podstronach. Etykietą przycisku jest
   kod wielkimi literami (np. `DE`); ładniejszą etykietę ustawisz, dodając wpis do mapy `LABELS`
   w `wwwroot/lang.js`.

Żeby strona domyślnie startowała w innym języku, ustaw `Site:DefaultLanguage` (np. `"de"`) w
`appsettings.json`. Ta jedna wartość jest przekazywana do `lang.js`; podstron nie trzeba edytować.

## Ustawianie linków do pobrania

Menu pobierania na stronie głównej jest sterowane przez `window.muConfig.downloads` w
`wwwroot/content.js`. Każdy wpis to jedna pozycja:

```js
downloads: [
    { id: "launcher", icon: "🚀", name: "Launcher", url: "https://...", recommended: true },
    { id: "android",  icon: "📱", name: "Android",  url: "#", soon: true },
    { id: "linux",    icon: "🐧", name: "Linux",    url: "https://..." },
    { id: "windows",  icon: "🪟", name: "Windows",  url: "https://..." },
],
```

- `url` — link do pobrania. **Dostarczone wartości to zaślepki `#` — ustaw własne.**
- `recommended` — wyróżnia pozycję (np. launcher z automatyczną aktualizacją).
- `soon` — pokazuje ją jako zapowiedź, bez możliwości kliknięcia.

Platformę dodajesz lub usuwasz, edytując tę listę — bez zmian w kodzie strony. Ogólne etykiety
(Pobierz / zalecane / wkrótce) pochodzą z kluczy `dl*` w plikach językowych.

Link do Discorda w szczegółach na stronie głównej (`url` wpisów `Discord` w `window.muContent`,
po jednym na język) to również zaślepka `#` — wpisz tam zaproszenie na swój serwer.

---
Przykład:
![Strona](assets/example.webp)
---
Więcej informacji o projekcie OpenMU:
https://github.com/MUnique/OpenMU

## Licencja
[MIT](LICENSE)

Autor oryginalny: [Nolt](https://github.com/nolt).
