# Kart Competitie - testversie inschrijvingen v3

Deze versie bevat:
- publieke inschrijfpagina
- inschrijvingen in Firebase onder `kartCompetitie/inschrijvingen`
- admin-overzicht van inschrijvingen
- goedkeuren, reserve en afwijzen van inschrijvingen

## Nieuw in v3
- bij **goedkeuren** wordt de deelnemer direct toegevoegd aan **Sprint 1** en **Sprint 2** van de gekozen concept-race
- bestaande positie/punten blijven behouden als die driver al bestond
- bij **afwijzen** wordt de driver uit Sprint 1 en Sprint 2 van die race verwijderd
- bij **goedgekeurd** en **afgewezen** wordt de inschrijving direct uit de lijst met inschrijvingen verwijderd
- bij **reserve** blijft de inschrijving in de lijst staan met status `reserve`

## Let op
- deze versie verstuurt nog geen e-mails
- de inschrijvingen werken via Firebase Realtime Database


## Mail met Resend
In deze zip zit nu ook een `functions/` map voor automatische e-mails via Firebase Functions en Resend.
Zie `FIREBASE_FUNCTIONS_README.md` voor installatie en deploy.
