# Mailverzending met Firebase Functions + Resend

Deze map voegt automatische e-mails toe aan het dashboard.

## Wat er automatisch gebeurt

### Bij nieuwe inschrijving
- deelnemer krijgt een ontvangstmail
- beheerder krijgt een meldingsmail

### Bij reserve
- deelnemer krijgt een reservelijst-mail

### Bij goedgekeurd
- zodra de inschrijving naar `kartCompetitie/inschrijvingenHistorie` wordt geschreven met status `goedgekeurd`, gaat er automatisch een bevestigingsmail uit

### Bij afgewezen
- zodra de inschrijving naar `kartCompetitie/inschrijvingenHistorie` wordt geschreven met status `afgewezen`, gaat er automatisch een afwijzingsmail uit

## Installatie

1. Installeer de Firebase CLI als je die nog niet hebt.
2. Ga in terminal naar de map `functions`.
3. Voer uit:
   - `npm install`
4. Maak van `.env.example` een nieuw bestand `.env`.
5. Vul in `.env` je echte Resend sleutel en afzenderadres in.
6. Deploy daarna met:
   - `firebase deploy --only functions`

## Vereist in Resend

Je moet in Resend eerst je domein verifiëren en daarna een afzender gebruiken op dat domein.
Praktisch voorbeeld:
- `info@zwarejongens-race.nl`

## Belangrijke notities

- Zet je echte `.env` nooit in GitHub.
- Deze functies zijn ingesteld op regio `europe-west1`, passend bij jullie Realtime Database.
- De website op GitHub Pages hoeft hiervoor niet te veranderen.
