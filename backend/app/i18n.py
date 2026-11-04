"""Short citizen-facing strings (en / sn / nd).
NOTE: Shona and Ndebele strings are first drafts and must be reviewed by fluent speakers before launch."""

STR = {
    "consent": {
        "en": "Panzira collects road-hazard reports for journalists. Reply YES to let us use your reports and contact you for follow-up. Reply STOP any time. No personal details are published.",
        "sn": "Panzira inounganidza mashoko ezvinhu zvakaipa mumigwagwa kuvatori venhau. Pindura YES kutibvumira kushandisa zvamunotitumira nekutibata. Pindura STOP chero nguva. Hapana ruzivo rwenyu runoburitswa.",
        "nd": "I-Panzira iqoqa imibiko yezingozi zemigwaqo yabahlali bezindaba. Phendula YES ukusivumela ukusebenzisa imibiko yakho lokukuthinta. Phendula STOP noma nini. Akukho lwazi lwakho olushicilelwayo.",
    },
    "send_report": {
        "en": "Thank you. Send your report in one message: what you saw and where (road, landmark). A photo is optional.",
        "sn": "Tatenda. Tumirai chirevo chimwe: makaona chii uye kupi (mugwagwa, panozivikanwa). Mufananidzo hauna kuzosungirwa.",
        "nd": "Siyabonga. Thumela umbiko owodwa: okubonileyo lapho kuyo (umgwaqo, indawo eyaziwayo). Isithombe asikho okungamele.",
    },
    "received": {
        "en": "Report received. Reference: {ref}. An editor will check it before anything is published. Send STATUS {ref} to follow progress.",
        "sn": "Tagamuchira chirevo. Nhamba: {ref}. Mupepeti achachiongorora tisati tabudisa chero chinhu. Tumirai STATUS {ref} kuona kufambira mberi.",
        "nd": "Samukele umbiko. Inombolo: {ref}. Umhleli uzawubheka ngaphambi kokuthi kushicilelwe lutho. Thumela STATUS {ref} ukubona inqubekela.",
    },
    "stopped": {
        "en": "You have been unsubscribed. We will not contact you again. Existing reports stay in the review queue without your contact details.",
        "sn": "Makabviswa. Hatichazokubatai zvakare. Zvamakatumira zvichiripo asi hapana nhamba yenyu.",
        "nd": "Ususuliwe. Ngeke sisaxhumana lawe futhi. Imibiko oyithumele ihlala kodwa ngaphandle kwenombolo yakho.",
    },
    "not_found": {
        "en": "We could not find that reference for this number.",
        "sn": "Hatina kuwana nhamba iyi pane nhamba yenyu.",
        "nd": "Asiyitholanga leyo nombolo kule nombolo yakho.",
    },
    "rate": {
        "en": "Too many reports from this number in the last hour. Please try again later.",
        "sn": "Mashoko mazhinji kubva panhamba iyi mushure meawa rimwe. Edzai zvakare gare gare.",
        "nd": "Imibiko eminengi kule nombolo ngehora elidlulileyo. Zama futhi kamuva.",
    },
}

STATUS_TEXT = {
    "received": {"en": "Received", "sn": "Yagamuchirwa", "nd": "Samukelwe"},
    "ai_extracted": {"en": "Queued for checking", "sn": "Iri kumirira kuongororwa", "nd": "Ilindele ukuhlolwa"},
    "corroboration": {"en": "Being verified by journalists", "sn": "Iri kuongororwa nevatori venhau", "nd": "Ihlolwa ngabahlali bezindaba"},
    "editor_approval": {"en": "Waiting for editor approval", "sn": "Yakamirira mupepeti", "nd": "Ilindele umhleli"},
    "published": {"en": "Verified and published as an alert", "sn": "Yaongororwa uye yabudiswa", "nd": "Ihloliwe yashicilelwa"},
    "rejected": {"en": "Could not be verified; not published", "sn": "Hazvina kusimbiswa; hazvina kubudiswa", "nd": "Ayikaqinisekiswa; ayishicilelwanga"},
}


def t(key: str, lang: str = "en", **kw) -> str:
    return STR[key].get(lang, STR[key]["en"]).format(**kw)
