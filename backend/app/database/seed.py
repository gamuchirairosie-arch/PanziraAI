"""Database Seed Loader

Seeds the SQLite/PostgreSQL database with initial baseline users,
signals, verified public alerts, corridor watches, and investigative briefs
matching the Panzira AI reference dataset.
"""

from datetime import datetime
from sqlalchemy.orm import Session
from app.database.models import User, SignalReport, VerifiedPublicAlert, CorridorWatch, WorkingBrief
from app.auth.security import hash_password


def seed_database(db: Session):
    """Populates baseline data if the database is currently unseeded."""
    # 1. Seed Users
    if not db.query(User).filter(User.email == "rudo.moyo@panzira.org").first():
        users = [
            User(
                email="rudo.moyo@panzira.org",
                hashed_password=hash_password("panzira_editor_2025"),
                password_hash=hash_password("panzira_editor_2025"),
                full_name="Rudo Moyo",
                name="Rudo Moyo",
                role="editor",
                can_view_graphic=True,
                is_active=True,
                active=True,
            ),
            User(
                email="tinashe.ndlovu@panzira.org",
                hashed_password=hash_password("panzira_journalist_2025"),
                password_hash=hash_password("panzira_journalist_2025"),
                full_name="Tinashe Ndlovu",
                name="Tinashe Ndlovu",
                role="journalist",
                can_view_graphic=False,
                is_active=True,
                active=True,
            ),
            User(
                email="admin@panzira.org",
                hashed_password=hash_password("panzira_admin_2025"),
                password_hash=hash_password("panzira_admin_2025"),
                full_name="Panzira System Admin",
                name="Panzira System Admin",
                role="admin",
                can_view_graphic=False,
                is_active=True,
                active=True,
            )
        ]
        db.add_all(users)
        db.commit()

    # 2. Seed Signals
    if db.query(SignalReport).count() == 0:
        sig1 = SignalReport(
            id="PZ-SIG-0041",
            investigationCode="ROADS-0431",
            sourceChannelLabel="Public Facebook page",
            sourceChannelShort="Authorized Facebook page",
            sourceBadgeColor="gold",
            visibility="public",
            workflowStatus="lead",
            monitorStatusLabel="Needs corroboration",
            monitorStatusColor="gold",
            inboxStatusLine="Authorized public feed · Lead",
            timeShort="09:42",
            reportedDateTime="27 Jan 2025, 09:42",
            title="Poor visibility at ZESA Roundabout",
            inboxTitle="Poor visibility at ZESA roundabout",
            subtitle="Authorized public-page lead · Bulawayo",
            corridor="Five Avenue / CBD approach",
            roadArea="Five Avenue, Bulawayo",
            landmark="ZESA Roundabout approach",
            categoryKey="visibility",
            categoryLabel="Visibility & lighting",
            severityLabel="Review needed",
            originalLanguage="English",
            originalQuote="“Streetlights and approach markings at the ZESA roundabout on Five Avenue are out again after last night’s storm. Drivers braking late at the circle.”",
            sourceProvenanceNote="Authorized public-page post • 27 Jan 2025, 09:42 • original author not yet contacted",
            evidenceLink="https://example.org/demo-authorized-public-feed/bulawayo-zesa-roundabout",
            aiHazardType="Visibility & lighting outage",
            aiLikelyCorridor="Five Avenue · ZESA Roundabout",
            aiLanguageNote="English • original text",
            aiLocationPrecision="Named junction · lane direction unconfirmed",
            aiConfidencePercent=61,
            aiConfidenceNote="61% • insufficient to publish",
            aiImageHeading="Text-only submission (no photo attached)",
            aiImageSummary="Text-only public page post. An editor must verify current lighting status with council before publishing.",
            aiImageCaveat="Public social mentions are treated strictly as unverified leads, never confirmed facts.",
            photoType="none",
            isGraphicImage=False,
            pipelineStage=2,
            missingItems=[
                "Independent confirmation that lights remain out",
                "On-site night visibility check or municipal maintenance log",
                "Direct contact with original witness",
            ],
            checklist={
                "locationAndTime": False,
                "mediaAndDate": False,
                "independentSource": False,
                "hazardStillPresent": False,
            },
            editorialNotes="Publicly accessible post from an authorized Bulawayo civic page; original author not yet contacted. Check Bulawayo City Council fault desk.",
            unconfirmedSummary="Single public-page report of non-working streetlights and poor night visibility at ZESA Roundabout on Five Avenue.",
            duplicateCandidates=[],
            timeline=[
                {
                    "time": "27 Jan 2025, 09:42",
                    "description": "Authorized public-page post ingested into Signal Monitor as an unverified lead.",
                },
                {
                    "time": "27 Jan 2025, 09:44",
                    "description": "AI structured junction name (ZESA Roundabout, Five Ave); queued for corroboration.",
                }
            ],
            isUserSubmitted=False,
            mapCoords={"xPct": 52.0, "yPct": 45.0},
        )

        sig2 = SignalReport(
            id="PZ-SIG-0042",
            investigationCode="ROADS-0428",
            sourceChannelLabel="Opt-in WhatsApp",
            sourceChannelShort="WhatsApp opt-in",
            sourceBadgeColor="green",
            visibility="opt-in",
            workflowStatus="lead",
            monitorStatusLabel="AI structured",
            monitorStatusColor="green",
            inboxStatusLine="Opt-in WhatsApp · AI structured",
            timeShort="09:31",
            reportedDateTime="27 Jan 2025, 09:31",
            title="Pane gomba paA5",
            inboxTitle="Pane gomba paA5 (Plumtree turn-off)",
            subtitle="User-initiated WhatsApp report · Shona",
            corridor="A5 · Bulawayo–Plumtree",
            roadArea="A5 Bulawayo–Plumtree Road",
            landmark="Near Plumtree turn-off",
            categoryKey="potholes",
            categoryLabel="Road surface damage",
            severityLabel="High",
            originalLanguage="Shona",
            originalQuote="“Pane gomba paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira.”",
            draftEnglishTranslation="“There is a deep pothole on the A5 near the Plumtree turn-off. Cars are swerving off the lane.”",
            sourceProvenanceNote="Source identifier hidden • 27 Jan 2025, 09:31 • citizen-submitted via tipline",
            aiHazardType="Road damage / pothole",
            aiLikelyCorridor="A5 · Bulawayo–Plumtree",
            aiLanguageNote="Shona → English • draft translation",
            aiLocationPrecision="Landmark only · exact GPS missing",
            aiConfidencePercent=68,
            aiConfidenceNote="68% • insufficient to publish",
            aiImageHeading="Possible road-surface damage",
            aiImageSummary="Computer vision can suggest visible defects, but cannot confirm where or when a photo was taken.",
            aiImageCaveat="Computer vision can suggest visible defects, but cannot confirm where or when a photo was taken.",
            photoType="none",
            isGraphicImage=False,
            pipelineStage=3,
            missingItems=[
                "Independent confirmation of the hazard",
                "Precise landmark or GPS coordinate",
                "Time/date and image provenance",
            ],
            checklist={
                "locationAndTime": False,
                "mediaAndDate": False,
                "independentSource": False,
                "hazardStillPresent": False,
            },
            editorialNotes='Shona opt-in WhatsApp tip sent directly to newsroom tipline (private WhatsApp groups are never scraped). Fluent Shona editor should verify nuance of "kutsauka nzira" (swerving into oncoming lane vs shoulder) and cross-check against A5 cluster ROADS-0427.',
            unconfirmedSummary="Citizen-initiated Shona WhatsApp report describing a deep pothole on the A5 near the Plumtree turn-off causing vehicles to swerve.",
            duplicateClusterTitle="Possible link to A5 corridor cluster (ROADS-0427)",
            duplicateClusterSummary="Overlaps geographically with 3 A5 Plumtree-bound reports. Must check whether reporter is independent before counting as corroboration.",
            duplicateCandidates=[
                {
                    "id": "PZ-SIG-0038",
                    "sourceLabel": "Citizen report #0038",
                    "timestamp": "27 Jan, 08:15",
                    "summary": "Deep crater near Plumtree turn-off, east lane damaged",
                    "quote": "Hit a severe pothole near the turn-off, damaged wheel rim",
                    "locationNote": "A5 Bulawayo–Plumtree (~19.5 km)",
                }
            ],
            timeline=[
                {
                    "time": "27 Jan 2025, 09:31",
                    "description": "User-initiated WhatsApp submission ingested via tipline (direct opt-in message; private groups never scraped).",
                },
                {
                    "time": "27 Jan 2025, 09:33",
                    "description": "AI translated Shona phrase to English draft and extracted corridor (A5 · Bulawayo–Plumtree).",
                }
            ],
            isUserSubmitted=False,
            mapCoords={"xPct": 24.0, "yPct": 69.0},
        )

        sig3 = SignalReport(
            id="PZ-DEMO-0427",
            investigationCode="ROADS-0427",
            sourceChannelLabel="Citizen web",
            sourceChannelShort="Citizen web (opt-in)",
            sourceBadgeColor="green",
            visibility="opt-in",
            workflowStatus="verified",
            monitorStatusLabel="Verified · Approved",
            monitorStatusColor="green",
            inboxStatusLine="Citizen web · Verified",
            timeShort="08:45",
            reportedDateTime="27 Jan 2025, 08:45",
            title="Severe pothole cluster · A5 Plumtree Road",
            inboxTitle="Severe pothole cluster · A5 Plumtree Road",
            subtitle="Bellevue turn-off · Citizen verification baseline",
            corridor="A5 · Bulawayo–Plumtree",
            roadArea="A5 Bulawayo–Plumtree Road",
            landmark="Near Bellevue turn-off (~18 km west of CBD)",
            categoryKey="potholes",
            categoryLabel="Road surface damage",
            severityLabel="High",
            originalLanguage="English",
            originalQuote="“Large pothole cluster covering the entire outbound lane. Multiple vehicles swerving into oncoming traffic during morning commute.”",
            sourceProvenanceNote="Citizen web opt-in submission • 27 Jan 2025, 08:45 • verified by editor Rudo Moyo",
            evidenceLink=None,
            aiHazardType="Road surface damage / severe potholes",
            aiLikelyCorridor="A5 · Bulawayo–Plumtree Road",
            aiLanguageNote="English • original citizen submission",
            aiLocationPrecision="Corridor landmark corroborated by 2 independent motorists",
            aiConfidencePercent=78,
            aiConfidenceNote="78% • independently corroborated by desk",
            aiImageHeading="Submitted photo (corroborated road surface defect)",
            aiImageSummary="Photograph corroborated by independent commercial truck driver GPS log.",
            aiImageCaveat="Independently corroborated with ground checks.",
            photoType="figma-road-damage",
            isGraphicImage=False,
            pipelineStage=4,
            missingItems=[],
            checklist={
                "locationAndTime": True,
                "mediaAndDate": True,
                "independentSource": True,
                "hazardStillPresent": True,
            },
            editorialNotes="Corroborated by independent commercial driver GPS log and second witness report. Approved for public alert.",
            unconfirmedSummary="Severe pothole cluster on outbound A5 near Bellevue turn-off.",
            duplicateCandidates=[],
            timeline=[
                {"time": "27 Jan 2025, 08:45", "description": "Citizen web report received with photo."},
                {"time": "27 Jan 2025, 08:52", "description": "Editor corroborated location with second witness."},
                {"time": "27 Jan 2025, 09:10", "description": "All 4/4 editorial checks completed and approved by Editor Rudo Moyo."},
            ],
            isUserSubmitted=False,
            mapCoords={"xPct": 26.0, "yPct": 66.0},
        )

        db.add_all([sig1, sig2, sig3])
        db.commit()

    # 3. Seed Verified Public Alert
    if db.query(VerifiedPublicAlert).count() == 0:
        alert1 = VerifiedPublicAlert(
            id="PZ-PUB-PZ-DEMO-0427",
            sourceSignalId="PZ-DEMO-0427",
            title="Severe pothole cluster · A5 Plumtree Road",
            location="A5 Bulawayo–Plumtree Road (Near Bellevue turn-off)",
            corridor="A5 · Bulawayo–Plumtree",
            categoryKey="potholes",
            categoryLabel="Road surface damage",
            severity="High severity",
            isCritical=True,
            updatedAgo="Approved 27 Jan 2025, 09:10 CAT",
            approvedAtIso="2025-01-27T09:10:00Z",
            approvedAtReadable="27 Jan 2025, 09:10 CAT",
            description="Road surface damage: Independently corroborated road hazard at A5 Bulawayo–Plumtree Road near Bellevue turn-off. Outbound lane severely compromised.",
            sourceAttribution="Independently corroborated (4/4 editorial checks) · Approved by Rudo Moyo",
            desktopPin={
                "xPct": 26.0,
                "yPct": 66.0,
                "pinAsset": "pinVerified1",
            },
            approvedByName="Rudo Moyo",
        )
        db.add(alert1)
        db.commit()

    # 4. Seed Corridor Watch
    if db.query(CorridorWatch).count() == 0:
        cw_items = [
            CorridorWatch(
                id="A5",
                rank="01",
                name="A5 Bulawayo–Plumtree Corridor",
                fleetName="A5 · Bulawayo–Plumtree Corridor",
                badge="Active cluster · 8 unconfirmed leads",
                fleetBadge="High hazard density · Corridor alert active",
                badgeColor="red",
                submissionsSummary="14 submissions in 48h (8 awaiting corroboration)",
                hazardSummary="Deep crater cluster between Bellevue and Plumtree turn-off causing westbound vehicles to cross center line.",
                patternNote="Concentrated cluster along 4.2 km stretch; repeats after heavy rainfall.",
                fleetConfidenceLine="High confidence pattern · Human editorial review active",
                fleetRecommendation="Commercial fleet alert: Reduce speed to 40 km/h outbound near km marker 18-22.",
                scoreDisplay="84 / 100",
                scoreNumeric=84.0,
                confidenceLabel="Corroborated corridor pattern",
                positiveFactors=["Multiple independent witness accounts", "Corroborated by freight fleet GPS slowdowns", "Recent photographic evidence"],
                negativeFactors=["Precise council repair timetable unconfirmed"],
                whyLocationMobile="High freight transit density connecting Bulawayo to Botswana border.",
                missingMobile="Municipal patching schedule pending confirmation from City Engineer.",
                clusterCount=8,
                apiEndpoint="/api/public/corridors?id=A5",
            ),
            CorridorWatch(
                id="KHAMI",
                rank="02",
                name="Khami Road Corridor",
                fleetName="Khami Road Industrial Corridor",
                badge="Corridor monitoring · 4 unconfirmed leads",
                fleetBadge="Moderate hazard density · Drainage backlog",
                badgeColor="gold",
                submissionsSummary="7 submissions in 48h (4 awaiting corroboration)",
                hazardSummary="Drainage backlog causing flash ponding across eastbound carriageway near Kelvin North.",
                patternNote="Intermittent ponding during afternoon downpours.",
                fleetConfidenceLine="Moderate confidence · Requires ground check",
                fleetRecommendation="Industrial traffic alert: Avoid low-clearance vehicles near Kelvin North flyover.",
                scoreDisplay="62 / 100",
                scoreNumeric=62.0,
                confidenceLabel="Developing corridor lead",
                positiveFactors=["Multiple citizen notifications", "Consistent junction references"],
                negativeFactors=["No on-site measurement of flood depth"],
                whyLocationMobile="Primary heavy vehicle arterial serving western industrial zones.",
                missingMobile="Water level monitoring sensor reading.",
                clusterCount=4,
                apiEndpoint="/api/public/corridors?id=KHAMI",
            ),
            CorridorWatch(
                id="ESIGODINI",
                rank="03",
                name="Esigodini Road Corridor (A7)",
                fleetName="Esigodini Road · A7 Corridor",
                badge="Watch status · 2 unconfirmed leads",
                fleetBadge="Low hazard density · Routine monitoring",
                badgeColor="gold",
                submissionsSummary="3 submissions in 48h (2 awaiting corroboration)",
                hazardSummary="Loose gravel and shoulder wash-out near Matsheumhlope stream bridge.",
                patternNote="Recent road repair residue not swept off travel lanes.",
                fleetConfidenceLine="Developing pattern · Single witness reports",
                fleetRecommendation="Motorists advised to maintain safe following distance due to flying gravel.",
                scoreDisplay="48 / 100",
                scoreNumeric=48.0,
                confidenceLabel="Early stage lead",
                positiveFactors=["Exact landmark provided"],
                negativeFactors=["Awaiting second independent corroboration", "No photo submitted"],
                whyLocationMobile="High-speed arterial connecting Bulawayo to southern mining and agricultural districts.",
                missingMobile="Second independent verification.",
                clusterCount=2,
                apiEndpoint="/api/public/corridors?id=ESIGODINI",
            )
        ]
        db.add_all(cw_items)
        db.commit()

    # 5. Seed Working Brief
    if db.query(WorkingBrief).count() == 0:
        brief = WorkingBrief(
            investigationId="ROADS-0427",
            editorName="Rudo Moyo",
            dateLabel="27 Jan 2025 · Bulawayo Newsroom Desk",
            title="A5 Plumtree Corridor: Pothole density and commercial transit risks",
            dek="An editorial investigation into recurring road surface failure along the 18–22 km outbound stretch of the Bulawayo–Plumtree highway.",
            lead="Over the past 72 hours, Panzira AI has ingested 14 citizen signals and commercial driver reports identifying deep craters near the Bellevue and Plumtree turn-offs.",
            reportedPattern="Repetitive potholes reopening after rain downpours. Motorists frequently swerve into opposing lanes to avoid rim damage.",
            reportingPlan="1. Cross-check Bulawayo City Council and Ministry of Transport maintenance logs.\n2. Interview long-distance freight operators at Bellevue staging.\n3. Request procurement records for asphalt patching contracts on the A5 corridor.",
            questionsForAuthorities=[
                "When was the last capital resurfacing conducted on the A5 between km 15 and 25?",
                "What is the emergency maintenance turnaround time for classified highway potholes in the metropolitan area?",
                "Has council or the Ministry surveyed the drainage run-off contributing to recurring shoulder failure?",
            ],
            editorNotes="Prioritize interviews with cross-border bus drivers who navigate this stretch at night.",
            lastSavedAt="Saved 27 Jan 2025, 11:20 CAT (newsroom draft)",
        )
        db.add(brief)
        db.commit()
