# Dokładny model Szkółki (offline)

## Reprodukcja

Z katalogu `/opt/data/dice-poker/site` (GCC + Python 3, bez bibliotek Pythona):

```sh
g++ -O3 -std=c++17 -fopenmp -ffp-contract=off model-school/generate.cpp -o model-school/generate
OMP_NUM_THREADS=4 model-school/generate .
python3 model-school/finalize.py
python3 model-school/test_model.py
```

Nie używać `-ffast-math` ani `-DNDEBUG`: asercje pilnują geometrii, indeksów i skończonych wartości dzieci. Generator oblicza cały LUT przed zapisem; nie publikuje częściowo wypełnionych warstw. `finalize.py` dodaje SHA-256 i rzeczywiste rankingi oraz sprawdza niezależny oracle. Po każdej regeneracji należy wykonać wszystkie trzy kroki. Plik wykonywalny i `__pycache__` są artefaktami lokalnymi, nie są konieczne w dystrybucji strony.

## Kontrakt

- `school-model.json`: version=1, layout=`standard-school-sum-extra`, `sumStride=3752`, 64 offsety i 64 listy sum.
- `sumsByRemaining[H]` to wszystkie osiągalne **przeszłe** sumy pól należących do dopełnienia H. Listy posortowane rosnąco. Nie wolno obcinać sum ani zastępować nieosiągalnej sumy najbliższą.
- `school-values.bin`: 960512 kolejnych liczb IEEE-754 Float64 little-endian, dokładnie 7684096 bajtów.
- Indeks elementu: `((A*3752 + sumOffsets[H] + sumsByRemaining[H].indexOf(s))*2 + e)`.
- Maska łączna: `A | (H<<7)`. Kategorie 0–6: para, dwie pary, trójka, street, full, kareta, poker; 7–12: S1–S6.
- `e=1`: czwarty rzut dostępny; `e=0`: niedostępny. 64 nieosiągalne graniczne sloty dostępności są celowo wypełnione zgodnie z tym samym Bellmanem.
- V zawiera wyłącznie przyszłe punkty, przyszły koszt rzutu i końcową korektę. Nie zawiera przeszłych punktów ani przeszłego kosztu. Terminalne V to B(s), a nie zero.

## Algorytm i dokładność

Warstwy według liczby wolnych kategorii. Dzieci każdego zapisu są w poprzedniej warstwie. W turze pełne wyliczenie wszystkich 252 multizbiorów stołu, 462 multizbiorów blokad i 4368 par blokady/stół. Ważone średnie to dokładny rozkład multinomialny uczciwych kości, obliczany w Float64; „dokładny” oznacza wyczerpujące DP bez heurystyki, nie arytmetykę wymierną bez błędu zaokrągleń.

Każda krawędź geometrii dodaje trwale jedną blokadę. Maksimum propagowane po odwrotnej kolejności topologicznej wylicza wszystkie legalne nadzbiory aktualnej blokady. Blokada wszystkich pięciu kości nie jest akcją rzutu. Rzut 4 zużywa token i odejmuje 10 dokładnie raz. Rzut 1 ma oddzielne punkty, nawet gdy wcześniej przerzucono wszystkie kości.

W optymalizacji Standard można pominąć skreślenie wtedy, gdy dodatni zapis **tej samej kategorii** jest dostępny: obie akcje mają identyczną kontynuację. W eksporcie rankingu obie akcje pozostają obecne. Dla SN istnieje tylko rzeczywisty wynik, bez sztucznego zera.

Bezstratna optymalizacja offline: dla ustalonego H sumy s grupowane są po pełnym wektorze `[B(s+t) dla wszystkich osiągalnych przyszłych t pól H]`. Identyczne wektory mają identyczne wypłaty każdej polityki, więc identyczne optimum; po zapisie SN każde `q+t` należy do zbioru przyszłych sum rodzica. Obliczamy jeden reprezentant, kopiując wynik do wszystkich równoważnych slotów. Eksport nadal ma pełne 960512 slotów. Nie stosujemy obcięcia s, próbkowania, syntetycznych liści ani Float32.

## Testy i fixture

`test_model.py`:

- RED przed kodem: brak reguł, generatora i prawdziwego eksportu; dodatkowy RED przed eksportem fixture/hash.
- Wszystkie N=1..6, M=0..5, rzuty 1..4; progi -1/0/10/11; naturalne zero, brak skreślenia SN i zawsze legalne skreślenie Standard.
- Rozmiar i skończoność wszystkich 960512 liczb, wszystkie terminale.
- **256/256 wartości Standard H=0,s=0 jest identycznych bitowo z `values.json`**, nie tylko w tolerancji.
- Niezależne jednopólkowe końcówki SN: binomialny expectimax, dla 6 kategorii, obu stanów tokena i sum -12/-1/0/10/11/18. Dla pojedynczego SN wypłata q+B(s+q) jest monotoniczna względem liczby trafień; blokowanie nietrafień jest zdominowane. Oracle nie używa LUT do wyliczania tych wartości.
- 12 niezależnie sprawdzonych pełnych rankingów bieżącej tury: rekurencja po legalnych blokadach, rozkłady z enumeracji uporządkowanych wyników kości, bez produkcyjnego grafu geometrii. W wielokategoriowych fixture wartości granic kolejnej tury pochodzą z LUT. Weryfikowane są wszystkie akcje, nie tylko najlepsza.

`school-fixtures.json` ma `positions`, każda zawiera `state`, posortowane malejąco `actions`, `ev` i `independentlyVerified`. `state`: `mask`, `standardMask`, `schoolRemaining`, `schoolSum`, `extra`, `roll`, `counts[6]`, `locked[6]`. Akcje: `{type:'score',category,points,ev}` albo `{type:'reroll',hold:[6],ev}`. Łącznie 14 pozycji; dwa pełne pierwsze rzuty nie mają oddzielnego rekurencyjnego sprawdzenia i są jawnie oznaczone false. Remisy numeryczne należy porównywać tolerancją, nie kolejnością identyfikatorów.

CLI do dodatkowych rzeczywistych rankingów:

```sh
# --query ROOT A H s e r  sześć liczności stołu  sześć liczności blokad
model-school/generate --query . 127 63 0 1 1  0 0 1 1 0 3  0 0 0 0 0 0
```

## Wynik zmierzonego przebiegu

GCC 14.2, cztery wątki: pełny generator około 13,3 s (nie czas przeglądarki ani gwarancja wydajności telefonu).

- EV start bez tokena: 128.3276148236228.
- EV start z tokenem: 129.02053313659823.
- Maksymalny błąd rankingu względem niezależnej rekurencji: 2.842170943040401e-14.
- SHA-256 LUT: `d94718eb4729d036f5f8e89afb5a779aac2dd050a249d26d5254786dbf5c3ead`.

Nie zmieniono plików Standard, UI ani workerów. Nie wykonywano commit/push.
