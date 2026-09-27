# Calculator profit e-commerce

Mini sistem financiar pentru un magazin online din România (plătitor de TVA): determină profitabilitatea **reală** a fiecărui produs înainte de lansare sau scalare.

- Setări companie introduse o singură dată (TVA, taxe, costuri fixe, costuri variabile, retururi/refuzuri, alocare costuri fixe).
- Evaluare produs în < 60 secunde: URL furnizor → cost → preț → CPA. Rezultatele se actualizează live.
- Override-uri per produs, costuri specifice produsului, break-even, simulator de scenarii, tabel de sensibilitate CPA, comparație 2–5 produse, dashboard.
- Salvare automată locală + **Export/Import JSON** (backup portabil, validat înainte de import).
- Funcționează complet offline, fără server și fără integrări.

## Utilizare

```bash
npm install
npm run dev      # dezvoltare: http://localhost:5173
npm test         # testele motorului de calcul și ale persistenței
npm run build    # produce dist/index.html – un SINGUR fișier
```

`dist/index.html` poate fi deschis direct în browser (dublu-click) – nu are nevoie de server. Datele se salvează în browserul în care îl deschizi; folosește **Date & backup → Exportă tot (JSON)** pentru backup.

Workflow-ul `.github/workflows/deploy.yml` publică aplicația pe GitHub Pages la fiecare push pe `main` (activează *Settings → Pages → Source: GitHub Actions*).

## Modelul financiar

Toate calculele sunt în `src/domain/engine/` – **o singură sursă de adevăr** folosită de Dashboard, Produse, Detalii, Simulator și Comparație. Rotunjirea se face doar la afișare.

Unitatea de bază este **comanda plasată**. Fiecare linie este o valoare *așteptată* per comandă plasată:

```
plasată ─┬─ refuzată            (rată refuz, % din plasate)
         ├─ nelivrată           (rată nelivrare, % din plasate)
         └─ livrată ─┬─ returnată  (rată retur, % din livrate)
                     └─ păstrată   → singura care generează venit
```

| Metrică | Formulă |
|---|---|
| Preț net | `Brut / (1 + TVA)` (TVA **nu** se calculează ca procent din brut) |
| TVA | `Brut − Net` |
| Venit fără TVA | `păstrate × (preț net × unități + taxă livrare netă)` |
| COGS / inbound / vamă | `păstrate × unități × cost` (marfa întoarsă revandabilă revine în stoc) |
| Transport, packaging, fulfillment, pick & pack, SMS, call center | per comandă expediată (toate comenzile plasate) |
| Procesare card | `(1 − pondere ramburs) × (% × valoare brută + fix)` |
| Comision ramburs | `pondere ramburs × livrate × (% × valoare brută + fix)` |
| Cost retur / refuz / nelivrare | `rată × (transport retur + procesare + % nerevandabil × unități × cost landed)` |
| Contribuție | `Venit − Costuri variabile − CPA` |
| Cost fix alocat | `Total fix / comenzi lunare` (× rată livrare, dacă baza = comenzi livrate) |
| Profit net (fully loaded) | `Contribuție − Cost fix alocat` |
| Break-even CPA | `Venit − Costuri variabile − Cost fix alocat` |
| Break-even ROAS | `Valoare brută comandă / Break-even CPA` (cum raportează platformele de ads) |
| CPA max pentru marja m | `Break-even CPA − m × Venit` |
| Preț minim pentru marja m | rezolvat exact: profitul și venitul sunt liniare în preț |
| Profit / comandă livrată | `Profit net / rată livrare` |
| Profit / zi, / lună | `Profit net × comenzi/zi (× zile/lună)` |

Valorile lipsă nu sunt inventate: se folosește valoarea din Setări sau 0, iar sursa fiecărui input este afișată (produs / override / setări / *0 · neconfigurat*).

## Structură

```
src/
  domain/          modelul de date, valori default, date demo
    engine/        motorul de calcul (inputs → core → analyze), sensibilitate, agregări, scenarii
  persistence/     schemă de validare (zod), migrări schemaVersion, export/import, localStorage
  state/           store global + router pe hash
  integrations/    contracte pentru Meta/Google/TikTok Ads, Shopify, curieri (neimplementate)
  ui/              pagini și componente (interfață 100% în română)
```

Pentru integrări viitoare (CPA automat, comenzi reale, actual vs forecast, P&L zilnic) vezi `src/integrations/types.ts`. Orice schimbare a formatului de date incrementează `SCHEMA_VERSION` și adaugă o migrare în `src/persistence/migrations.ts`, astfel încât backup-urile vechi rămân importabile.
