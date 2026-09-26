# ElevateAI — Autonomous Multi-Agent Interview & Communication Coaching Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-green?style=flat&logo=openai)](https://openai.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/Enterprise-Prodapt%20FTE%20Capstone-blueviolet)](#)

> **ElevateAI** is an enterprise-grade AI coaching platform designed to elevate candidate communication, confidence, and structured problem-solving across 5 rigorous interview stages (HR, Behavioral STAR, Technical Depth, System Design, and Executive Presentation). Built with a specialized 5-agent distributed workflow, real-time acoustic speech heuristics, and an automated LLM-as-a-judge benchmark suite.

---

## 🌟 Key Features

1. **5 Specialist Autonomous Agents (Task 3)**:
   - **Interview Question Agent**: Curated & dynamic question generation aligned to candidate profile and target role.
   - **Communication Analysis Agent**: Clarity, conciseness, vocal tone, and filler word diagnostics (`um`, `uh`, `like`, `basically`).
   - **Content Evaluation Agent**: Technical depth, accuracy, domain rigor (OSS/BSS, 5G SA, Kafka, Sagas), and verbatim grounded citations.
   - **STAR Structure Agent**: Deconstructs behavioral responses into Situation, Task, Action, and Quantifiable Result.
   - **Lead Interview Coach Agent**: Holistic rubric synthesis, improved rewritten model answers, voice narration, and longitudinal plans.
2. **Real-Time Voice Intake & Acoustic Analyzer (Task 2)**:
   - Instant in-browser Speech-to-Text via Web Speech API with live audio waveform animation.
   - Real-time **Words Per Minute (WPM)** pacing assessment and verbal crutch frequency counter.
   - Text-to-Speech (TTS) voice playback of the Coach's model answer.
3. **Automated LLM-as-a-Judge Benchmark Suite (Task 4)**:
   - Built-in test suite evaluating Question Relevance, Evidence Groundedness, Feedback Consistency, and Actionability across standardized test cases.
4. **Zero-Failure Fallback Engine**:
   - Primary: OpenAI GPT-4o / GPT-4o-mini.
   - Fallback: Offline deterministic rule engine ensuring 100% demo reliability even with empty or exhausted API keys.
5. **Interactive Architecture Visualizer & Deliverables (Task 5)**:
   - Built-in SVG Architecture visualizer, trade-off matrix, and 10-minute presentation guide.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ (tested on Node.js v20 / v26)
- npm or pnpm

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-repo/elevate-ai.git
cd elevate-ai
npm install
```

### 2. Configure Environment (Optional)
Create a `.env.local` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
```
> *Note: You can also leave this empty and input your API key directly inside the in-app Settings modal, or test in Offline Fallback Mode.*

### 3. Run Locally
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## 📋 Sample Usage & End-to-End Workflow

### Sample Input
- **Candidate Profile:** Ankush (Telecom & Network Systems Engineer, 3 YOE)
- **Stage:** Behavioral & STAR Competency
- **Question:** *"Describe a challenging situation where you had a strong technical disagreement with a team member or architect. How did you resolve it?"*
- **Candidate Spoken Response:**
  > *"Situation: During the redesign of our real-time notification engine, a senior architect favored maintaining our legacy polling system while I proposed switching to Server-Sent Events (SSE). Task: I needed to resolve the deadlock without stalling the sprint deadline. Action: I built a quick 2-day proof-of-concept benchmark measuring server memory, TCP socket utilization, and throughput under 10,000 concurrent mock connections. The data demonstrated that SSE reduced server load by 58%. I scheduled a collaborative review, presented the empirical results respectfully, and addressed his failover concerns by adding reconnect logic. Result: The team adopted the SSE architecture, the feature shipped on schedule, and we eliminated $1,200/month in idle polling cloud costs."*

### Sample Coaching Output
- **Overall Score:** 92/100 (`Ready for Next Stage`)
- **STAR Deconstruction:**
  - **Situation (S):** 90% — *"Specific architectural dispute clearly framed."*
  - **Task (T):** 88% — *"Distinct personal ownership under sprint pressure."*
  - **Action (A):** 95% — *"Empirical benchmarking and collaborative RFC review."*
  - **Result (R):** 96% (`Quantifiable: True`) — *"58% server load reduction and $1,200/mo cost savings."*
- **Acoustic Metrics:** 138 WPM (Optimal Pace), 0 Filler Words detected.
- **Adaptive Follow-Up:** *"If your initial SSE gateway experienced connection drops under edge mobile networks, how would you architect heartbeat telemetry?"*

---

## 🎤 10-Minute Presentation Script (8 Min Demo + 2 Min Q&A)

| Time Window | Segment | Key Talking Points |
| :--- | :--- | :--- |
| **0:00 - 1:30** | **Introduction & Problem Statement** | Introduce ElevateAI. Emphasize why static prep fails and how ElevateAI's 5-Agent architecture solves this for Prodapt's technical hiring tracks. |
| **1:30 - 4:00** | **Live Voice Practice Demo** | Select Telecom / Behavioral track. Click "Speak Answer" to demonstrate live speech recognition, waveform visualizer, and instant WPM/filler word detection. |
| **4:00 - 6:30** | **Multi-Agent Breakdown & A2A Trace** | Open the Coaching Report. Show the STAR breakdown with the "Quantified Result" badge. Open the Agent Reasoning Trace drawer to show parallel dispatch and A2A handoffs. Click "Listen to Coach Answer" for TTS. |
| **6:30 - 8:00** | **Benchmark Suite & Architecture** | Switch to the "Benchmark & Arch" tab. Click "Run Benchmark Suite" to demonstrate LLM-as-a-judge empirical validation. Walk through the architecture trade-offs. |
| **8:00 - 10:00** | **Panel Q&A Defense** | Answer questions on latency optimization ($<1.5$s parallel dispatch), decoupled STT cost savings (95%), and the deterministic fallback engine. |

---

## 📁 Repository Structure

```
elevate-ai/
├── data/
│   └── interview_dataset.json     # Curated 5-stage interview dataset (PRD Task 1)
├── public/
│   └── architecture_diagram.svg   # High-resolution architecture deliverable (PRD Task 5)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/
│   │   │   │   ├── evaluate/route.ts          # Multi-agent evaluation endpoint
│   │   │   │   └── generate-question/route.ts # Dynamic question generator
│   │   │   └── benchmark/run/route.ts         # Automated LLM-as-a-judge runner
│   │   ├── globals.css            # Dark mode tokens & waveform animations
│   │   ├── layout.tsx             # Root layout & enterprise metadata
│   │   └── page.tsx               # Main interactive application (5 user views)
│   ├── data/
│   │   ├── interviewDataset.ts    # Curated interview questions bank
│   │   └── benchmarkDataset.ts    # 5 standard evaluation test cases
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── orchestrator.ts        # 5-Agent parallel orchestrator & A2A bus
│   │   │   ├── questionAgent.ts       # Interview Question Agent
│   │   │   └── offlineEngine.ts       # Deterministic zero-failure fallback engine
│   │   ├── audio/
│   │   │   └── acousticAnalyzer.ts    # WPM, duration, filler word heuristics
│   │   ├── evaluation/
│   │   │   └── benchmarkRunner.ts     # Automated benchmark evaluator
│   │   └── storage/
│   │       └── sessionStore.ts        # Longitudinal gap & trend analytics store
│   └── types/
│       └── interview.ts           # Comprehensive TypeScript interfaces
├── DESIGN_AND_ARCHITECTURE.md     # System design & trade-off rationale deliverable
├── package.json
└── README.md
```

---

## 🚢 Production Deployment to Vercel

ElevateAI is engineered as a zero-cold-start Next.js serverless microservice, ready for instant one-click deployment:

1. Push code to GitHub:
   ```bash
   git init && git add . && git commit -m "feat: complete ElevateAI platform"
   ```
2. Link your repo on **[Vercel Dashboard](https://vercel.com/)** and click **Deploy**.
3. (Optional) Set `OPENAI_API_KEY` in Vercel Environment Variables.
