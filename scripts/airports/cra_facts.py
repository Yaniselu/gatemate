import json, sys
ROOT = sys.argv[1]
LANGS = ['ro', 'es', 'fr', 'de', 'it']

X = {}
def tr(en, ro, es, fr, de, it):
    X[en] = (ro, es, fr, de, it)
    return en

facts = [
    ('business-outline', tr('Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Terminal'),
     tr('“George (Gogu) Constantinescu”, opened on 18 December 2025. All flights use it since 20 December 2025.',
        '„George (Gogu) Constantinescu”, inaugurat pe 18 decembrie 2025. Toate zborurile pleacă de aici din 20 decembrie 2025.',
        '«George (Gogu) Constantinescu», inaugurada el 18 de diciembre de 2025. Todos los vuelos la usan desde el 20 de diciembre de 2025.',
        '« George (Gogu) Constantinescu », inauguré le 18 décembre 2025. Tous les vols l’utilisent depuis le 20 décembre 2025.',
        '„George (Gogu) Constantinescu“, eröffnet am 18. Dezember 2025. Alle Flüge nutzen es seit dem 20. Dezember 2025.',
        '“George (Gogu) Constantinescu”, inaugurato il 18 dicembre 2025. Tutti i voli lo usano dal 20 dicembre 2025.')),
    ('resize-outline', tr('Size', 'Suprafață', 'Superficie', 'Surface', 'Fläche', 'Superficie'),
     tr('About 32,000 m² over several levels: basement, ground floor and two upper floors.',
        'Circa 32.000 m² pe mai multe niveluri: subsol, parter și două etaje.',
        'Unos 32.000 m² en varios niveles: sótano, planta baja y dos plantas.',
        'Environ 32 000 m² sur plusieurs niveaux : sous-sol, rez-de-chaussée et deux étages.',
        'Rund 32.000 m² auf mehreren Ebenen: Untergeschoss, Erdgeschoss und zwei Obergeschosse.',
        'Circa 32.000 m² su più livelli: seminterrato, piano terra e due piani.')),
    ('people-outline', tr('Capacity', 'Capacitate', 'Capacidad', 'Capacité', 'Kapazität', 'Capacità'),
     tr('Up to 2 million passengers a year. The 500,000th passenger of 2026 landed in August.',
        'Până la 2 milioane de pasageri pe an. Pasagerul cu numărul 500.000 din 2026 a aterizat în august.',
        'Hasta 2 millones de pasajeros al año. El pasajero 500.000 de 2026 aterrizó en agosto.',
        'Jusqu’à 2 millions de passagers par an. Le 500 000e passager de 2026 a atterri en août.',
        'Bis zu 2 Millionen Passagiere pro Jahr. Der 500.000. Fluggast 2026 landete im August.',
        'Fino a 2 milioni di passeggeri l’anno. Il 500.000° passeggero del 2026 è atterrato ad agosto.')),
    ('airplane-outline', tr('Runway', 'Pistă', 'Pista', 'Piste', 'Piste', 'Pista'),
     tr('09/27, 2,500 × 45 m, with ILS on runway 27.', '09/27, 2.500 × 45 m, cu ILS pe pista 27.', '09/27, 2.500 × 45 m, con ILS en la pista 27.',
        '09/27, 2 500 × 45 m, avec ILS sur la piste 27.', '09/27, 2.500 × 45 m, mit ILS auf Piste 27.', '09/27, 2.500 × 45 m, con ILS sulla pista 27.')),
    ('location-outline', tr('Address', 'Adresă', 'Dirección', 'Adresse', 'Adresse', 'Indirizzo'),
     tr('Calea București 325, about 7 km east of the city centre.', 'Calea București 325, la circa 7 km est de centrul orașului.',
        'Calea București 325, a unos 7 km al este del centro.', 'Calea București 325, à environ 7 km à l’est du centre-ville.',
        'Calea București 325, etwa 7 km östlich des Zentrums.', 'Calea București 325, a circa 7 km a est del centro.')),
    ('airplane-outline', tr('Aprons', 'Platforme', 'Plataformas', 'Aires de stationnement', 'Vorfelder', 'Piazzali'),
     tr('Two new aircraft aprons and three taxiways, so several planes can be handled at once. Boarding is on foot or by bus across the apron.',
        'Două platforme noi pentru avioane și trei căi de rulare, ca mai multe avioane să fie deservite simultan. Îmbarcarea se face pe jos sau cu autobuzul pe platformă.',
        'Dos nuevas plataformas y tres calles de rodaje para atender varios aviones a la vez. Se embarca a pie o en autobús por la plataforma.',
        'Deux nouvelles aires et trois voies de circulation pour traiter plusieurs avions à la fois. L’embarquement se fait à pied ou en bus.',
        'Zwei neue Vorfelder und drei Rollwege, damit mehrere Flugzeuge gleichzeitig abgefertigt werden. Boarding zu Fuß oder per Bus übers Vorfeld.',
        'Due nuovi piazzali e tre vie di rullaggio per gestire più aerei insieme. Si sale a bordo a piedi o in bus sul piazzale.')),
    ('construct-outline', tr('In 2026', 'În 2026', 'En 2026', 'En 2026', '2026', 'Nel 2026'),
     tr('About 44 million lei of investment, including an ILS CAT III system for landings in fog and green energy.',
        'Investiții de circa 44 de milioane de lei, inclusiv un sistem ILS CAT III pentru aterizări pe ceață și energie verde.',
        'Unos 44 millones de lei de inversión, incluido un ILS CAT III para aterrizar con niebla y energía verde.',
        'Environ 44 millions de lei d’investissements, dont un ILS CAT III pour atterrir par brouillard et de l’énergie verte.',
        'Rund 44 Millionen Lei Investitionen, darunter ein ILS CAT III für Landungen bei Nebel und grüne Energie.',
        'Circa 44 milioni di lei di investimenti, incluso un ILS CAT III per atterrare con la nebbia ed energia verde.')),
    ('id-card-outline', tr('Codes', 'Coduri', 'Códigos', 'Codes', 'Codes', 'Codici'),
     tr('IATA CRA · ICAO LRCV · elevation 191 m', 'IATA CRA · ICAO LRCV · altitudine 191 m', 'IATA CRA · OACI LRCV · altitud 191 m',
        'IATA CRA · OACI LRCV · altitude 191 m', 'IATA CRA · ICAO LRCV · Höhe 191 m', 'IATA CRA · ICAO LRCV · altitudine 191 m')),
]

inside = [
    tr('Check-in counters and self check-in kiosks on the ground floor', 'Ghișee de check-in și chioșcuri de self check-in la parter', 'Mostradores de facturación y quioscos de autofacturación en la planta baja',
       'Comptoirs d’enregistrement et bornes libre-service au rez-de-chaussée', 'Check-in-Schalter und Self-Check-in-Automaten im Erdgeschoss', 'Banchi del check-in e chioschi self check-in al piano terra'),
    tr('Security upstairs, then separate Schengen and non-Schengen departure areas', 'Controlul de securitate la etaj, apoi zone de plecări separate Schengen și non-Schengen', 'Control de seguridad arriba y zonas de salida Schengen y no Schengen separadas',
       'Contrôle de sûreté à l’étage, puis zones de départ Schengen et hors Schengen séparées', 'Sicherheitskontrolle oben, danach getrennte Schengen- und Nicht-Schengen-Bereiche', 'Controlli di sicurezza al piano superiore, poi aree partenze Schengen e non Schengen separate'),
    tr('Food court, cafés and duty free', 'Food court, cafenele și duty free', 'Zona de restauración, cafeterías y duty free', 'Espace restauration, cafés et duty free', 'Food-Court, Cafés und Duty-free', 'Food court, caffetterie e duty free'),
    tr('Car rental and tourist information in the arrivals hall', 'Închirieri auto și informații turistice în holul sosiri', 'Alquiler de coches e información turística en llegadas',
       'Location de voitures et office de tourisme dans le hall des arrivées', 'Autovermietung und Touristeninfo in der Ankunftshalle', 'Autonoleggio e informazioni turistiche nella sala arrivi'),
    tr('Free assistance for reduced mobility: ask your airline at least 48 h before', 'Asistență gratuită pentru mobilitate redusă: cere-o companiei cu cel puțin 48 h înainte', 'Asistencia gratuita para movilidad reducida: pídela a tu aerolínea 48 h antes',
       'Assistance gratuite pour mobilité réduite : demandez-la à votre compagnie 48 h avant', 'Kostenlose Hilfe bei eingeschränkter Mobilität: mindestens 48 Std. vorher bei der Airline anmelden', 'Assistenza gratuita per mobilità ridotta: chiedila alla compagnia almeno 48 ore prima'),
]

transport = [
    ('bus-outline', tr('Bus 9 (RAT Craiova)', 'Autobuzul 9 (RAT Craiova)', 'Autobús 9 (RAT Craiova)', 'Bus 9 (RAT Craiova)', 'Bus 9 (RAT Craiova)', 'Autobus 9 (RAT Craiova)'),
     tr('Stops in front of the terminal; about 30 minutes to the city centre.', 'Oprește în fața terminalului; circa 30 de minute până în centru.', 'Para delante de la terminal; unos 30 minutos al centro.',
        'S’arrête devant le terminal ; environ 30 minutes jusqu’au centre.', 'Hält vor dem Terminal; etwa 30 Minuten ins Zentrum.', 'Ferma davanti al terminal; circa 30 minuti fino al centro.')),
    ('car-outline', tr('Taxi, Uber and Bolt', 'Taxi, Uber și Bolt', 'Taxi, Uber y Bolt', 'Taxi, Uber et Bolt', 'Taxi, Uber und Bolt', 'Taxi, Uber e Bolt'),
     tr('Taxi rank and a ride-sharing pick-up in front of the terminal, about 15 minutes to the centre.', 'Stație de taxi și loc de preluare ride-sharing în fața terminalului, circa 15 minute până în centru.', 'Parada de taxis y punto de recogida de VTC delante de la terminal, unos 15 minutos al centro.',
        'Station de taxis et point de prise en charge VTC devant le terminal, environ 15 minutes jusqu’au centre.', 'Taxistand und Abholpunkt für Ride-Sharing vor dem Terminal, etwa 15 Minuten ins Zentrum.', 'Posteggio taxi e punto di ritiro ride-sharing davanti al terminal, circa 15 minuti fino al centro.')),
    ('car-sport-outline', tr('Parking', 'Parcare', 'Aparcamiento', 'Parking', 'Parken', 'Parcheggio'),
     tr('Short- and long-stay car parks next to the terminal; the first 10 minutes are free.', 'Parcări de scurtă și lungă durată lângă terminal; primele 10 minute sunt gratuite.', 'Aparcamientos de corta y larga estancia junto a la terminal; los primeros 10 minutos son gratis.',
        'Parkings courte et longue durée à côté du terminal ; les 10 premières minutes sont gratuites.', 'Kurz- und Langzeitparkplätze am Terminal; die ersten 10 Minuten sind kostenlos.', 'Parcheggi a breve e lunga sosta accanto al terminal; i primi 10 minuti sono gratis.')),
]

airlines = [
    ('Wizz Air', ['Bari', 'Bergamo (Milano)', 'Birmingham', 'Bruxelles Charleroi', 'Dortmund', 'London Luton', 'Madrid'],
     tr('From late October 2026, Paris Beauvais, Barcelona, Rome, Bologna and Venice are suspended.', 'Din a doua jumătate a lui octombrie 2026, rutele Paris Beauvais, Barcelona, Roma, Bologna și Veneția sunt suspendate.',
        'Desde finales de octubre de 2026 se suspenden París Beauvais, Barcelona, Roma, Bolonia y Venecia.', 'Depuis fin octobre 2026, Paris Beauvais, Barcelone, Rome, Bologne et Venise sont suspendus.',
        'Seit Ende Oktober 2026 sind Paris-Beauvais, Barcelona, Rom, Bologna und Venedig ausgesetzt.', 'Da fine ottobre 2026 Parigi Beauvais, Barcellona, Roma, Bologna e Venezia sono sospese.')),
    (tr('Holiday charters (HiSky, AnimaWings)', 'Charter de vacanță (HiSky, AnimaWings)', 'Chárteres vacacionales (HiSky, AnimaWings)', 'Charters vacances (HiSky, AnimaWings)', 'Urlaubscharter (HiSky, AnimaWings)', 'Charter vacanze (HiSky, AnimaWings)'),
     ['Antalya', 'Heraklion', 'Hurghada', 'Enfidha'],
     tr('Summer season, sold by travel agencies.', 'Sezon de vară, vândute prin agenții de turism.', 'Temporada de verano, a través de agencias.', 'Saison d’été, vendus par les agences de voyage.', 'Sommersaison, über Reisebüros.', 'Stagione estiva, tramite agenzie di viaggio.')),
]

departure = [
    tr('Use the Departures entrance; the screens show your flight’s check-in desk.', 'Intră pe la intrarea Plecări; pe ecrane vezi ghișeul de check-in al zborului tău.', 'Entra por Salidas; las pantallas muestran el mostrador de tu vuelo.', 'Entrez par les Départs ; les écrans indiquent le comptoir de votre vol.', 'Nimm den Eingang Abflug; die Anzeigen zeigen deinen Check-in-Schalter.', 'Entra dalle Partenze; i monitor indicano il banco del tuo volo.'),
    tr('Check in at a desk or a self check-in kiosk on the ground floor and drop checked bags. Desks usually close 40 minutes before departure.', 'Faci check-in la ghișeu sau la un chioșc self check-in, la parter, și predai bagajele de cală. Ghișeele se închid de obicei cu 40 de minute înainte.', 'Factura en el mostrador o en un quiosco en la planta baja y deja tu maleta. Suelen cerrar 40 minutos antes.', 'Enregistrez-vous au comptoir ou à une borne au rez-de-chaussée et déposez vos bagages. Fermeture en général 40 minutes avant.', 'Check-in am Schalter oder Automaten im Erdgeschoss, Koffer abgeben. Schluss meist 40 Minuten vor Abflug.', 'Check-in al banco o al chiosco al piano terra e consegna i bagagli. Di solito chiude 40 minuti prima.'),
    tr('Go upstairs to security: liquids up to 100 ml in one clear bag, laptop out.', 'Urci la etaj la controlul de securitate: lichide de max. 100 ml într-o pungă transparentă, laptopul separat.', 'Sube al control de seguridad: líquidos de hasta 100 ml en una bolsa, portátil fuera.', 'Montez au contrôle de sûreté : liquides jusqu’à 100 ml dans un sac, ordinateur sorti.', 'Oben zur Sicherheitskontrolle: Flüssigkeiten bis 100 ml im Beutel, Laptop raus.', 'Sali ai controlli: liquidi fino a 100 ml in una busta, portatile fuori.'),
    tr('Schengen flights go straight to their gates. For non-Schengen flights (London, Birmingham) you also pass passport control.', 'Zborurile Schengen merg direct la porți. Pentru cele non-Schengen (Londra, Birmingham) treci și prin controlul pașapoartelor.', 'Los vuelos Schengen van directos a su puerta. Para los no Schengen (Londres, Birmingham) pasas también control de pasaportes.', 'Les vols Schengen vont directement aux portes. Pour les non-Schengen (Londres, Birmingham), passez aussi le contrôle des passeports.', 'Schengen-Flüge direkt zum Gate. Bei Nicht-Schengen (London, Birmingham) zusätzlich Passkontrolle.', 'I voli Schengen vanno direttamente al gate. Per i non Schengen (Londra, Birmingham) c’è anche il controllo passaporti.'),
    tr('At boarding you walk or take a bus across the apron to the plane: follow the screens and Gatemate alerts.', 'La îmbarcare mergi pe jos sau cu autobuzul pe platformă până la avion: urmărește ecranele și alertele Gatemate.', 'Al embarcar vas a pie o en autobús hasta el avión: sigue las pantallas y las alertas de Gatemate.', 'À l’embarquement, vous rejoignez l’avion à pied ou en bus : suivez les écrans et les alertes Gatemate.', 'Zum Flugzeug geht es zu Fuß oder per Bus: Achte auf die Anzeigen und Gatemate-Alerts.', 'All’imbarco raggiungi l’aereo a piedi o in bus: segui i monitor e gli avvisi di Gatemate.'),
]
arrival = [
    tr('You walk or ride a bus from the plane into the ground floor of the terminal.', 'De la avion mergi pe jos sau cu autobuzul până la parterul terminalului.', 'Del avión vas a pie o en autobús a la planta baja de la terminal.', 'De l’avion, vous rejoignez à pied ou en bus le rez-de-chaussée du terminal.', 'Vom Flugzeug geht es zu Fuß oder per Bus ins Erdgeschoss des Terminals.', 'Dall’aereo arrivi a piedi o in bus al piano terra del terminal.'),
    tr('From outside Schengen: passport control (non-EU travellers are registered in the EES).', 'Din afara spațiului Schengen: controlul pașapoartelor (călătorii din afara UE sunt înregistrați în EES).', 'Desde fuera de Schengen: control de pasaportes (los no europeos se registran en el EES).', 'Hors Schengen : contrôle des passeports (les non-Européens sont enregistrés dans l’EES).', 'Von außerhalb Schengen: Passkontrolle (Nicht-EU-Reisende werden im EES erfasst).', 'Da fuori Schengen: controllo passaporti (i non UE vengono registrati nell’EES).'),
    tr('Collect your bags in the baggage hall; lost and found is next to the exit.', 'Îți iei bagajele din sala de recuperare bagaje; obiectele pierdute sunt lângă ieșire.', 'Recoge tus maletas en la sala de equipajes; objetos perdidos está junto a la salida.', 'Récupérez vos bagages dans le hall ; les objets trouvés sont près de la sortie.', 'Gepäck in der Gepäckausgabe holen; das Fundbüro ist am Ausgang.', 'Ritira i bagagli nella sala riconsegna; oggetti smarriti accanto all’uscita.'),
    tr('In the arrivals hall: car rental, tourist information and cash machines. Outside: taxis, Uber/Bolt pick-up and bus 9 to the centre.', 'În holul Sosiri: închirieri auto, informații turistice și bancomate. Afară: taxi, preluare Uber/Bolt și autobuzul 9 spre centru.', 'En llegadas: alquiler de coches, información turística y cajeros. Fuera: taxis, Uber/Bolt y el autobús 9 al centro.', 'Dans le hall des arrivées : location de voitures, office de tourisme et distributeurs. Dehors : taxis, Uber/Bolt et le bus 9 vers le centre.', 'In der Ankunftshalle: Autovermietung, Touristeninfo, Geldautomaten. Draußen: Taxis, Uber/Bolt und Bus 9 ins Zentrum.', 'Negli arrivi: autonoleggio, informazioni turistiche e bancomat. Fuori: taxi, Uber/Bolt e bus 9 per il centro.'),
]

ui = [
    tr('About this airport', 'Despre aeroport', 'Sobre este aeropuerto', 'À propos de cet aéroport', 'Über diesen Flughafen', 'Informazioni sull’aeroporto'),
    tr('Inside the terminal', 'În terminal', 'Dentro de la terminal', 'Dans le terminal', 'Im Terminal', 'Nel terminal'),
    tr('Getting there', 'Cum ajungi', 'Cómo llegar', 'Comment y aller', 'Anreise', 'Come arrivare'),
    tr('Airlines and destinations', 'Companii și destinații', 'Aerolíneas y destinos', 'Compagnies et destinations', 'Airlines und Ziele', 'Compagnie e destinazioni'),
    tr('Gate numbers and positions on the plan are a guide: always follow the screens in the terminal and Gatemate alerts.',
       'Numerele și pozițiile porților din plan sunt orientative: urmărește mereu ecranele din terminal și alertele Gatemate.',
       'Los números y posiciones de las puertas en el plano son orientativos: sigue siempre las pantallas de la terminal y las alertas de Gatemate.',
       'Les numéros et positions des portes sur le plan sont indicatifs : suivez toujours les écrans du terminal et les alertes Gatemate.',
       'Gate-Nummern und -Positionen auf dem Plan sind Richtwerte: Folge immer den Anzeigen im Terminal und den Gatemate-Alerts.',
       'Numeri e posizioni dei gate sulla mappa sono indicativi: segui sempre i monitor del terminal e gli avvisi di Gatemate.'),
    tr('Leaving from Craiova', 'Când pleci din Craiova', 'Si sales de Craiova', 'Au départ de Craiova', 'Abflug in Craiova', 'Se parti da Craiova'),
    tr('Landing in Craiova', 'Când aterizezi în Craiova', 'Si aterrizas en Craiova', 'À l’arrivée à Craiova', 'Ankunft in Craiova', 'Se atterri a Craiova'),
    tr('Checked October 2026', 'Verificat în octombrie 2026', 'Revisado en octubre de 2026', 'Vérifié en octobre 2026', 'Stand Oktober 2026', 'Verificato a ottobre 2026'),
]

def j(s): return json.dumps(s, ensure_ascii=False)
ts = f"""// Generated by the airport facts generator; English texts are the i18n keys (translations in i18n-src).

export interface AirportFacts {{
  facts: {{ icon: string; label: string; value: string }}[];
  inside: string[];
  transport: {{ icon: string; title: string; body: string }}[];
  airlines: {{ name: string; destinations: string[]; note?: string }}[];
  /** Step by step through the terminal. */
  departure?: string[];
  arrival?: string[];
  departureTitle?: string;
  arrivalTitle?: string;
  note: string;
  checked: string;
}}

/** Hand-checked details for airports we know well, shown under "About this airport". */
export const AIRPORT_FACTS: Record<string, AirportFacts> = {{
  CRA: {{
    facts: [
{chr(10).join(f"      {{ icon: '{i}', label: {j(l)}, value: {j(v)} }}," for i, l, v in facts)}
    ],
    inside: [
{chr(10).join(f"      {j(x)}," for x in inside)}
    ],
    transport: [
{chr(10).join(f"      {{ icon: '{i}', title: {j(t)}, body: {j(b)} }}," for i, t, b in transport)}
    ],
    airlines: [
{chr(10).join(f"      {{ name: {j(n)}, destinations: {j(d)}, note: {j(no)} }}," for n, d, no in airlines)}
    ],
    departureTitle: {j(ui[5])},
    arrivalTitle: {j(ui[6])},
    departure: [
{chr(10).join(f"      {j(x)}," for x in departure)}
    ],
    arrival: [
{chr(10).join(f"      {j(x)}," for x in arrival)}
    ],
    note: {j(ui[4])},
    checked: {j(ui[7])},
  }},
}};
"""
open(f'{ROOT}/src/app/core/data/airport-facts.ts', 'w').write(ts)

keys = json.load(open(f'{ROOT}/i18n-src/keys.json'))
for li, lang in enumerate(LANGS):
    path = f'{ROOT}/i18n-src/{lang}.tsv'
    have = set()
    for l in open(path, encoding='utf-8'):
        if not l.strip(): continue
        ref = l.split('\t', 1)[0]
        have.add(ref[1:] if ref.startswith('@') else keys[int(ref)])
    n = 0
    with open(path, 'a', encoding='utf-8') as f:
        for en, trs in X.items():
            if en in have or en == trs[li]: continue
            f.write(f'@{en}\t{trs[li]}\n'); n += 1
    print(lang, n)
