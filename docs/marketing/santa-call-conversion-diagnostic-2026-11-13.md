# TDG Santa Call România — diagnostic conversie și funnel

**Audit:** 10–13 noiembrie 2026, cutoff 13 noiembrie 2026, 09:23 Europe/Bucharest (07:23 UTC). Producția a fost verificată read-only. Nu s-au schimbat campanii, bugete, prețuri, checkout sau Stripe și nu s-a creat nicio tranzacție.

## 1. Executive verdict

Cauza principală susținută de date este pierderea de intenție **după vizita landingului și înainte de personalizare/checkout**, amplificată de măsurare fragmentată. În cohorta Meta calificată pentru 11–12 noiembrie au fost 116 sesiuni de landing, 11 clickuri de personalizare, 3 formulare începute, 3 finalizate și 3 checkout-uri. Asta înseamnă 9,5% landing→CTA și 2,6% landing→checkout. Nu există dovadă că plata Stripe este defectă: plata LIVE test confirmată de proprietar a reușit, accesul a fost acordat și emailul de livrare a fost generat.

În paralel, Meta a raportat doar 32 LPV la 209 link clicks pentru 10–12 noiembrie (15,3%), în timp ce colectorul propriu a găsit 116 landing sessions pentru cohorta Facebook din 11–12. Definițiile și fusurile orare diferă, iar Meta este pe Pacific Time. Prin urmare, nu putem concluziona că 85% dintre clickuri au eșuat să încarce pagina. Cel mai probabil avem două probleme simultane: **fricțiune/promise gap pe landing și tracking nealiniat**.

Schimbarea cu cea mai mare probabilitate de a produce primele vânzări profitabile este un experiment de dovadă și claritate în primul ecran: demonstrație explicită că Moșul răspunde în timp real pe numele copilului, cu CTA și preț vizibile. Înainte de a interpreta prețul sau de a scala bugetul, trebuie reparată reconcilerea surselor și măsurată o cohortă suficientă.

## 2. Confirmed facts

- Produsul afișează 59 lei / 3 minute și prelungire opțională 49 RON / 5 minute.
- Landingul LIVE s-a încărcat pe desktop și mobil; redirectul către `www` păstrează parametrii UTM.
- Formularul are numele copilului și emailul părintelui obligatorii, detalii opționale și confirmare tutore/AI/termeni.
- În captura de formular, CTA-ul „Continuă la plată · 59,00 RON” este vizibil, dar formularul ocupă o etapă separată și cere consimțământ explicit.
- O singură plată LIVE de 59 RON din 11 noiembrie a fost confirmată de utilizator ca **test intern**; a fost exclusă din conversia clienților. Stripe a confirmat succesul, entitlement `ready`, email trimis și apel de 4 secunde. Nu o consider vânzare.
- În 10–12 noiembrie Meta: 12.222 impresii, 209 link clicks, 32 LPV, 130,91 USD cheltuiți, CTR link 1,71%, LPV/link 15,31%. Meta afișează datele în Pacific Time.
- Cohorta Facebook calificată, fus Pacific: 11 nov. 28 landing → 5 CTA → 2 form starts → 2 complete → 2 checkout; 12 nov. 88 → 6 → 1 → 1 → 1. Total: 116 → 11 → 3 → 3 → 3.
- Datele proprii pentru 10 noiembrie lipsesc; lipsa rândurilor nu înseamnă zero vizitatori. Pentru 13 noiembrie până la cutoff: 35 landing sessions și 1 CTA, fără formular/checkout.
- În Stripe au fost 8 sesiuni relevante inspectate: 1 plătită (testul confirmat), 5 expirate, 2 deschise; sesiunile neplătite nu aveau PaymentIntent, deci motivul abandonului nu este cunoscut.

## 3. Tracking integrity

| Sistem / verificare | Verdict | Doveadă / limită |
|---|---|---|
| GA4 ID și rutare | UNKNOWN | ID `G-YF2GRM2TL4`, property `550164226`; accesul server-side lipsește, nu s-a putut reconcilia UI-ul GA4. |
| Meta Pixel | PARTIAL | Santa folosește `1673980440653322`; site-ul general folosește `1581639566935542`. Rutarea directă a landingului este corectă, dar pixelul optimizat al ad setului trebuie confirmat în Meta. |
| Evenimente Santa | PARTIAL | Page/CTA/form/checkout și Purchase browser-side există; Purchase este protejat prin sessionStorage și event ID. CAPI Santa nu a fost identificat. |
| Meta ↔ server | FAIL pentru reconciliere | 32 LPV Meta vs. 116 landing sessions Facebook în cohorta 11–12; fusuri, definiții și filtre diferite. |
| GA4/Clarity | UNKNOWN | Tokenul GA4 este gol/invalid pentru raportare server-side; Clarity export nu a furnizat date. |
| UTM/fbclid | PARTIAL | UTM și `fbclid` ajung în colector; `fbp/fbc` nu au fost observate pe traseul Santa. |
| Consent/browser | PARTIAL | Evenimente third-party sunt condiționate de consimțământ; testul Chrome a avut extensie ad-block care a blocat un script Pixel, deci nu este test reprezentativ pentru utilizatorii obișnuiți. |
| Performance | PASS pentru test sintetic | Chrome desktop fără throttling: LCP 1,49 s, CLS 0, INP 144 ms. Nu este RUM și nu reprezintă Facebook In-App Browser sau rețele mobile. |

## 4. Funnel table

| Etapă | Meta / server evidence | Conversie etapă | Abandon / interpretare |
|---|---:|---:|---|
| Impressions | 12.222 | — | Reach/creative data incompletă: fără retenție video, placement sau frecvență. |
| Link clicks | 209 | 1,71% CTR | Nu este egal cu sesiuni unice. |
| LPV Meta | 32 | 15,3% click→LPV | Definiție/fus diferit; nu trebuie tratat ca eroare de încărcare. |
| Facebook landing sessions (11–12, calificat) | 116 | — | Măsurare proprie, nu GA4. |
| CTA personalizare | 11 | 9,5% landing→CTA | Pierdere principală observabilă pe funnelul propriu. |
| Form start | 3 | 27,3% CTA→form | Fricțiune sau lipsă de încredere. |
| Form complete | 3 | 100% start→complete | Eșantion mic; nu indică încă o problemă de formular. |
| Checkout created | 3 | 100% complete→checkout | Checkoutul funcțional în test. |
| Paid customer orders | 0 | 0% checkout→customer | Plata 59 RON a fost test intern și exclusă. |

## 5. Creative diagnosis

**Confirmat:** creativa a generat clickuri (209 în 10–12 nov.), deci nu este lipsă totală de atenție. CTR-ul este modest, 1,71%, dar fără benchmark, placement și retenție nu pot declara creativa bună sau slabă.

**Necunoscut:** video plays, ThruPlays, retenție, frecvență, vârstă/gen/dispozitiv/placement și comentarii nu au fost accesibile în raportul disponibil. Nu se poate separa oboseala creativă de nepotrivirea publicului.

**Ipoteză comercială:** reclama promite o conversație personală cu un copil; landingul arată în principal un hero video decorativ și text. Lipsește o dovadă imediat vizibilă, în aceeași pagină, a interacțiunii în timp real. Aceasta trebuie testată printr-o variantă controlată, nu tratată ca fapt.

## 6. Landing page diagnosis

- **Claritate:** oferta, prețul și durata apar; pe desktop hero-ul este foarte înalt, iar CTA-ul nu domină primul viewport. Pe mobil, formularul este clar, dar bula de suport poate acoperi zona emailului la anumite poziții.
- **Promise gap:** textul explică AI și personalizarea, însă demonstrația live cu numele copilului nu este suficient de imediată pe primul ecran. „Exemplu de conversație” este o invitație/text, nu o dovadă vizuală completă.
- **Fricțiune:** două câmpuri obligatorii, detalii opționale și checkbox legal înainte de plată. Este justificat pentru produs, dar ordinea și microcopy-ul trebuie testate.
- **Încredere:** există securizare Stripe, termeni și confidențialitate. Nu există încă dovadă socială măsurată (număr real de familii/copii fericiți, testimoniale verificabile); nu recomand inventarea acestor cifre.
- **Mobil:** captura arată layout funcțional, dar suportul plutitor poate suprapune câmpul email. Validarea nativă a browserului a apărut în engleză la test fără completare; nu este o eroare de plată, dar poate crea fricțiune.
- **Performanță:** test sintetic bun; lipsesc date de câmp și Facebook In-App Browser.

## 7. Offer and pricing diagnosis

Stripe a reținut 1,89 RON din plata de 59 RON (net înainte de AI/taxe: 57,11 RON). Tariful standard Stripe EEA publicat este 1,5% + 1 RON; contul și metoda concretă pot varia. TVA-ul standard în România este 21% din august 2025, dar regimul fiscal al vânzătorului nu este disponibil, deci prezint scenarii, nu o concluzie fiscală.

| Preț | Stripe estimat* | Net înainte de AI/TVA | Net după TVA inclusă, înainte de AI |
|---:|---:|---:|---:|
| 59 RON | 1,89 RON | 57,11 RON | 46,87 RON |
| 49 RON | 1,74 RON | 47,26 RON | 38,76 RON |
| 39 RON | 1,59 RON | 37,41 RON | 30,64 RON |

\* Modelul folosește 1,5% + 1 RON, nu modifică tariful live.

Costurile AI reale pe apel complet nu sunt disponibile; valoarea 0,00 a testului de 4 secunde nu poate fi extrapolată. Formula de CAC maxim este: `preț − Stripe − cost AI − taxe − cost fulfillment − marjă minimă`. La aceeași rată de conversie, 49 RON cere aproximativ 21% mai multe comenzi decât 59 RON pentru aceeași contribuție brută, iar 39 RON aproximativ 53% mai multe. Nu există suficient volum pentru a recomanda scăderea prețului.

## 8. Top 3 blocaje

1. **Dovadă insuficientă a valorii în landing / CTA până la personalizare** — impact probabil mare, încredere medie. Doar 11 din 116 landing sessions Facebook au ajuns la personalizare.
2. **Tracking nealiniat între Meta, colectorul propriu, GA4 și Clarity** — impact analitic critic, încredere mare. Nu putem aloca bugetul sau diagnostica LPV fără un ID comun și aceeași zi/fus.
3. **Fricțiune și încredere la trecerea spre formular** — impact probabil mediu, încredere medie-scăzută. 3 form starts din 11 CTA; bula suport și checkboxul legal pot contribui, dar eșantionul este prea mic pentru cauzalitate.

## 9. Exact next actions (maxim 5)

1. **Instrumentare separată, testată înainte de deploy:** un `funnel_session_id` stabil, UTM/fbclid/fbp/fbc, timestamp UTC și evenimente server/browser cu aceeași schemă; dashboard-ul trebuie să arate distinct Meta, GA4, Clarity, server și Stripe.
2. **Experiment landing proof-first:** păstrează prețul și checkoutul; testează o variantă cu clip real scurt sau transcriere audio „Bună, Sofia”, subtitrare, „răspunde în timp real”, 59 lei/3 minute și CTA în primul viewport. Asignare stabilă pe visitor, fără schimbări de campanie în timpul măsurării.
3. **Reducere fricțiune mobilă:** verifică bula de suport să nu acopere inputuri, adaugă mesaje de validare în română și măsoară separat CTA→form→complete.
4. **Reconcilează Meta pe fusul Pacific și serverul pe UTC/București** pentru aceleași ferestre; confirmă pixelul Santa și evenimentul de optimizare al ad setului înainte de orice decizie de buget.
5. **Construiește modelul de contribuție cu finance:** cost AI pentru 180 secunde, TVA/regim fiscal, refund/fulfillment și marja minimă; abia apoi testează prețul 59 vs 49, nu 39 simultan.

## 10. Experiment plan

**Experiment principal (proof-first):** A = landing actual; B = aceeași ofertă/preț, dar demonstrație interactivă de 10–15 secunde și CTA în primul viewport. 50/50 prin cookie/local storage sau server assignment stabil; nu schimba ad setul. Evenimente obligatorii: `landing_view`, `cta_click`, `form_start`, `form_complete`, `checkout_created`, `paid_order`, toate cu session ID comun.

**Buget și durată:** nu recomand creșterea bugetului. Rulează în bugetul existent, cu minimum 7 zile și minimum 30 checkout starts cumulate înainte de concluzie; dacă volumul rămâne mic, raportează direcțional, nu „winner”.

**Decizie:** principal metric `paid_order / qualified landing session`; secundare CTA rate, form completion, checkout→paid, CAC și contribuție netă. Oprește experimentul doar pentru eroare funcțională sau diferență clară de calitate/venit după volum suficient; nu schimba live prețul în același test.

## Surse și limite

- Artefacte read-only: [`evidence-2026-11-13`](./evidence-2026-11-13/), inclusiv capturi desktop/mobile, reconciliere Meta, agregate DB, Stripe și răspunsuri provider.
- Stripe pricing: https://stripe.com/en-ro/pricing
- TVA standard România: https://static.anaf.ro/static/10/Anaf/AsistentaContribuabili_r/Cotele_de_TVA_09.2025.pdf
- Nu au fost expuse secrete, emailuri, identificatori personali sau date despre copii. API-urile GA4/Meta/Clarity nu au putut furniza raportare completă din cauza credentialelor lipsă/invalide; aceste valori sunt marcate UNKNOWN, nu zero.
