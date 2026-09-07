# Kości / EV

Statyczny doradca pokera kościanego: pięć kości, odłożone kości, zajęte kategorie, numer rzutu i dostępność dodatkowego rzutu. Ranking czterech najlepszych legalnych ruchów według EV do końca gry. Obliczenia lokalnie w przeglądarce; bez API, śledzenia i kont użytkowników.

## Uruchomienie

Serwuj katalog dowolnym serwerem statycznym (np. `python3 -m http.server 8765`) i otwórz http://localhost:8765. Otwarcie samego HTML przez file:// nie wystarczy: przeglądarka musi pobrać lokalną tabelę values.json.

## Model Standard

- 7 kategorii i tur: para, dwie pary, trójka, street, full, kareta, poker.
- Pierwszy rzut podwaja sumę kości figury. Bonus pokera +50 nie jest podwajany.
- Do 3 rzutów; raz na grę zakup czwartego za 10 pkt, wynik może być ujemny.
- Odłożone kości nie wracają do puli przerzutu.
- Każde wolne pole można zawsze skreślić za 0.
- Większe grupy mogą tworzyć mniejsze: kareta jako dwie pary tej samej wartości, poker jako full.
- `values.json`: dokładne wartości przyszłych tur dla każdej maski wolnych kategorii i dostępności dodatkowego rzutu; wyeksportowane z pełnego solvera Bellmana w Pythonie. Początkowe EV: 109.45553649387382.
- `solver.js`: dokładne programowanie dynamiczne w obrębie tury, pełne prawdopodobieństwa wielomianowe. Wszystkie legalne ruchy rankingowane, równoważne wybory identycznych kości łączone. Brak próbkowania Monte Carlo podczas rankingu.
- EV obejmuje punkty od bieżącej pozycji do końca gry. Prognoza to wynik netto + EV. Wynik netto jest wyliczany z tabeli i dostępności dodatkowego rzutu; przy czwartym rzucie koszt jest już uwzględniony i nie jest odejmowany ponownie od EV.

## Testy

`node test-solver.cjs` — porównanie EV każdego legalnego ruchu w 100 pozycjach z niezależną oceną optymalnej polityki Python. Zestaw zawiera różne numery rzutów, maski, blokady i żetony.

`bun install` — zależności testów przeglądarkowych.

`node test-ui.cjs` — wymaga lokalnego serwera na porcie 8765 i Chromium w /usr/bin/chromium. `TEST_URL` pozwala testować opublikowaną stronę. Testy desktop/mobile, zapis/skreślenie, blokady, zakup rzutu, zakończona gra, niepoprawne dane, suma EV i błędy JavaScript.

`node test-ui-state.cjs` — regresje loadera i stanu „Nieaktualne” dla wszystkich wejść, zmian/resetu podczas pracy, błędów danych, pobierania modelu i workera. Testy opóźniają wyłącznie dostarczenie odpowiedzi prawdziwego solvera, nie zastępują obliczeń. Zrzuty desktop/mobile w `test-artifacts/`.

`node test-ui-focus.cjs` — regresje autofokusu desktop/mobile: pojedyncza cyfra 1–6 przenosi do kolejnej kości i zaznacza całą jej wartość, szybkie wpisanie pięciu cyfr, brak zapętlenia, niepoprawne dane oraz brak automatycznego przeliczenia. Emulacja telefonu sprawdza także zdarzenia wejściowe bez `keydown`.

Pola kości używają `type="text"` z `inputmode="numeric"`, ponieważ pola `number` nie zapewniają przenośnej obsługi zaznaczania tekstu. Po piątej kości fokus zostaje na miejscu; przeliczenie nadal wymaga przycisku.

Obliczenia działają w `solver-worker.js`, poza wątkiem interfejsu. Pierwszy wynik wczytuje się automatycznie; dalsze zmiany (także „Nowa gra”) oznaczają wynik jako nieaktualny do kliknięcia przycisku. Odpowiedzi dla zmienionych wejść są odrzucane.

## Tabela punktów i wynik netto — Standard

- Każda figura ma opcjonalny wynik: nieujemną liczbę całkowitą. Puste pole wnosi 0 do sumy, ale nie zajmuje figury; wpisane `0` zajmuje figurę. Sam checkbox nadal pozwala oznaczyć zajętą figurę bez znanej punktacji.
- „Zapisz punkty” przy sugestii zapisuje **rzeczywiste punkty figury** (`points`), a przy skreśleniu dokładnie `0` — nigdy EV. Przy odłożeniu/przerzucie przycisk jest nieaktywny z opisem „Najpierw wykonaj rzut”.
- Wynik netto nad tabelą to **suma punktów tabeli − 10, jeśli dodatkowy rzut jest niedostępny**. Nie ma ręcznego banku ani offsetu. Prognoza to wyłącznie **wynik netto + EV**.
- Edycja punktów aktualizuje sumę. Odznaczenie zajętej figury czyści jej wynik. Wyczyszczenie samego pola punktów pozostawia checkbox zajęty.
- Dostępność dodatkowego rzutu jest źródłem kosztu: odznaczenie checkboxa odejmuje 10, ponowne zaznaczenie przywraca 10. Wybór rzutu 4 automatycznie odznacza i blokuje checkbox. Zakup wymaga potwierdzenia i zużywa dostępność, nie nalicza drugiej opłaty. Nowa tura zachowuje zużyty rzut.
- Każda edycja dezaktywuje stare przyciski aż do przeliczenia. Kontrola rewizji i jednorazowości blokuje ponowny zapis oraz nadpisanie zajętej figury, także podczas odpowiedzi workera.
- Zapis nie resetuje kości, blokad ani numeru rzutu. Kolejną pozycję ustaw ręcznie. „Nowa gra” czyści punkty i przywraca dostępność dodatkowego rzutu oraz wynik 0. Dane nie są utrwalane po odświeżeniu strony.
- Niepoprawne liczby blokują przeliczenie i aktualizację punktów tabeli; popraw dane zgodnie z komunikatem.

`node test-ui-scores.cjs` — opcjonalne punkty i zero, wynik netto/dostępność/koszt czwartego rzutu, prognoza bez podwójnej opłaty, zapis punktów zamiast EV, stale/double-save/occupied guards, opóźniony worker, walidacja, reset i screenshoty `net-score-{1440,390,320}.png`. Logi RED/GREEN i zrzuty w `test-artifacts/`.

## Losowanie kości

- „Losuj wszystkie” losuje niezależnie wszystkie 5 oczek 1–6 (wynik może się powtórzyć), ustawia rzut 1 i czyści blokady. Nie zmienia tabeli, wyniku netto ani dostępności dodatkowego rzutu. To rozpoczęcie nowej tury, nie obejście limitu przerzutów obecnej.
- „Losuj pozostałe” zmienia tylko nieodłożone kości i zwiększa numer rzutu. Po trzecim wymaga dostępnego żetonu i potwierdzenia kosztu 10 pkt. Anulowanie pozostawia pozycję bez zmian; akceptacja zużywa żeton i ustawia rzut 4, co zmniejsza wynik netto o 10. Ujemny wynik jest dozwolony.
- Przerzut jest nieaktywny po rzucie 4, po rzucie 3 bez żetonu lub gdy wszystkie kości są odłożone. Przyczyna jest wyświetlana pod przyciskami. Ręczna edycja pozycji pozostaje dostępna.
- Losowanie unieważnia ranking i stare przyciski zapisu, także przy trwających obliczeniach. Nie uruchamia automatycznego przeliczenia.
- `node test-ui-random.cjs`: deterministyczne wyniki losowania w testach, blokady, limity, anulowanie/zakup, jednorazowy koszt, zachowanie tabeli i wyniku netto, zakup przy pustej tabeli, reset, opóźniony worker oraz zrzuty 1440/390/320 px.

## Szkółka — osobny wariant

Duże przyciski **Standard / Szkółka** przełączają niezależne pozycje (kości, blokady, tabela, rzut, dostępność). Reset dotyczy tylko aktywnego wariantu. Dane pozostają w pamięci strony, nie po odświeżeniu. Ładowanie i przełączenie może przeliczyć ranking; edycja, zapis i losowanie wymagają jawnego „Porównaj najlepsze ruchy”.

- 13 pól: Standard 0–6, S1–S6 na indeksach 7–12. `mask` wskazuje wolne pola: 127 w Standard, 8191 w Szkółce. Zapytanie Szkółki zawiera także `sumSN`, sumę zapisanych S1–S6.
- Szkółka N daje `N*(M-3)`, gdzie M to liczba kości z N oczkami; przy pierwszym rzucie i M ≥ 3 dochodzi +N. Zapis ujemny i naturalne zero są legalne. Nie istnieje dobrowolne skreślenie SN za zero.
- Zajęte SN wymaga znanej wartości z `N*{-3,-2,-1,0,1,2,3}`. Pola przyjmują znak minus (pełna klawiatura na telefonie). Standard zachowuje opcjonalne, nieujemne wyniki.
- Bieżące netto to Standard + SN − 10, jeśli dodatkowy rzut jest niedostępny. Suma SN i korekta pokazywane są oddzielnie. Korekta końcowa: −30 dla sumy <0, 0 dla 0–10, +30 dla >10. Dodajemy ją do głównego wyniku dopiero po zajęciu 13 pól.
- **Prognoza = bieżące netto bez korekty + EV**. Model już uwzględnia końcową korektę, również kiedy wszystkie szkoły są zajęte, a pozostają figury Standard.

### Worker i pliki modelu

`solver-worker.js` dostaje `{type:'load',mode,id}`, odpowiada `{type:'ready',mode,id}` lub `fatal`. Zapytanie `{type:'rank',mode,id,revision,state}` daje `{type:'result',mode,id,revision,all}` albo `error`. Przełączenie kończy poprzedniego workera; kontrola trybu, identyfikatora i rewizji dodatkowo odrzuca spóźnione odpowiedzi. Błędy kończą loader. Po błędzie modelu można przełączyć wariant i wrócić, aby ponowić pobranie.

Standard pobiera tylko `solver.js` i `values.json`. Dopiero wybór Szkółki importuje `school-solver.js` oraz pobiera `school-model.json` i `school-values.bin`; używa `new DicePokerSchool.Engine(metadata,new Float64Array(buffer))`. Model może korzystać z cache HTTP; pamięć workera jest zwalniana przy przełączeniu. Nie ma zastępczego ani syntetycznego EV przy braku modelu. Przed konstrukcją silnika worker weryfikuje SHA-256 pliku binarnego zgodnie z metadanymi (HTTPS lub localhost). Kontrakt i reprodukcja generatora: `model-school/README.md`.

`node test-ui-school.cjs` — testy rzeczywistego UI, lazy load, niezależnych stanów, wymaganej i osiągalnej punktacji, znaku minus, terminalnej korekty, kosztu rzutu oraz braku przewijania poziomego w 1440/390/320 px. Po dostępności rzeczywistego modelu także regresja **S1–S6 = 0, wszystkie 7 figur Standard wolne → identyczne EV Standard**, zapis ujemnego SN i brak fałszywego skreślenia. Brak plików modelu jest jawnie raportowany jako `BLOCKED`, nie jako przejście integracji EV. Zrzuty: `test-artifacts/school-{1440,390,320}.png`.

### Weryfikacja modelu i wydajności

- `python3 model-school/test_model.py` — testy rzeczywistego LUT i niezależnej wyroczni.
- `node test-school-solver.cjs --require-model` — porównanie granic i rankingów ze Standard, szkółkowe końcówki i równania Bellmana.
- `node test-school-integrity.cjs` — uszkodzony LUT o poprawnym rozmiarze jest odrzucany; odzyskanie Standard i ponowne wczytanie prawidłowej Szkółki.
- `node test-school-performance.cjs` — rzeczywisty worker i renderowanie w Chromium, limit 1 s po gotowości modelu, 40 pozycji dla każdej szerokości 1440/390 px. Pobranie/inicjalizacja mierzone osobno. Emulowany viewport mobilny nie jest pomiarem fizycznego telefonu. Wyniki w `test-artifacts/school-performance.json`.

## Hosting

GitHub Pages, gałąź main, katalog główny. Aplikacja nie wymaga procesu backendowego, kluczy ani płatnych usług. Repozytorium zawiera aplikację, testy, model oraz odtwarzalny generator offline Szkółki.
