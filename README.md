# Kart Competitie - Rebuild admin fix

Deze versie bevat:
- werkende openbare leaderboard
- admin paneel zonder vastlopen
- Firebase realtime sync
- 2 slechtste sprints worden geschrapt
- gemiste races tellen als 0 + 0
- positie 0 = 0 punten
- uitslagen bewerken blijft aanwezig

## Let op
In deze versie blijft admin.html laden, ook als je nog niet bent ingelogd.
Je kunt dan de stand zien, maar pas na inloggen kun je wijzigen.

- drivernaam autocomplete toegevoegd in het beheerpaneel
- autocomplete vult nu ook automatisch aan bij unieke match, bijvoorbeeld `San` -> `Sander Weggen`

- concept-races toegevoegd: je kunt nu een race klaarzetten zonder posities
- concept-races tellen niet mee in de stand of live leaderboard tot ze volledig zijn ingevuld

- race overzicht heeft nu tabs om te wisselen tussen alle races of één specifieke race
- race overzicht heeft nu een duidelijke filterbox met dropdown én tabs
- optie 'Alle races' verwijderd uit de filter op admin en live leaderboard
- live leaderboard: seizoensstand en race overzicht onder elkaar gezet
- live leaderboard: race geschiedenis verwijderd
- live leaderboard racefilter hersteld: dropdown en tabs zijn nu zichtbaar boven Race overzicht

- tie-break popup hersteld: bij gelijke punten vraagt opslaan nu echt om snelste tijd

- tie-break aangepast: bij gelijke punten worden Sprint 1 en Sprint 2 tijd ingevoerd
- de 2 tijden worden opgeteld, en de laagste totaaltijd komt bovenaan

- admin paneel syntaxfix: dubbele functie in admin.js verwijderd zodat Firebase weer normaal laadt


## Testversie met inschrijvingen
- nieuwe pagina: `inschrijven.html`
- nieuwe Firebase node: `kartCompetitie/inschrijvingen`
- admin toont nu inschrijvingen en statusknoppen
- nog zonder automatische e-mailverzending

- goedgekeurde en reserve-inschrijvingen worden nu automatisch toegevoegd aan de juiste concept-race onder `registrations`
- afgewezen inschrijvingen worden uit die race-lijst verwijderd
