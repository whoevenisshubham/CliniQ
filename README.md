# Current development status

The V2 containment branch temporarily closes legacy clinical APIs while trusted
identity, scoped services and database policies are upgraded. Historical feature
descriptions below are not V2 acceptance evidence. See
[security containment](docs/security-containment.md) for implemented behavior,
configuration, verification commands and remaining gates.

---

<div align="center">

# 🏥 CliniQ

### AI-Powered Clinical Decision Support & EMR Platform

**Voice-to-EMR** · **Drug Safety Guard** · **Jan Aushadhi Pricing** · **Offline-First** · **Blockchain Audit**

Built for Indian Healthcare | ABDM Compliant | ICD-10 Coded | FHIR-Compatible

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase)](https://supabase.com)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036)](https://groq.com)
[![Deepgram](https://img.shields.io/badge/Deepgram-STT-13EF93)](https://deepgram.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## 🎥 Demo — Voice-to-EMR in Action

https://github.com/user-attachments/assets/17ce1825-d1f7-4ae9-8618-06173dae5cdb


---

> **"Doctors spend up to 55% of their workday on documentation — more time than they spend with patients."**
>
> CliniQ eliminates that. The doctor speaks. The AI listens. The EMR fills itself.

---

## 📋 Table of Contents

- [The Problem](#-the-problem)
- [Our Solution](#-our-solution)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [API Routes](#-api-routes)
- [Demo Credentials](#-demo-credentials)

---

## 🔴 The Problem

| Pain Point | Impact |
|---|---|
| **Documentation Overload** | Doctors spend ~15.5 hrs/week on paperwork (Medscape 2023) |
| **Physician Burnout** | 45–63% of physicians report burnout from EHR burden |
| **Drug Safety Gaps** | 6.7% of hospital admissions in India are due to Adverse Drug Reactions |
| **Expensive Medicines** | Patients unaware Jan Aushadhi generics are 50–90% cheaper |
| **Rural Connectivity** | Cloud-only EMRs fail for 70% of India's rural population |
| **Weak Audit Trails** | 75% of malpractice cases involve inadequate documentation |

---

## 💡 Our Solution

```
🎙️ Doctor Speaks  →  🧠 AI Understands  →  📋 EMR Auto-Fills
   (Deepgram STT)      (Llama 3.3 70B)      (ICD-10, Rx, Vitals)
```

CliniQ transforms natural doctor-patient conversations into **structured, coded, and auditable medical records** — in real time. Zero typing. Zero forms. Zero learning curve.

---

## ✨ Key Features

### 🎙️ AI Medical Scribe (Voice-to-EMR)
Real-time speech-to-text via **Deepgram WebSocket** supporting **English, Hindi, and Hinglish**. The AI transcribes conversations live — interim text in grey, finalized in white — with language auto-detection, word count, and duration tracking.

### 🧠 Clinical NLP Extraction
Every 20 seconds, the transcript is sent to **Llama 3.3 70B via Groq** which extracts:
- **Vitals**: BP, HR, SpO₂, Temperature, Weight, Height
- **Symptoms**, **Diagnosis**, **Physical Examination**
- **ICD-10 Codes** with confidence scores
- **Medications** with dosage, frequency, duration
- **Lab Tests** ordered
- **Gap Prompts** — AI detects missing clinical information and nudges the doctor

### 🔬 AI Differential Diagnosis
Ranked **Top 5 differential diagnoses** with probability scores, clinical reasoning, suggested confirmatory tests, and ICD-10 codes — all influenced by seasonal epidemiology.

### 🌍 Adaptive Epidemiology Engine (India-Specific)
Contextualizes diagnosis by **season + city** for **11 major Indian cities**:
- 5 Indian seasons: Winter, Summer, Pre-Monsoon, Monsoon, Post-Monsoon
- City-specific disease profiles: Dengue-endemic zones, Malaria belts, TB hotspots
- Automatically boosts relevant conditions by 15–30% in differential probability

### 🛡️ Drug Safety Guard
Real-time prescription safety checks:
- **Drug-Drug Interactions** (e.g., Warfarin + Aspirin = bleeding risk)
- **Allergy Cross-Reactions** (e.g., Aspirin allergy → contraindicate all NSAIDs)
- **Severity Levels**: Critical → High → Medium → Low
- **Override with accountability** — doctor must document reason, logged in audit chain

### 💊 Jan Aushadhi Generic Drug Engine
For every prescribed medication, instantly shows:
- **Brand price** vs **Generic price** vs **Jan Aushadhi price**
- **Savings percentage** (typically 50–90%)
- **Nearest Jan Aushadhi store** with distance
- Database of **60+ molecules** across all major clinical categories

### 💰 Live Billing Engine
Parses transcript in real-time to auto-detect billable events:
- Consultation fees, procedures, investigations, equipment
- Itemized bill with GST calculation
- Zero recall errors, zero revenue leakage

### 🔗 Blockchain-Style Audit Trail
Every clinical action generates a **SHA-256 hashed, append-only** audit entry:
- Each entry chains to previous via `previous_hash` — tamper-evident
- Database-enforced: **INSERT-only** — no UPDATE, no DELETE possible
- Events: `CONSULTATION_STARTED` → `CONSENT_RECORDED` → `EMR_UPDATED` → `ALERT_OVERRIDDEN` → `CONSULTATION_ENDED`

### 📴 Offline-First (Rural Mode)
Full offline functionality for rural Primary Health Centres:
- Consultations saved to **localStorage** when offline
- **Auto-sync** uploads queued data when connectivity returns
- Visual indicators: online/offline status, pending sync count

### 🚑 Ambulance Triage Module
Pre-arrival emergency data from EMT radio patches:
- 5 realistic scenarios: STEMI, Polytrauma RTA, Dengue Shock, Stroke, Severe Asthma
- Pre-fills vitals, treatments given, priority level, triage color
- Auto-generates ER prep notes

### 🤖 Patient AI Chatbot
EMR-context-aware AI assistant for patients:
- Answers questions about medications, diagnoses, and treatment plans
- Grounded in the patient's own medical records
- Simple language, no jargon, with medical disclaimers

### 🔒 Vision Anonymizer
De-identify medical images for research:
- Auto-blurs patient names, IDs, and faces
- Download anonymized versions
- Contribute de-identified data to research datasets

### 👥 5 Role-Based Dashboards

| Role | Dashboard |
|---|---|
| **Doctor** | Consultation workspace, EMR, Safety, Billing, Patients |
| **Patient** | Health portal, AI Chatbot, Prescriptions, Reports |
| **Admin** | Analytics, Audit logs, User management, Settings |
| **Receptionist** | Front desk, Queue management, Patient registration |
| **Researcher** | Anonymized data, Epidemiological trends |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Frontend** | React 19, Radix UI, Framer Motion |
| **Styling** | Tailwind CSS 4 |
| **State** | Zustand (with DevTools) |
| **Database** | Supabase (PostgreSQL + Row-Level Security + Realtime) |
| **AI / LLM** | Groq SDK → Llama 3.3 70B (sub-second inference) |
| **Speech-to-Text** | Deepgram SDK (real-time WebSocket, multilingual) |
| **Charts** | Recharts |
| **PDF** | jsPDF |
| **Icons** | Lucide React |
| **Theming** | next-themes (dark/light mode) |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Doctor   │  │ Patient  │  │  Admin   │  │Reception │       │
│  │Dashboard  │  │ Portal   │  │ Panel    │  │  Desk    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       └──────────────┴──────────────┴──────────────┘            │
│                           │                                     │
│  ┌────────────────────────┴────────────────────────────┐       │
│  │              Zustand Global Store                    │       │
│  │  EMR State · Safety Alerts · Billing · Audit Chain  │       │
│  └────────────────────────┬────────────────────────────┘       │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                     API ROUTES (Next.js)                         │
│  /api/extract  /api/safety  /api/billing  /api/audit            │
│  /api/patient-bot  /api/consultations  /api/auth                │
└───────────┬──────────┬──────────┬───────────────────────────────┘
            │          │          │
   ┌────────┴──┐  ┌────┴────┐  ┌─┴──────────┐
   │  Groq API │  │Deepgram │  │  Supabase  │
   │Llama 3.3  │  │  STT    │  │ PostgreSQL │
   │  70B      │  │WebSocket│  │  + RLS     │
   └───────────┘  └─────────┘  └────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (for database)
- Groq API key (for AI extraction)
- Deepgram API key (for speech-to-text)

### Installation

```bash
# Clone the repository
git clone https://github.com/whoevenisshubham/CliniQ.git
cd CliniQ

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Groq (AI/LLM)
GROQ_API_KEY=your_groq_api_key

# Deepgram (Speech-to-Text)
DEEPGRAM_API_KEY=your_deepgram_api_key
```

### Database Setup

Run the migration file against your Supabase instance:

```sql
-- Located at: supabase/migrations/001_nexusmd_schema.sql
-- Creates all tables with Row-Level Security policies
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the login page.

---

## 📁 Project Structure

```
CliniQ/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── doctor/             # Doctor dashboard & sub-pages
│   │   │   ├── consultation/   # Active consultation (core feature)
│   │   │   ├── patients/       # Patient management
│   │   │   ├── emr/            # EMR records viewer
│   │   │   ├── alerts/         # Safety alerts dashboard
│   │   │   └── billing/        # Billing management
│   │   ├── patient/            # Patient portal
│   │   │   ├── chat/           # AI chatbot
│   │   │   ├── prescriptions/  # Prescription viewer
│   │   │   ├── reports/        # Lab reports
│   │   │   └── appointments/   # Appointments
│   │   ├── admin/              # Admin dashboard
│   │   │   ├── analytics/      # Recharts analytics
│   │   │   ├── audit/          # Audit trail viewer
│   │   │   ├── users/          # User management
│   │   │   └── settings/       # System settings
│   │   ├── receptionist/       # Front desk
│   │   ├── research/           # Research portal
│   │   ├── api/                # 13 API routes
│   │   └── login/              # Authentication
│   │
│   ├── components/             # 36+ React components
│   │   ├── doctor/             # Doctor-specific components
│   │   ├── patient/            # Patient-specific components
│   │   ├── admin/              # Admin-specific components
│   │   ├── shared/             # Shared components (Sidebar, Anonymizer)
│   │   └── ui/                 # Radix UI primitives
│   │
│   ├── lib/                    # Core modules
│   │   ├── safety-guard.ts     # Drug interaction & allergy checker
│   │   ├── jan-aushadhi.ts     # Generic drug pricing engine (60+ molecules)
│   │   ├── epidemiology.ts     # Seasonal disease context (11 cities)
│   │   ├── billing-engine.ts   # Real-time billing parser
│   │   ├── audit-chain.ts      # SHA-256 blockchain audit trail
│   │   ├── triage.ts           # Ambulance triage scenarios
│   │   ├── offline-queue.ts    # Offline-first localStorage queue
│   │   └── types.ts            # TypeScript type definitions
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useMedicalScribe.ts # Deepgram real-time transcription
│   │   └── useOfflineSync.ts   # Offline sync management
│   │
│   └── store/
│       └── consultationStore.ts # Zustand global state
│
└── supabase/
    └── migrations/
        └── 001_nexusmd_schema.sql # Complete database schema
```

---

## 🗄️ Database Schema

**9 tables** with Row-Level Security (RLS):

| Table | Purpose |
|---|---|
| `users` | All user accounts with role-based access |
| `patients` | Patient demographics, allergies, chronic conditions, ABHA ID |
| `consultations` | Consultation sessions with status tracking |
| `emr_entries` | Structured EMR data (vitals, symptoms, diagnosis, ICD codes) |
| `safety_alerts` | Drug interaction and allergy alerts with override history |
| `prescriptions` | Medication prescriptions with Jan Aushadhi pricing |
| `billing` | Itemized billing with GST calculation |
| `audit_log` | Immutable SHA-256 hash-chained audit entries (INSERT-only) |
| `fhir_bundles` | FHIR-lite compatible health record exports |

---

## 🔌 API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Demo authentication |
| `/api/auth/logout` | POST | Session termination |
| `/api/extract` | POST | Clinical NLP extraction + differential diagnosis via Groq |
| `/api/safety` | POST | Drug interaction & allergy safety check |
| `/api/safety/live` | POST | Real-time transcript safety scanning |
| `/api/patient-bot` | POST | Patient AI chatbot (EMR-context-aware) |
| `/api/consultations` | GET/POST/PATCH | Consultation CRUD |
| `/api/consultations/[id]/emr` | POST | Save EMR extraction data |
| `/api/consultations/[id]/prescriptions` | POST | Save prescriptions |
| `/api/consultations/[id]/billing` | POST | Save billing draft |
| `/api/audit` | GET/POST | Audit trail management |
| `/api/queue` | GET/PATCH | Patient queue management |
| `/api/deepgram-key` | GET | Secure Deepgram key delivery |

---

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Doctor** | `demo.doctor@nexusmd.app` | `demo123456` |
| **Patient** | `demo.patient@nexusmd.app` | `demo123456` |
| **Admin** | `demo.admin@nexusmd.app` | `demo123456` |
| **Receptionist** | `demo.reception@nexusmd.app` | `demo123456` |

> One-click demo login buttons are available on the login page — no signup required.

---

## 📊 Key Metrics

| Metric | Value |
|---|---|
| Source Files | **115+** |
| React Components | **36+** |
| API Routes | **13** |
| Database Tables | **9** (all with RLS) |
| Drug Database | **60+ molecules** |
| Supported Cities | **11 Indian cities** |
| User Roles | **5** |
| Triage Scenarios | **5** |

---

## 🏆 Key Differentiators

| # | Feature | What Makes It Unique |
|---|---|---|
| 1 | **Zero Manual Entry** | Voice-in → Structured EMR-out, no typing |
| 2 | **India-Contextualized AI** | Seasonal epidemiology for 11 cities |
| 3 | **Medicolegal Shield** | SHA-256 blockchain audit chain, immutable |
| 4 | **Cost Transparency** | Jan Aushadhi pricing at point of care |
| 5 | **Offline-First** | Works in rural India without internet |
| 6 | **Patient Safety** | Real-time drug interaction + allergy guard |
| 7 | **Multilingual** | English + Hindi + Hinglish transcription |
| 8 | **Sub-Second AI** | Fastest LLM inference (Groq) + fastest STT (Deepgram) |

---

<div align="center">

**CliniQ** — *Every Word Heals.*

Made with ❤️ for Indian Healthcare

</div>
