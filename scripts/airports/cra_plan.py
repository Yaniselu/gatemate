# Builds public/data/maps/CRA.json: a curated plan of Craiova International Airport (CRA/LRCV) in the same
# OpenStreetMap element format the app parses. Geography is real (runway 09/27, 2,500 x 45 m, ARP 44.3181 N 23.8886 E,
# terminal south of the runway on Calea Bucuresti); the inside of the new "George (Gogu) Constantinescu" terminal
# (opened 18 Dec 2025) is a schematic of its published layout: check-in + self check-in, security, separate
# Schengen / non-Schengen areas, food court, duty free.
import json, sys

out = []
nid = [1000]
def next_id():
    nid[0] += 1
    return nid[0]

def rect(la0, lo0, la1, lo1):
    return [{'lat': la0, 'lon': lo0}, {'lat': la0, 'lon': lo1}, {'lat': la1, 'lon': lo1}, {'lat': la1, 'lon': lo0}, {'lat': la0, 'lon': lo0}]

def way(tags, geom):
    out.append({'type': 'way', 'id': next_id(), 'tags': tags, 'geometry': geom})

def area(tags, la0, lo0, la1, lo1):
    way(tags, rect(la0, lo0, la1, lo1))

def node(tags, lat, lon):
    out.append({'type': 'node', 'id': next_id(), 'lat': round(lat, 6), 'lon': round(lon, 6), 'tags': tags})

def line(tags, *pts):
    way(tags, [{'lat': a, 'lon': b} for a, b in pts])

# ---------- airfield ----------
area({'aeroway': 'aerodrome', 'name': 'Aeroportul Internațional Craiova', 'iata': 'CRA', 'icao': 'LRCV'}, 44.3122, 23.8672, 44.3218, 23.9102)
RWY = 44.31890
line({'aeroway': 'runway', 'ref': '09/27', 'width': '45', 'surface': 'concrete'}, (RWY, 23.87305), (RWY, 23.90435))
line({'aeroway': 'taxiway', 'ref': 'A', 'width': '18'}, (44.31745, 23.88160), (RWY, 23.88160))
line({'aeroway': 'taxiway', 'ref': 'B', 'width': '18'}, (44.31745, 23.88330), (RWY, 23.88330))
line({'aeroway': 'taxiway', 'ref': 'C', 'width': '18'}, (44.31745, 23.88500), (RWY, 23.88500))
line({'aeroway': 'taxiway', 'width': '18'}, (44.31770, 23.87900), (44.31770, 23.88760))
area({'aeroway': 'apron'}, 44.31600, 23.88060, 44.31745, 23.88720)
# stands on the apron (walk-out boarding / bus, no air bridges reported)
for i, lon in enumerate([23.88140, 23.88240, 23.88340, 23.88440, 23.88540, 23.88640], 1):
    node({'aeroway': 'parking_position', 'ref': str(i)}, 44.31690, lon)
area({'aeroway': 'apron'}, 44.31600, 23.88725, 44.31745, 23.89060)
line({'aeroway': 'taxiway', 'ref': 'D', 'width': '18'}, (44.31745, 23.88900), (RWY, 23.88900))
line({'aeroway': 'taxiway', 'width': '18'}, (44.31770, 23.88760), (44.31770, 23.89060))
for i, lon in enumerate([23.88790, 23.88860, 23.88930, 23.89000], 7):
    node({'aeroway': 'parking_position', 'ref': str(i)}, 44.31690, lon)
area({'aeroway': 'hangar', 'building': 'hangar', 'name': 'Hangar'}, 44.31640, 23.89100, 44.31720, 23.89220)
# The old terminal (2010 building, extended in 2023): no passenger flights since 20 December 2025.
area({'building': 'yes', 'name': 'Terminal vechi (închis pasagerilor)'}, 44.31505, 23.88520, 44.31570, 23.88700)
area({'landuse': 'grass'}, 44.31780, 23.86800, 44.32150, 23.91000)
area({'landuse': 'grass'}, 44.31260, 23.86800, 44.31590, 23.87900)
area({'landuse': 'grass'}, 44.31260, 23.88960, 44.31590, 23.91000)

# ---------- landside: roads, parking, transport ----------
line({'highway': 'primary', 'name': 'Calea București'}, (44.31250, 23.86600), (44.31290, 23.88000), (44.31310, 23.89000), (44.31330, 23.91000))
line({'highway': 'service', 'name': 'Acces terminal'}, (44.31295, 23.88130), (44.31480, 23.88130), (44.31480, 23.88520), (44.31300, 23.88520))
line({'highway': 'footway'}, (44.31480, 23.88300), (44.31500, 23.88300))
area({'amenity': 'parking', 'name': 'Parcare scurtă durată', 'fee': 'yes', 'operator': 'Aeroportul Internațional Craiova'}, 44.31400, 23.88150, 44.31470, 23.88290)
area({'amenity': 'parking', 'name': 'Parcare lungă durată', 'fee': 'yes', 'operator': 'Aeroportul Internațional Craiova'}, 44.31330, 23.88150, 44.31395, 23.88450)
area({'amenity': 'parking', 'name': 'Kiss & Fly', 'fee': 'yes'}, 44.31400, 23.88310, 44.31470, 23.88450)
node({'highway': 'bus_stop', 'name': 'Aeroport — linia 9 (RAT Craiova)'}, 44.31488, 23.88200)
node({'amenity': 'taxi', 'name': 'Stație taxi'}, 44.31488, 23.88400)
node({'amenity': 'taxi', 'name': 'Preluare ride-sharing (Uber, Bolt)'}, 44.31470, 23.88440)
area({'amenity': 'parking', 'name': 'Parcare autocare'}, 44.31400, 23.88460, 44.31470, 23.88510)
node({'amenity': 'charging_station', 'name': 'Încărcare mașini electrice'}, 44.31465, 23.88160)

# ---------- terminal ----------
T0, T1, W, E = 44.31500, 44.31585, 23.88150, 23.88450
area({'aeroway': 'terminal', 'building': 'terminal', 'name': 'Terminal George „Gogu” Constantinescu'}, T0, W, T1, E)
node({'entrance': 'main', 'name': 'Intrare plecări'}, T0, 23.88230)
node({'entrance': 'yes', 'name': 'Ieșire sosiri'}, T0, 23.88390)

# ground floor (level 0): departures hall west, arrivals hall east
L = '0'
area({'indoor': 'corridor', 'level': L}, 44.31512, 23.88160, 44.31528, 23.88440)
area({'indoor': 'room', 'level': L, 'name': 'Hol plecări'}, 44.31528, 23.88160, 44.31560, 23.88290)
area({'indoor': 'room', 'level': L, 'name': 'Ghișee check-in'}, 44.31560, 23.88160, 44.31578, 23.88260)
area({'indoor': 'room', 'level': L, 'name': 'Self check-in'}, 44.31560, 23.88262, 44.31578, 23.88292)
area({'indoor': 'room', 'level': L, 'name': 'Predare bagaje speciale'}, 44.31503, 23.88160, 44.31511, 23.88190)
area({'indoor': 'room', 'level': L, 'name': 'Hol sosiri'}, 44.31528, 23.88330, 44.31560, 23.88440)
area({'indoor': 'room', 'level': L, 'name': 'Recuperare bagaje'}, 44.31560, 23.88330, 44.31578, 23.88440)
area({'indoor': 'room', 'level': L, 'name': 'Control pașapoarte sosiri (non-Schengen)'}, 44.31560, 23.88295, 44.31578, 23.88328)
area({'indoor': 'room', 'level': L, 'name': 'Asistență PRM'}, 44.31503, 23.88300, 44.31511, 23.88330)
area({'amenity': 'cafe', 'level': L, 'name': 'Cafenea'}, 44.31529, 23.88292, 44.31545, 23.88328)
node({'tourism': 'information', 'level': L, 'name': 'Informații'}, 44.31520, 23.88300)
node({'tourism': 'information', 'level': L, 'name': 'Info turism Dolj'}, 44.31535, 23.88420)
node({'amenity': 'car_rental', 'level': L, 'name': 'Închirieri auto'}, 44.31548, 23.88425)
node({'amenity': 'atm', 'level': L}, 44.31520, 23.88250)
node({'amenity': 'atm', 'level': L}, 44.31520, 23.88405)
node({'amenity': 'bureau_de_change', 'level': L, 'name': 'Schimb valutar'}, 44.31520, 23.88380)
node({'amenity': 'toilets', 'level': L}, 44.31505, 23.88205)
node({'amenity': 'toilets', 'level': L}, 44.31505, 23.88425)
node({'amenity': 'baby_changing', 'level': L}, 44.31505, 23.88215)
node({'amenity': 'luggage_locker', 'level': L, 'name': 'Depozitare bagaje'}, 44.31505, 23.88360)
node({'amenity': 'lost_property', 'level': L, 'name': 'Obiecte pierdute'}, 44.31570, 23.88435)
node({'amenity': 'device_charging_station', 'level': L}, 44.31545, 23.88170)
node({'emergency': 'defibrillator', 'level': L, 'name': 'Defibrilator (DEA)'}, 44.31520, 23.88320)
node({'highway': 'elevator', 'level': '0;1'}, 44.31545, 23.88305)
line({'highway': 'steps', 'conveying': 'yes', 'level': '0;1'}, (44.31555, 23.88268), (44.31555, 23.88288))

# first floor (level 1, airside): security, Schengen west, non-Schengen east
L = '1'
area({'indoor': 'room', 'level': L, 'name': 'Control de securitate'}, 44.31508, 23.88160, 44.31540, 23.88230)
area({'indoor': 'corridor', 'level': L}, 44.31540, 23.88160, 44.31556, 23.88440)
area({'indoor': 'room', 'level': L, 'name': 'Zona plecări Schengen'}, 44.31556, 23.88160, 44.31584, 23.88330)
area({'indoor': 'room', 'level': L, 'name': 'Control pașapoarte plecări'}, 44.31508, 23.88335, 44.31540, 23.88365)
area({'indoor': 'room', 'level': L, 'name': 'Zona plecări non-Schengen'}, 44.31556, 23.88335, 44.31584, 23.88440)
area({'amenity': 'food_court', 'level': L, 'name': 'Food court'}, 44.31508, 23.88232, 44.31540, 23.88290)
area({'shop': 'duty_free', 'level': L, 'name': 'Duty Free'}, 44.31508, 23.88292, 44.31540, 23.88333)
area({'shop': 'duty_free', 'level': L, 'name': 'Duty Free non-Schengen'}, 44.31508, 23.88367, 44.31540, 23.88400)
area({'indoor': 'room', 'level': L, 'name': 'Zonă de așteptare non-Schengen'}, 44.31508, 23.88402, 44.31540, 23.88440)
node({'amenity': 'cafe', 'level': L, 'name': 'Cafenea Schengen'}, 44.31548, 23.88240)
node({'shop': 'newsagent', 'level': L, 'name': 'Presă și suveniruri'}, 44.31548, 23.88200)
node({'amenity': 'toilets', 'level': L}, 44.31548, 23.88175)
node({'amenity': 'toilets', 'level': L}, 44.31548, 23.88425)
node({'amenity': 'baby_changing', 'level': L, 'name': 'Cameră pentru mamă și copil'}, 44.31548, 23.88185)
node({'amenity': 'drinking_water', 'level': L}, 44.31548, 23.88290)
node({'amenity': 'device_charging_station', 'level': L}, 44.31560, 23.88250)
node({'amenity': 'device_charging_station', 'level': L}, 44.31560, 23.88410)
node({'amenity': 'smoking_area', 'level': L, 'name': 'Zonă fumători'}, 44.31580, 23.88334)
node({'highway': 'elevator', 'level': '0;1'}, 44.31545, 23.88305)

# boarding gates (numbering schematic; follow the screens in the terminal)
for ref, lon in [('1', 23.88180), ('2', 23.88225), ('3', 23.88270), ('4', 23.88315)]:
    node({'aeroway': 'gate', 'ref': ref, 'level': L, 'name': f'Poarta {ref} (Schengen)'}, 44.31582, lon)
for ref, lon in [('5', 23.88360), ('6', 23.88415)]:
    node({'aeroway': 'gate', 'ref': ref, 'level': L, 'name': f'Poarta {ref} (non-Schengen)'}, 44.31582, lon)

json.dump({'elements': out}, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out), 'elements')
