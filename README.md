# Kości / EV

Statyczny doradca pokera kościanego: pięć kości, odłożone kości, zajęte kategorie, numer rzutu i dostępność dodatkowego rzutu. Ranking trzech najlepszych legalnych ruchów według EV do końca gry. Obliczenia lokalnie w przeglądarce; bez API, śledzenia i kont użytkowników.

## Uruchomienie

Serwuj katalog dowolnym serwerem statycznym (np. `python3 -m http.server 8765`) i otwórz http://localhost:8765. Otwarcie samego HTML przez file:// nie wystarczy: przeglądarka musi pobrać lokalną tabelę values.json.

## Model

- 7 kategorii i tur: para, dwie pary, trójka, street, full, kareta, poker.
- Pierwszy rzut podwaja sumę kości figury. Bonus pokera +50 nie jest podwajany.
- Do 3 rzutów; raz na grę zakup czwartego za 10 pkt, wynik może być ujemny.
- Odłożone kości nie wracają do puli przerzutu.
- Każde wolne pole można zawsze skreślić za 0.
- Większe grupy mogą tworzyć mniejsze: kareta jako dwie pary tej samej wartości, poker jako full.
- `values.json`: dokładne wartości przyszłych tur dla każdej maski wolnych kategorii i dostępności dodatkowego rzutu; wyeksportowane z pełnego solvera Bellmana w Pythonie. Początkowe EV: 109.45553649387382.
- `solver.js`: dokładne programowanie dynamiczne w obrębie tury, pełne prawdopodobieństwa wielomianowe. Wszystkie legalne ruchy rankingowane, równoważne wybory identycznych kości łączone. Brak próbkowania Monte Carlo podczas rankingu.
- EV obejmuje punkty od bieżącej pozycji do końca gry. Opcjonalny wynik dotychczasowy jest wyłącznie dodawany do prognozy. Przy czwartym rzucie koszt został już zapłacony: dotychczasowy wynik powinien zawierać odjęte 10.

## Testy

`node test-solver.cjs` — porównanie EV każdego legalnego ruchu w 100 pozycjach z niezależną oceną optymalnej polityki Python. Zestaw zawiera różne numery rzutów, maski, blokady i żetony.

`bun install` — zależności testów przeglądarkowych.

`node test-ui.cjs` — wymaga lokalnego serwera na porcie 8765 i Chromium w /usr/bin/chromium. `TEST_URL` pozwala testować opublikowaną stronę. Testy desktop/mobile, zapis/skreślenie, blokady, zakup rzutu, zakończona gra, niepoprawne dane, suma EV i błędy JavaScript.

`node test-ui-state.cjs` — regresje loadera i stanu „Nieaktualne” dla wszystkich wejść, zmian/resetu podczas pracy, błędów danych, pobierania modelu i workera. Testy opóźniają wyłącznie dostarczenie odpowiedzi prawdziwego solvera, nie zastępują obliczeń. Zrzuty desktop/mobile w `test-artifacts/`.

Obliczenia działają w `solver-worker.js`, poza wątkiem interfejsu. Pierwszy wynik wczytuje się automatycznie; dalsze zmiany (także „Nowa gra”) oznaczają wynik jako nieaktualny do kliknięcia przycisku. Odpowiedzi dla zmienionych wejść są odrzucane.

## Hosting

GitHub Pages, gałąź main, katalog główny. Aplikacja nie wymaga procesu backendowego, kluczy ani płatnych usług. Repozytorium zawiera wyłącznie aplikację i jej testy.
