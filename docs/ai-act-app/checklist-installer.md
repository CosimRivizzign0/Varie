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

Consiglio: tieni attivata la cifratura del disco (BitLocker su Windows, FileVault su Mac), perché i dati dei clienti sono salvati sul computer.

## Se qualcosa non va

Non preoccuparti: manda indietro
- uno **screenshot** di quello che vedi (anche del messaggio di errore);
- il **numero del passo** di questa lista in cui ti sei fermato;
- se Windows o Mac.
