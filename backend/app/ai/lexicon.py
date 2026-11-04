"""Seed vocabulary and labelled examples for English / Shona / Ndebele road reports.

The seed corpus is small on purpose: it bootstraps the demo. Replace/extend it with
editor-labelled real reports (see scripts/retrain_classifier.py) before trusting accuracy numbers.
Shona/Ndebele entries should be reviewed by fluent speakers.
"""

CATEGORY_LABELS = {
    "potholes": "Road surface damage",
    "flooding": "Flooding",
    "collisions": "Collision or breakdown",
    "visibility": "Visibility & lighting",
    "other": "Other road hazard",
}

# language marker words (lowercase). Used for detection and glossary gloss.
SHONA_MARKERS = {
    "pane", "gomba", "makomba", "mugwagwa", "nzira", "mota", "dzakarovana", "tsaona", "ngozi", "mvura",
    "yakazadza", "pedyo", "kuna", "paya", "zvakanyanya", "husiku", "rima", "mwenje", "haisi", "kupfuta",
    "mafashamo", "bhiriji", "ndiri", "isu", "vanhu", "yakarara", "wakaputsika", "ane", "une", "kutsauka",
    "pamugwagwa", "ipapo", "apa", "dziri", "rakadzika", "guru", "hakuoneki", "yakadzima", "yadzima",
}
NDEBELE_MARKERS = {
    "umgodi", "imigodi", "umgwaqo", "emgwaqweni", "imoto", "izimoto", "ingozi", "amanzi", "agcwele",
    "izikhukhula", "izibani", "azikhanyi", "kumnyama", "kakhulu", "eduze", "phezu", "ibhasi", "ligudluke",
    "zishayisene", "uphukile", "ibhulorho", "igcwele", "kunenkungu", "izinkomo", "ebusuku", "kukhona",
    "nga", "ngempela", "futhi", "yethu", "lapha", "khona", "kunzima", "ukubona",
}
ENGLISH_MARKERS = {
    "the", "is", "are", "on", "at", "near", "road", "there", "and", "with", "of", "to", "in", "a", "been",
    "has", "have", "car", "cars", "pothole", "flood", "accident", "crash", "light", "lights", "street",
}

# word / phrase -> English gloss (longest match first at runtime)
GLOSSARY = {
    # shona
    "pane gomba": "there is a pothole",
    "pane makomba": "there are potholes",
    "gomba": "pothole", "makomba": "potholes", "maburi": "holes",
    "mugwagwa wakaputsika": "the road is broken",
    "pamugwagwa": "on the road", "mugwagwa": "road", "nzira": "road",
    "pedyo ne": "near", "pedyo": "near",
    "mota dziri kutsauka": "cars are swerving", "mota": "cars/vehicle",
    "dzakarovana": "collided", "tsaona": "accident", "ngozi": "accident",
    "mvura yakazadza": "water has filled", "mvura": "water", "mafashamo": "flooding",
    "bhiriji": "bridge", "husiku": "at night", "rima": "darkness",
    "mwenje haisi kupfuta": "the light is not working", "mwenje yadzima": "the lights are out",
    "mwenje": "light", "hakuoneki": "it is hard to see", "rakadzika": "deep", "guru": "big",
    "zvakanyanya": "very", "kutsauka": "swerving",
    # ndebele
    "umgodi emgwaqweni": "a pothole on the road", "imigodi emgwaqweni": "potholes on the road",
    "umgodi": "pothole", "imigodi": "potholes", "umgwaqo uphukile": "the road is broken",
    "emgwaqweni": "on the road", "umgwaqo": "road",
    "amanzi agcwele": "water has filled", "amanzi": "water", "izikhukhula": "floods",
    "ingozi": "accident", "izimoto ezimbili zishayisene": "two vehicles have collided",
    "izimoto": "vehicles", "imoto": "vehicle/car", "ibhasi ligudluke": "the bus has overturned",
    "ibhasi": "bus", "izibani azikhanyi": "the lights are not working", "izibani": "lights",
    "kumnyama kakhulu": "it is very dark", "kumnyama": "it is dark", "kunenkungu": "there is fog",
    "ibhulorho": "bridge", "eduze": "near", "ebusuku": "at night", "kakhulu": "very",
    "izinkomo emgwaqweni": "cattle on the road",
}

# (text, label) seed corpus: en / sn / nd mixed
TRAINING = [
    # potholes
    ("Big pothole on the A5 near the Plumtree turn-off, cars swerving", "potholes"),
    ("deep potholes along Khami Road damaging tyres", "potholes"),
    ("The road surface has collapsed near the bridge, huge hole", "potholes"),
    ("Tarmac is broken and full of holes on Lobengula Street", "potholes"),
    ("pothole in the left lane at the robot, motorists dodging", "potholes"),
    ("road edge has crumbled after the rains, shoulder eroded", "potholes"),
    ("Pane gomba paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira.", "potholes"),
    ("Pane makomba mazhinji pamugwagwa weKhami Road", "potholes"),
    ("mugwagwa wakaputsika pedyo nechikoro, maburi akawanda", "potholes"),
    ("gomba rakadzika pamugwagwa, mota dzinokuvara", "potholes"),
    ("Kukhona umgodi omkhulu emgwaqweni eduze kwePlumtree", "potholes"),
    ("imigodi emgwaqweni weKhami iyalimaza izimoto", "potholes"),
    ("umgwaqo uphukile eduze kwebhulorho", "potholes"),
    # flooding
    ("Road flooded at the low-lying bridge, water over the tarmac", "flooding"),
    ("Flooding near Lobengula St and 12th Ave, cars stuck in water", "flooding"),
    ("storm water covering the whole road after heavy rain", "flooding"),
    ("The river has burst its banks and the bridge is under water", "flooding"),
    ("drain blocked and the intersection is flooded", "flooding"),
    ("mvura yakazadza mugwagwa pedyo nebhiriji", "flooding"),
    ("mafashamo pamugwagwa mota hadzigone kupfuura", "flooding"),
    ("mvura yakawanda inovhara nzira kuEsigodini", "flooding"),
    ("amanzi agcwele umgwaqo eduze kwebhulorho", "flooding"),
    ("izikhukhula emgwaqweni imoto azikwazi ukudlula", "flooding"),
    ("ibhulorho igcwele amanzi ngemva kwemvula", "flooding"),
    # collisions
    ("Two vehicles collided head-on on the A5, ambulance needed", "collisions"),
    ("accident at the Hillside junction, a kombi overturned", "collisions"),
    ("bus has broken down in the middle of the road blocking traffic", "collisions"),
    ("truck jackknifed near Esigodini, driver injured", "collisions"),
    ("crash at the roundabout, cars badly damaged", "collisions"),
    ("car hit a pedestrian near the clinic", "collisions"),
    ("tsaona yemota pedyo nePlumtree mota mbiri dzakarovana", "collisions"),
    ("ngozi yakaipa paA5 bhazi rakadonha", "collisions"),
    ("mota yakarara pamugwagwa vanhu vakakuvara", "collisions"),
    ("ingozi yemoto eduze kweEsigodini izimoto ezimbili zishayisene", "collisions"),
    ("ibhasi ligudluke emgwaqweni abantu balimele", "collisions"),
    ("ingozi embi eKhami Road imoto igudlukile", "collisions"),
    # visibility
    ("Streetlights are out at the ZESA roundabout, very dark at night", "visibility"),
    ("traffic lights not working at Fife Street, drivers braking late", "visibility"),
    ("thick fog on the highway, cannot see the road", "visibility"),
    ("no road markings and the signs are missing at the junction", "visibility"),
    ("robots are off and it is pitch black at the intersection", "visibility"),
    ("mwenje haisi kupfuta pa ZESA roundabout husiku", "visibility"),
    ("rima guru pamugwagwa hakuoneki husiku", "visibility"),
    ("mwenje yadzima paFifth Avenue", "visibility"),
    ("izibani azikhanyi emgwaqweni kumnyama kakhulu ebusuku", "visibility"),
    ("izibani zomgwaqo zivaliwe eKhami kunzima ukubona", "visibility"),
    ("kunenkungu kakhulu emgwaqweni asiboni", "visibility"),
    # other
    ("cattle wandering across the road near Nyamandlovu", "other"),
    ("illegal vendors blocking the lane on Fife Street", "other"),
    ("a fallen tree is blocking half of the road", "other"),
    ("roadblock with no signage causing traffic buildup", "other"),
    ("stray donkeys on the road at night", "other"),
    ("izinkomo emgwaqweni eduze kwePlumtree", "other"),
    ("muti wakadonha wakavhara nzira", "other"),
    ("mombe dziri mumugwagwa paEsigodini", "other"),
]

# Keyword stems per category (en / sn / nd). Matched at word starts. Hand-written domain knowledge that
# generalises across languages when labelled data is scarce; blended with the learned model.
KEYWORD_STEMS = {
    "potholes": ["pothole", "hole", "tarmac", "crumbl", "crack", "collapsed", "road surface", "shoulder",
                 "eroded", "gomba", "makomba", "maburi", "wakaputsika", "umgodi", "imigodi", "uphukile",
                 "damaged road", "road edge"],
    "flooding": ["flood", "water", "river", "burst", "drain", "submerg", "mvura", "mafashamo", "amanzi",
                 "izikhukhula", "gcwele", "zazidza", "yakazadza", "yakawanda"],
    "collisions": ["collid", "crash", "accident", "overturn", "jackknif", "injur", "ambulance", "broken down",
                   "breakdown", "pedestrian", "tsaona", "ngozi", "dzakarovana", "shayisene", "ligudluke",
                   "igudlukile", "balimele", "vakakuvara", "yakarara", "dzakagumburwa", "rolled"],
    "visibility": ["dark", "streetlight", "street light", "light", "robot", "fog", "marking", "signage",
                   "sign", "visib", "cannot see", "rima", "mwenje", "hakuoneki", "izibani", "kumnyama",
                   "inkungu", "kunenkungu", "asiboni", "khanyi", "kupfuta"],
    "other": ["cattle", "donkey", "livestock", "goat", "vendor", "fallen tree", "tree", "roadblock", "stray",
              "mombe", "izinkomo", "muti", "mbongoro", "obstruct"],
}
