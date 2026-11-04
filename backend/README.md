# Panzira AI · Backend Intelligence & Integration Platform

Production-ready, modular Python FastAPI service powering **Panzira AI** — a road-safety intelligence and verification platform developed for the Zimbabwean transit ecosystem.

---

## 🏛️ Architecture & Role Breakdown

The backend service is engineered in distinct modular layers matching the hackathon roles:

```
backend/
├── app/
│   ├── config.py                 # App settings, JWT keys, safety thresholds
│   ├── main.py                   # FastAPI application entrypoint & CORS middleware
│   │
│   ├── database/                 # [Backend Developer]
│   │   ├── session.py            # SQLite/PostgreSQL engine & session maker
│   │   ├── models.py             # ORM models (Users, Signals, PublicAlerts, Corridors, Briefs, AuditLogs)
│   │   └── seed.py               # Baseline seed data matching reference dataset
│   │
│   ├── auth/                     # [Backend Developer]
│   │   ├── security.py           # PBKDF2-HMAC-SHA256 password hashing & JWT tokens
│   │   ├── dependencies.py       # Role-Based Access Control (RBAC: editor, journalist, admin)
│   │   └── router.py             # Login, profile, and credential verification
│   │
│   ├── ml/                       # [ML Developer]
│   │   ├── classifier.py         # Multilingual road hazard classifier & severity grading
│   │   ├── translator.py         # Specialized Shona & Ndebele to English translation engine
│   │   ├── extractor.py          # Bulawayo transit corridor & landmark extraction
│   │   ├── deduplication.py      # Spatial-temporal-semantic duplicate report correlation
│   │   ├── vision_safety.py      # Computer vision graphic content detection & blur gate
│   │   └── pipeline.py           # Orchestrated AI intake pipeline with uncertainty indicators
│   │
│   ├── integrations/             # [Integration Developer]
│   │   ├── whatsapp.py           # User-initiated, opt-in WhatsApp webhook intake
│   │   ├── social_collector.py   # Permitted public Facebook & Instagram feed collector
│   │   ├── sms_ussd.py           # Low-bandwidth SMS & *140# USSD intake gateway
│   │   └── router.py             # External webhook endpoints & verification challenges
│   │
│   ├── routers/                  # [Backend Developer]
│   │   ├── public.py             # Public alerts (strictly verified), submissions, corridors
│   │   ├── newsroom.py           # Journalist & Editor workspace, checklist gate, audit trail
│   │   └── briefs.py             # Investigative working reporting packages
│   │
│   └── audit/                    # [Backend Developer]
│       └── logger.py             # Immutable append-only audit trail service
│
├── tests/
│   ├── test_ml_pipeline.py       # Translation, classification, extraction, vision safety tests
│   ├── test_verification_gate.py # Strict human editor gate & AI non-publishing tests
│   ├── test_integrations.py      # WhatsApp opt-in, Facebook feed, SMS/USSD tests
│   └── test_security.py          # RBAC & graphic media withholding tests
│
├── requirements.txt
└── run.py                        # Service runner script
```

---

## 🚦 Core Verification Workflow

The platform strictly enforces the human-in-the-loop verification sequence:

$$\text{Received} \longrightarrow \text{AI Extracted (Stage 2)} \longrightarrow \text{Corroboration (Stage 3)} \longrightarrow \text{Editor Approval (Stage 4)} \longrightarrow \text{Public Alert}$$

> [!IMPORTANT]
> **Safety Invariant**: AI **never** automatically publishes road-safety warnings. AI analysis produces structured suggestions (`pipelineStage: 2`, `workflowStatus: 'lead'`) with explicit confidence scores and missing verification requirements. Only authenticated human editors completing all 4 independent checks can publish an alert.

### 4-Point Independent Verification Checklist
1. **Location & Timestamp Corroboration**: Named junction, lane direction, and observed time confirmed.
2. **Media & Date Provenance**: EXIF timestamps or ground photographic recency verified.
3. **Independent Source Corroboration**: Second witness, commercial fleet GPS slowdown, or police confirmation.
4. **Hazard Still Present**: Physical obstruction or surface damage actively persists.

---

## 🤖 ML Developer Capabilities

1. **Multilingual Translation (`app/ml/translator.py`)**:
   - Specialized lexicon for Zimbabwean road idioms in **Shona** (e.g., *"gomba"*, *"kutsauka nzira"*, *"mvura yazara"*, *"tsaona"*) and **Ndebele** (e.g., *"umgodi"*, *"izimoto ziyaphambuka"*, *"amanzi amanengi"*, *"ingozi"*).
   - Generates working English drafts flagged with advisory notes requiring human review.
2. **Hazard Classification (`app/ml/classifier.py`)**:
   - Categorizes reports into `potholes`, `flooding`, `collisions`, `visibility`, and `other`.
   - Computes severity (`Critical`, `High`, `Review needed`) and confidence scores ($45\% - 78\%$).
3. **Corridor & Landmark Entity Extraction (`app/ml/extractor.py`)**:
   - Detects arterial corridors (A5 Plumtree Road, Khami Road, A7 Esigodini Road, Bulawayo CBD).
   - Extracts precision ratings (*"Named junction · lane direction unconfirmed"*, *"GPS verified"*).
4. **Vision Safety & Graphic Gate (`app/ml/vision_safety.py`)**:
   - Detects severe collision trauma or distressing imagery via chromaticity analysis and safety keywords.
   - Automatically applies newsroom blur gate and **permanently withholds raw images from public APIs**.
5. **Deduplication Engine (`app/ml/deduplication.py`)**:
   - Correlates incoming reports against existing database records using Jaccard similarity, spatial corridor matching, and temporal proximity.

---

## 🔌 Integration Developer Capabilities

1. **Opt-in WhatsApp Submissions (`app/integrations/whatsapp.py`)**:
   - Meta Business Cloud API & Twilio webhook receiver (`/api/integrations/whatsapp/webhook`).
   - Enforces user-initiated opt-in consent.
   - **Strict Privacy Rule**: Unauthorized scraping of private WhatsApp groups is strictly refused. Personal phone numbers are pseudonymized (`+263***4589`).
2. **Authorized Public Social Feeds (`app/integrations/social_collector.py`)**:
   - Ingests permitted public posts from municipal and civic pages (e.g., *City of Bulawayo Engineering Desk*).
   - Records source provenance, timestamp, and permanent URL.
3. **Low-Bandwidth SMS & USSD Intake (`app/integrations/sms_ussd.py`)**:
   - SMS webhook receiver for offline/rural road users.
   - USSD menu ingestion (`*140#`) for structured quick reporting.

---

## 🔒 Security & Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| **Public / Citizen** | View verified public alerts, view corridor watch, submit citizen hazard reports. |
| **Journalist** | Access Newsroom Signal Monitor and Inbox, view leads and evidence, request corroborating evidence, update investigative notes, toggle verification checklist items. |
| **Editor / Admin** | All Journalist capabilities **plus** final Editor Gate authority to verify & publish public alerts or archive/reject invalid leads. |

---

## 🗺️ Real Interactive Map Integration

The frontend features a real, interactive map powered by **Leaflet** and **OpenStreetMap / CARTO**:
- Centered on Bulawayo, Zimbabwe (`-20.155, 28.583`).
- Accurate geographic mapping of arterial corridors: A5 Bulawayo–Plumtree Road, Khami Road, Esigodini Road (A7), and Leopold Takawira Ave.
- Real-time pins with category glyphs, color-coded severity, and interactive popups.
- Multi-layer selector (Carto Street, OpenStreetMap, Satellite Imagery).
- Toggle switch between **Real Map (OSM)** and **Schematic Cartography**.

---

## 🚀 Running the Platform

### 1. Start the Python Backend Service
```bash
# From workspace root:
python backend/run.py
```
*Backend runs on `http://localhost:8000`. Swagger API docs available at `http://localhost:8000/docs`.*

### 2. Run the Automated Test Suite
```bash
set PYTHONPATH=backend
python -m unittest discover -s backend/tests
```
*(All 17 tests verify verification gates, ML translation, integrations, and RBAC).*

### 3. Start the Frontend Application
```bash
npm run dev
```
*Frontend runs on `http://localhost:5173` and automatically synchronizes with the Python service.*

