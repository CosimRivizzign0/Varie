# Checklist di prova dell'installer (5 minuti)

Serve per verificare che l'app si installi e che i dati non vadano persi. Non servono competenze tecniche: segui i passi in ordine e spunta ogni riga.

## A. Scaricare e installare

1. [ ] Apri GitHub, vai nella scheda **Actions** del repository e clicca l'ultima esecuzione (run) con la spunta verde.
2. [ ] In fondo alla pagina, nella sezione **Artifacts**, scarica `ai-act-assessment-windows` (se hai Windows) oppure `ai-act-assessment-macos` (se hai un Mac). Decomprimi il file zip scaricato.
3. **Windows:**
   1. [ ] Fai doppio clic sul file `.msi` (oppure sul `.exe`).
   2. [ ] Se compare l'avviso blu di SmartScreen ("Windows ha protetto il PC"), clicca **Ulteriori informazioni** e poi **Esegui comunque**.
   3. [ ] Completa l'installazione e apri **AI Act Assessment** dal menu Start.
4. **macOS:**
   1. [ ] Fai doppio clic sul file `.dmg` e trascina l'app nella cartella **Applicazioni**.
   2. [ ] Al primo avvio fai clic destro (o Ctrl+clic) sull'app e scegli **Apri**, poi conferma con **Apri**.
   3. [ ] Se il Mac la blocca comunque: **Impostazioni di Sistema → Privacy e sicurezza**, scorri in basso e clicca **Apri comunque**.

## B. Provare i dati

5. [ ] Crea un cliente reale (anche uno tuo): ragione sociale, partita IVA, settore, referente.
6. [ ] Dentro quel cliente aggiungi un sistema di intelligenza artificiale.
7. [ ] Chiudi completamente l'app e riaprila. **Il cliente e il sistema devono essere ancora presenti.**
8. [ ] Crea un secondo sistema AI di prova e clicca **Sposta nel cestino**: **deve comparire una finestra di conferma.** Conferma.
9. [ ] Apri il **Cestino**, clicca **Elimina definitivamente** sul sistema di prova e, nella finestra di conferma, clicca **Annulla**. **Il sistema deve essere ancora nel cestino.**

## C. Backup

10. [ ] Controlla che nella cartella dei backup ci sia almeno un file:
   - Windows: `%APPDATA%\com.cosimorivizzigno.aiactassessment\backup` (incolla il percorso nella barra di Esplora file)
   - macOS: `~/Library/Application Support/com.cosimorivizzigno.aiactassessment/backup` (in Finder: **Vai → Vai alla cartella**, poi incolla il percorso)
11. [ ] Nell'app clicca **Esporta backup** e salva il file sul **Desktop**.
12. [ ] Clicca **Ripristina backup**, scegli il file appena salvato sul Desktop e conferma. Deve comparire «Backup ripristinato.» e i dati devono essere ancora tutti presenti, compreso il sistema di prova nel cestino.

## D. Valutazione AI Act

13. [ ] Apri il cliente di prova, aggiungi un sistema AI con scopo «Selezione del personale» e ruolo **Deployer (utilizzatore)**, poi clicca **Conferma inventario**.
14. [ ] Apri il sistema e, nel riquadro **Valutazione AI Act**, clicca **Avvia valutazione**.
15. [ ] Rispondi alle domande: **Sì** alla prima (e' un sistema di IA), **Sì** a «Il sistema e' usato per selezionare personale…», **No** a tutte le altre. Usa **Avanti** tra le sezioni. Chiudi l'app a meta' e riaprila: dal riquadro, **Riprendi** deve mostrare le risposte gia' date.
16. [ ] All'ultima sezione clicca **Vai all'esito**: **deve comparire «Alto rischio»**, con motivazione e obblighi (tra questi gli articoli 26 e 86).
17. [ ] Clicca **Conferma classificazione**: deve comparire «Confermata il…» con la data di oggi.
18. [ ] Torna alla pagina iniziale (clic su **AI Act Assessment**): nella riga del cliente la roadmap deve mostrare **80%** e la prossima azione **Genera i report**.

## E. Report Word ed Excel

19. [ ] Apri **Impostazioni** (dalla pagina iniziale), compila nome, indirizzo, partita IVA, email e telefono dello studio e clicca **Salva**: deve comparire «Impostazioni salvate.»
20. [ ] Apri il cliente di prova e clicca **Genera report**. Scegli una cartella (ad esempio il Desktop): in fondo alla scheda deve comparire l'elenco dei **File creati** (un Word per il sistema confermato e un Excel dell'inventario). I sistemi senza valutazione confermata sono elencati con «Non incluso: classificazione non confermata».
21. [ ] Apri il file `.docx` con **Word**. Controlla: intestazione con i dati dello studio, titolo con nome del sistema e cliente, classe **Alto rischio**, motivazione, tabella degli obblighi, date nel formato gg/mm/aaaa e, in fondo, la nota di riserva («…non costituisce parere legale definitivo»). Se le regole non sono ancora validate, in alto deve comparire l'avviso «Documento basato su regole non ancora validate…».
22. [ ] Apri il file `.xlsx` con **Excel**. Controlla: fogli **Inventario** e **Obblighi**, riga di intestazione in grassetto e bloccata con filtro, colonne delle date mostrate come date (gg/mm/aaaa) e non come numeri.
23. [ ] Clicca di nuovo **Genera report** nella stessa cartella: i file dello stesso giorno vengono sovrascritti (nessun duplicato).
24. [ ] Dalla pagina **Esito** del sistema clicca **Esporta Word** e salva il file con «Salva con nome»: deve aprirsi in Word come il precedente.
25. [ ] Torna alla pagina iniziale: nella riga del cliente la roadmap deve mostrare **100%** e **Assessment completato**.

Consiglio: tieni attivata la cifratura del disco (BitLocker su Windows, FileVault su Mac), perché i dati dei clienti sono salvati sul computer.

## Se qualcosa non va

Non preoccuparti: manda indietro
- uno **screenshot** di quello che vedi (anche del messaggio di errore);
- il **numero del passo** di questa lista in cui ti sei fermato;
- se Windows o Mac.
