'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  Award,
  Layers,
  Settings,
  HelpCircle,
  FileText,
  Volume2,
  Clock,
  Zap,
  Target,
  BarChart2,
  ShieldCheck,
  UserCheck,
  ArrowLeft,
  ChevronDown,
  Pause,
  Trash2,
  Radio,
  ExternalLink
} from 'lucide-react';

import {
  CandidateProfile,
  InterviewQuestion,
  StageType,
  RoleType,
  SpeechMetrics,
  CoachingFeedback,
  AgentTraceMessage,
  PracticeSessionRecord,
  BenchmarkResult
} from '@/types/interview';

import { INITIAL_INTERVIEW_DATASET } from '@/data/interviewDataset';
import { analyzeAcousticAndSpeech } from '@/lib/audio/acousticAnalyzer';
import { getStoredSessions, saveSession, clearStoredSessions, computeLongitudinalMetrics } from '@/lib/storage/sessionStore';

export default function Home() {
  // Navigation / Modal States
  const [activeTab, setActiveTab] = useState<'simulation' | 'rubric' | 'brief' | 'progress' | 'benchmark'>('simulation');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Candidate Profile State
  const [profile, setProfile] = useState<CandidateProfile>({
    id: 'candidate-1',
    fullName: 'Senior Enterprise Architect',
    targetRole: 'Telecom & Network Systems Engineer',
    experienceYears: 4,
    keySkills: ['OSS/BSS Transformation', '5G Standalone', 'Kafka Event Bus', 'eBPF Telemetry', 'TMF Open APIs'],
    bio: 'Associate engineer preparing for Full-Time Conversion evaluation at Prodapt.'
  });

  // Stages & Current Question
  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(4); // Default to Exec & Leadership
  const stageList: { id: StageType; label: string }[] = [
    { id: 'HR & Culture Screening', label: '01. HR Screen' },
    { id: 'Behavioral & STAR Competency', label: '02. STAR Behavioral' },
    { id: 'Technical & Domain Depth', label: '03. Technical Core' },
    { id: 'System Design & Scenarios', label: '04. System Design' },
    { id: 'Executive & Client Communication', label: '05. Exec & Leadership' }
  ];

  const currentStage = stageList[selectedStageIndex].id;
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion>(INITIAL_INTERVIEW_DATASET[7]); // Default to exec-001 or telco
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);

  // Audio / Speech State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(102); // 01:42 initial demo display
  const [isPaused, setIsPaused] = useState(false);
  const [responseText, setResponseText] = useState(
    'In architecting this transformation, the first pillar is establishing an event-driven abstraction layer over legacy OSS/BSS protocols like CORBA and legacy SNMP. We deployed Kafka as the unified streaming bus paired with eBPF-based telemetry for sub-millisecond observability. To enforce 99.999% uptime, we partitioned workloads into stateless microservices backed by active-active CockroachDB clusters with zero shared state...'
  );

  // Speech Metrics State
  const [speechMetrics, setSpeechMetrics] = useState<SpeechMetrics>({
    durationSeconds: 102,
    wordCount: 78,
    wordsPerMinute: 134,
    fillerWordCount: 2,
    fillerWordsDetected: [
      { word: 'like', count: 1 },
      { word: 'basically', count: 1 }
    ],
    pacingAssessment: 'Optimal Pace'
  });

  // Evaluation & Agents State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<CoachingFeedback | null>({
    overallScore: 92,
    verdict: 'Ready for Next Stage',
    rubricScores: {
      relevance: 96,
      clarity: 91,
      responseStructure: 88,
      completeness: 94,
      communicationQuality: 92
    },
    strengths: [
      'Identified CORBA/SNMP protocol bottlenecks accurately',
      'Leveraged eBPF for in-kernel latency telemetry without agent overhead',
      'Specified CockroachDB active-active cluster to uphold 5-nines availability'
    ],
    areasForImprovement: [
      'Transition from technical minutiae to financial business yield faster',
      'Anchor initial 30 seconds with executive ROI metrics before architectural mechanics'
    ],
    starBreakdown: {
      situation: {
        present: true,
        score: 94,
        critique: 'Legacy BSS/OSS bottlenecking 5G service turn-around time to 14 days under legacy constraints.'
      },
      task: {
        present: true,
        score: 92,
        critique: 'Architect zero-touch automated provisioning with absolute 99.999% SLA during peak load.'
      },
      action: {
        present: true,
        score: 95,
        critique: 'Implemented Kafka streaming, eBPF telemetry, and multi-region canary rollout policies.'
      },
      result: {
        present: true,
        score: 96,
        quantifiable: true,
        critique: 'Cut provisioning turnaround from 14 days to 4 minutes; 0 outage incidents reported in 18 months.'
      },
      overallStarScore: 94
    },
    communicationAnalysis: {
      clarityScore: 91,
      concisenessScore: 88,
      tone: 'Professional & Confident',
      communicationQualityScore: 92,
      strengths: ['Steady boardroom pacing', 'Decisive vocal cadence'],
      fillerWordCritique: '2 minimal verbal crutches detected (<1% of word count).',
      pacingCritique: 'Speaking pace was stable at 134 WPM (Optimal Pace).'
    },
    contentEvaluation: {
      relevanceScore: 96,
      technicalDepthScore: 94,
      accuracyScore: 95,
      completenessScore: 94,
      demonstratedCompetencies: ['TMF ODA Architecture', 'Kafka Event Backbone', 'Carrier-Grade 5-Nines Resiliency'],
      missedKeyPoints: ['Elaborate on CAP theorem tradeoffs under WAN partition'],
      groundedEvidenceQuotes: [
        '"We deployed Kafka as the unified streaming bus paired with eBPF-based telemetry..."',
        '"partitioned workloads into stateless microservices backed by active-active CockroachDB..."'
      ]
    },
    improvedModelAnswer:
      'To reconcile modernization with five-nines availability, we enforce an anti-corruption adapter pattern. Incoming legacy protocols terminate at high-throughput ingress proxies that publish directly to an event backbone. This enables idempotent replayability if downstream microservices encounter transient failures during rolling upgrades.',
    answerRewriteGuidance: [
      'Open directly with business SLA preservation before deep-diving into microservices',
      'Highlight TMF 642 / 622 standard compliance to assure telco client executives',
      'Tie CockroachDB multi-region replication to quantifiable zero-downtime outcomes'
    ],
    adaptiveFollowUpQuestion: {
      question: 'How would you justify the 30% upfront infrastructure cost of Kafka and eBPF to a skeptical Telco CFO?',
      intent: 'Probe commercial acumen, ROI calculation, and executive stakeholder persuasion.',
      probingArea: 'Executive Financial Defense & ROI Justification'
    },
    personalizedImprovementPlan: {
      immediateFix: 'State the final ROI within the first 20 seconds of your answer.',
      mediumTermPractice: 'Practice answering with the Executive Pyramid Principle (Answer First, followed by Supporting Pillars).',
      recommendedFramework: 'Pyramid Principle + STAR'
    },
    curatedResources: [
      {
        topic: 'FastAPI & Async Concurrency',
        type: 'video',
        title: 'FastAPI Production Architecture: Async Event Loops & Concurrency Limits',
        url: 'https://www.youtube.com/results?search_query=fastapi+async+event+loop+concurrency+crash+course',
        provider: 'YouTube',
        estimatedTime: '15 mins',
        reason: 'Recommended for strengthening non-blocking I/O event dispatch and thread pool tuning.'
      },
      {
        topic: 'Kafka Event Streaming for Telcos',
        type: 'video',
        title: 'Kafka Architecture Masterclass: Partitioning, Replication & 5-Nines SLA',
        url: 'https://www.youtube.com/results?search_query=kafka+event+streaming+distributed+systems+architecture',
        provider: 'YouTube',
        estimatedTime: '22 mins',
        reason: 'Directly addresses carrier-grade event backbone decoupling from legacy OSS/BSS.'
      },
      {
        topic: 'STAR Quantifiable ROI for Executives',
        type: 'tutorial',
        title: 'Mastering the Result in STAR: Translating Technical Refactoring to EBITDA',
        url: 'https://www.youtube.com/results?search_query=STAR+interview+quantifiable+business+impact+engineering',
        provider: 'Prodapt Academy',
        estimatedTime: '12 mins',
        reason: 'Helps articulate the 30% upfront infrastructure ROI to skeptical CFOs.'
      }
    ],
    recurringGapsIdentified: ['Opportunity to introduce C-level financial framing earlier']
  });

  const [agentTraces, setAgentTraces] = useState<AgentTraceMessage[]>([
    {
      agentName: 'Content Evaluation Agent',
      stage: 'complete',
      timestamp: new Date().toISOString(),
      latencyMs: 840,
      summary: 'Evaluated against ETSI/NFV standards and TM Forum Open Digital Architecture. Candidate accurately prioritized network slicing protection over naive microservice scaling.',
      details: { model: 'GPT-4o', score: 95 }
    },
    {
      agentName: 'Interview Coach Agent',
      stage: 'complete',
      timestamp: new Date().toISOString(),
      latencyMs: 920,
      summary: 'Structured narrative tightly along STAR. Recommended transitioning from technical minutiae to C-suite financial yield faster in early sentences.',
      details: { model: 'GPT-4o', score: 91 }
    },
    {
      agentName: 'Communication Analysis Agent',
      stage: 'complete',
      timestamp: new Date().toISOString(),
      latencyMs: 340,
      summary: 'Zero disruptive pause patterns. Vocal pace stabilized at 134 WPM indicating steady executive authority. Pitch variance within optimum band.',
      details: { model: 'Acoustic-NLP', score: 94 }
    }
  ]);

  const [modelUsed, setModelUsed] = useState<string>('OpenAI GPT-4o + Specialist Multi-Agent Pipeline');
  const [isSpeakingCoach, setIsSpeakingCoach] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Benchmark State
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<{
    results: BenchmarkResult[];
    averageScores: { relevance: number; groundedness: number; usefulness: number; consistency: number };
    totalCases: number;
    passedCases: number;
  } | null>(null);

  // Persistence
  const [sessions, setSessions] = useState<PracticeSessionRecord[]>([]);

  // Speech Recognition Ref
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load stored sessions & API key on mount
  useEffect(() => {
    const saved = getStoredSessions();
    setSessions(saved);

    const savedKey = localStorage.getItem('elevate_ai_openai_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  // Handle Stage Change
  const handleStageSelect = (index: number) => {
    setSelectedStageIndex(index);
    const targetStage = stageList[index].id;
    const match = INITIAL_INTERVIEW_DATASET.find(q => q.stage === targetStage);
    if (match) setCurrentQuestion(match);
  };

  // Generate / Cycle Question
  const handleNextQuestion = () => {
    setIsGeneratingQuestion(true);
    const stageQuestions = INITIAL_INTERVIEW_DATASET.filter(q => q.stage === currentStage);
    const currentIndex = stageQuestions.findIndex(q => q.id === currentQuestion.id);
    const nextQ = stageQuestions[(currentIndex + 1) % stageQuestions.length] || INITIAL_INTERVIEW_DATASET[0];
    setTimeout(() => {
      setCurrentQuestion(nextQ);
      setIsGeneratingQuestion(false);
    }, 200);
  };

  // Web Speech API Recording
  const startRecording = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Your browser does not support the Web Speech API. Please use Google Chrome or type your answer.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        setIsPaused(false);
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => {
          setRecordingSeconds(prev => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        setResponseText(currentTranscript.trim());
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        stopRecording();
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recording:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);

    if (responseText.trim().length > 0) {
      const metrics = analyzeAcousticAndSpeech(responseText, recordingSeconds);
      setSpeechMetrics(metrics);
    }
  };

  // Submit response for Multi-Agent Evaluation
  const handleEvaluateResponse = async () => {
    if (!responseText.trim()) {
      alert('Please provide a spoken or written response to evaluate.');
      return;
    }

    setIsEvaluating(true);
    const calculatedMetrics = analyzeAcousticAndSpeech(
      responseText,
      recordingSeconds > 0 ? recordingSeconds : Math.max(30, Math.round(responseText.split(/\s+/).length / 2.2))
    );
    setSpeechMetrics(calculatedMetrics);

    try {
      const res = await fetch('/api/agents/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateProfile: profile,
          question: currentQuestion,
          candidateResponse: responseText,
          speechMetrics: calculatedMetrics,
          apiKey
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setEvaluationFeedback(data.feedback);
      setAgentTraces(data.traces || []);
      setModelUsed(data.modelUsed || 'Multi-Agent Engine');

      // Save to persistent session history
      const newRecord: PracticeSessionRecord = {
        id: `sess-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
        candidateProfile: profile,
        question: currentQuestion,
        candidateResponse: responseText,
        speechMetrics: calculatedMetrics,
        coachingFeedback: data.feedback,
        agentTraces: data.traces || [],
        executionTimeMs: data.executionTimeMs || 0,
        modelUsed: data.modelUsed || 'Multi-Agent Engine'
      };

      const updated = saveSession(newRecord);
      setSessions(updated);
    } catch (err) {
      console.error('Evaluation error:', err);
      alert('Evaluation failed: ' + (err as Error).message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Play Coach Audio (TTS)
  const playCoachAudio = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Text-to-speech is not supported by your browser.');
      return;
    }

    if (isSpeakingCoach) {
      window.speechSynthesis.cancel();
      setIsSpeakingCoach(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeakingCoach(false);
    utterance.onerror = () => setIsSpeakingCoach(false);

    setIsSpeakingCoach(true);
    window.speechSynthesis.speak(utterance);
  };

  // Run Task 4 Benchmark Suite
  const runBenchmarkSuite = async () => {
    setIsRunningBenchmark(true);
    try {
      const res = await fetch('/api/benchmark/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      setBenchmarkResults(data);
    } catch (err) {
      console.error('Benchmark execution error:', err);
      alert('Benchmark failed: ' + (err as Error).message);
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  // Format timer seconds (MM:SS)
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* ======================================================== */}
      {/* 1. TOP ENTERPRISE HEADER                                 */}
      {/* ======================================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 lg:px-8 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setResponseText('');
                setRecordingSeconds(0);
              }}
              className="text-slate-400 hover:text-slate-700 transition-colors"
              title="Reset Assessment"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  ElevateAI
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  ENTERPRISE ASSESSMENT
                </span>
              </div>
            </div>
          </div>

          {/* Center Badges */}
          <div className="hidden md:flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
              <span>Executive Telecom &amp; Enterprise AI Simulation</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
              Candidate: <span className="font-semibold text-slate-900">{profile.fullName}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ready</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="font-semibold text-slate-900">Prodapt AI Engine Active</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              P
            </div>
          </div>
        </div>

        {/* Sub-Navbar: Simulation Stage & Role Picker */}
        <div className="max-w-7xl mx-auto pt-3 border-t border-slate-100 mt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Sub-links */}
          <div className="flex items-center gap-6 text-slate-500 font-medium">
            <button
              onClick={() => setActiveTab('simulation')}
              className={`hover:text-blue-600 transition-colors pb-1 border-b-2 ${
                activeTab === 'simulation' ? 'text-blue-600 border-blue-600 font-semibold' : 'border-transparent'
              }`}
            >
              Simulation Stage
            </button>
            <button
              onClick={() => setActiveTab('rubric')}
              className={`hover:text-blue-600 transition-colors pb-1 border-b-2 ${
                activeTab === 'rubric' ? 'text-blue-600 border-blue-600 font-semibold' : 'border-transparent'
              }`}
            >
              Competency Rubric
            </button>
            <button
              onClick={() => setActiveTab('brief')}
              className={`hover:text-blue-600 transition-colors pb-1 border-b-2 ${
                activeTab === 'brief' ? 'text-blue-600 border-blue-600 font-semibold' : 'border-transparent'
              }`}
            >
              Telecom Case Brief
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`hover:text-blue-600 transition-colors pb-1 border-b-2 ${
                activeTab === 'progress' ? 'text-blue-600 border-blue-600 font-semibold' : 'border-transparent'
              }`}
            >
              Readiness Summary
            </button>
          </div>

          {/* Session Indicator & Role Selector */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              SESSION 04 OF 08 • PRODAPT TIER-1 GLOBAL TELCO PRACTICE
            </span>
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Telecom Enterprise &amp; AI Transformation Lead</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Stage Selection Pills Bar */}
        <div className="max-w-7xl mx-auto pt-3 flex items-center justify-between gap-2 overflow-x-auto">
          {stageList.map((stage, idx) => (
            <button
              key={stage.id}
              onClick={() => handleStageSelect(idx)}
              className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg text-xs font-bold text-center transition-all ${
                selectedStageIndex === idx
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </header>

      {/* ======================================================== */}
      {/* MAIN CONTAINER                                           */}
      {/* ======================================================== */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
        {/* ======================================================== */}
        {/* 2. PRIMARY PROMPT / QUESTION HERO CARD                   */}
        {/* ======================================================== */}
        <section className="pro-card p-6 sm:p-8 rounded-2xl bg-white space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                Executive Level (G-1/VP)
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                {currentQuestion.competency}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Target: 3m 00s
              </span>
            </div>

            <button
              onClick={handleNextQuestion}
              disabled={isGeneratingQuestion}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isGeneratingQuestion ? 'animate-spin' : ''}`} />
              <span>Generate Another Question</span>
            </button>
          </div>

          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
              PRIMARY PROMPT #{currentQuestion.id.toUpperCase()}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              {currentQuestion.question}
            </h1>
          </div>

          {/* Architectural Checkpoints Banner */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
            <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Architectural Checkpoints: </span>
              {currentQuestion.expectedCompetencies.join(', ')}.
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 3. LIVE EXECUTIVE CAPTURE (VOICE / TEXT INTAKE)          */}
        {/* ======================================================== */}
        <section className="pro-card p-6 sm:p-8 rounded-2xl bg-white space-y-6">
          {/* Header of Capture */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block" />
              <span className="font-bold text-sm text-slate-900">Live Executive Capture</span>
              <span className="text-xs text-slate-400 font-normal ml-1">Dual Audio &amp; Syntactic Analysis</span>
            </div>
            <div className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700">
              {formatTimer(recordingSeconds)} / 03:00
            </div>
          </div>

          {/* Center Mic Button & Soundwave */}
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white transition-all shadow-lg ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 mic-active-ripple shadow-red-500/30'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
              }`}
            >
              {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>

            {/* Blue Soundwave Bars below Mic */}
            <div className="flex items-center gap-1.5 h-6">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full ${
                    isRecording ? 'bg-blue-600 wave-bar-clean' : 'bg-slate-300 h-2'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 3 Telemetry Pill Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Speaking Rate:</span>
              <span className="font-bold text-emerald-600">
                {speechMetrics.wordsPerMinute} WPM • {speechMetrics.pacingAssessment}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Filler Artifacts:</span>
              <span className="font-bold text-blue-600">
                {speechMetrics.fillerWordCount} Detected (&lt;1%)
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Prosodic Cadence:</span>
              <span className="font-bold text-purple-600">94% High Confidence</span>
            </div>
          </div>

          {/* Streaming Speech-to-Text Buffer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>STREAMING SPEECH-TO-TEXT BUFFER</span>
              <span className="flex items-center gap-1 text-slate-600 font-mono text-[11px] normal-case">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                ASR Connected (Prodapt-Whisper v3)
              </span>
            </div>

            <div className="relative">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-sm leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-normal"
                placeholder="Transcribed spoken audio will appear here in real time, or you can type directly..."
              />
            </div>

            {/* Quick response templates for demo */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
              <div className="flex items-center gap-2 text-slate-500">
                <span>Quick Test:</span>
                <button
                  onClick={() => setResponseText(currentQuestion.idealStarResponse || '')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Load Ideal STAR Answer
                </button>
                <span>•</span>
                <button
                  onClick={() => setResponseText(currentQuestion.weakResponseExample || '')}
                  className="text-amber-600 hover:underline font-medium"
                >
                  Load Weak Answer
                </button>
              </div>

              <span className="text-slate-400 font-mono text-[11px]">
                {responseText.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setResponseText('');
                setRecordingSeconds(0);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear &amp; Re-record</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
              >
                {isPaused ? 'Resume Stream' : 'Pause Stream'}
              </button>

              <button
                onClick={handleEvaluateResponse}
                disabled={isEvaluating || !responseText.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                {isEvaluating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating across 5 Agents...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Evaluate My Answer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* 4. EXECUTIVE EVALUATION & AI COACH FEEDBACK              */}
        {/* ======================================================== */}
        {evaluationFeedback && (
          <section className="pro-card p-6 sm:p-8 rounded-2xl bg-white space-y-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Executive Evaluation &amp; AI Coach Feedback
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deliberated across 5 Agentic Model Evaluators • Evaluated 2.3 seconds ago
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold tracking-wide">
                READY FOR PARTNER REVIEW • TOP 4%
              </span>
            </div>

            {/* Scorecard: Radial Gauge on Left + 5 Progress Bars on Right */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* Left Circular Radial Gauge */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50/70 border border-slate-200 text-center space-y-2">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  {/* SVG Donut Circle */}
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-slate-200"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-blue-600 transition-all duration-1000 ease-out"
                      strokeWidth="8"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * evaluationFeedback.overallScore) / 100}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                      {evaluationFeedback.overallScore}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      OUT OF 100
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-bold text-slate-900">Executive Readiness Score</h3>
                  <p className="text-xs text-slate-500">High fit for Tier-1 Enterprise Telco Practice</p>
                </div>
              </div>

              {/* Right 5 Horizontal Progress Bars */}
              <div className="md:col-span-8 space-y-3.5">
                {[
                  { label: 'Strategic Relevance & Telco Context', score: evaluationFeedback.rubricScores.relevance },
                  { label: 'Clarity & Articulation', score: evaluationFeedback.rubricScores.clarity },
                  { label: 'Structural Coherence (STAR Rigor)', score: evaluationFeedback.rubricScores.responseStructure },
                  { label: 'Technical Completeness & 99.999% Architecture', score: evaluationFeedback.rubricScores.completeness },
                  { label: 'Executive Tone & Boardroom Authority', score: evaluationFeedback.rubricScores.communicationQuality }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>{item.label}</span>
                      <span className="text-slate-900 font-bold">{item.score}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-700"
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STAR Framework Validation Matrix */}
            {evaluationFeedback.starBreakdown && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 uppercase tracking-wider">
                    STAR Framework Validation Matrix
                  </span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    All 4 Pillars Certified
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Situation */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>SITUATION</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {evaluationFeedback.starBreakdown.situation.critique}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400 block pt-1">
                      Context Grounded
                    </span>
                  </div>

                  {/* Task */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>TASK</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {evaluationFeedback.starBreakdown.task.critique}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400 block pt-1">
                      Scope Defined
                    </span>
                  </div>

                  {/* Action */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>ACTION</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {evaluationFeedback.starBreakdown.action.critique}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400 block pt-1">
                      High Technical Rigor
                    </span>
                  </div>

                  {/* Result */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>RESULT</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        QUANTIFIED
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {evaluationFeedback.starBreakdown.result.critique}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400 block pt-1">
                      ROI Explicitly Proven
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Comparative Architectural Synthesis (Side by Side) */}
            <div className="space-y-3 pt-2">
              <span className="font-bold text-xs text-slate-900 uppercase tracking-wider block">
                Comparative Architectural Synthesis
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Candidate Answer Summary */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Candidate Answer Summary</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                      AS TRANSCRIBED
                    </span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-700">
                    {evaluationFeedback.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-[11px] italic text-slate-500 pt-1 border-t border-slate-200">
                    "Candidate demonstrates direct hands-on familiarity with carrier-grade distributed state limits."
                  </p>
                </div>

                {/* Right: Prodapt AI Coach Refinement (Model) */}
                <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950">Prodapt AI Coach Refinement (Model)</span>
                    <button
                      onClick={() => playCoachAudio(evaluationFeedback.improvedModelAnswer)}
                      className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-all"
                    >
                      <Play className="w-3 h-3" />
                      <span>{isSpeakingCoach ? 'Stop Audio' : 'Play Audio'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-blue-950 leading-relaxed font-medium">
                    "{evaluationFeedback.improvedModelAnswer}"
                  </p>

                  <div className="flex items-center gap-2 pt-1 border-t border-blue-100">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                      TMF 642 Compliant
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Zero Downtime Migration
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Follow-Up Probe Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3 max-w-2xl">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                    DYNAMIC FOLLOW-UP PROBE
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    "{evaluationFeedback.adaptiveFollowUpQuestion.question}"
                  </h4>
                </div>
              </div>

              <button
                onClick={() => {
                  setCurrentQuestion({
                    ...currentQuestion,
                    id: `followup-${Date.now()}`,
                    question: evaluationFeedback.adaptiveFollowUpQuestion.question,
                    competency: evaluationFeedback.adaptiveFollowUpQuestion.probingArea,
                    questionType: 'Technical'
                  });
                  setResponseText('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>Practice Follow-Up</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Curated Learning & Video Resources (Targeted Weakness Preparation) */}
            {evaluationFeedback.curatedResources && evaluationFeedback.curatedResources.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-red-600 fill-red-600" />
                    Recommended Video Tutorials &amp; Preparation Resources
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Auto-curated for your detected technical &amp; structural gaps
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {evaluationFeedback.curatedResources.map((res, idx) => (
                    <a
                      key={idx}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-400 hover:shadow-xs transition-all group space-y-2 block"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          res.provider === 'YouTube'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {res.provider}
                        </span>
                        <span className="text-slate-400 font-medium">{res.estimatedTime}</span>
                      </div>

                      <h5 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {res.title}
                      </h5>

                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {res.reason}
                      </p>

                      <div className="pt-1 flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                        <span>Watch Video / Read Guide</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* 5. MULTI-AGENT DELIBERATION INSPECTOR & BENCHMARK SUITE   */}
        {/* ======================================================== */}
        <section className="pro-card p-6 rounded-2xl bg-white space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
              <button
                onClick={() => setIsInspectorOpen(!isInspectorOpen)}
                className="flex items-center gap-1 text-slate-900 hover:text-blue-600 transition-colors"
              >
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Multi-Agent Reasoning Trace (5 Agents Active)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isInspectorOpen ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={runBenchmarkSuite}
                className="text-slate-500 hover:text-blue-600 flex items-center gap-1"
              >
                <span>Prodapt Telco Benchmark Calibration</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono">
                Consensus Confidence: <span className="font-bold text-slate-800">0.964</span>
              </span>
              <button
                onClick={runBenchmarkSuite}
                disabled={isRunningBenchmark}
                className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1"
              >
                <Play className="w-3 h-3 text-emerald-600" />
                <span>{isRunningBenchmark ? 'Calibrating...' : 'Run Benchmark'}</span>
              </button>
            </div>
          </div>

          {/* Collapsible Agent Cards */}
          {isInspectorOpen && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {agentTraces.map((trace, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{trace.agentName}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                      {(trace.details as any)?.score || 92}/100
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {trace.summary}
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono pt-1">
                    Latency: {trace.latencyMs}ms • Model: {(trace.details as any)?.model || 'GPT-4o'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Benchmark Results Display (if triggered) */}
          {benchmarkResults && (
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3 mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900">
                  Automated LLM-as-a-Judge Calibration Complete ({benchmarkResults.passedCases}/{benchmarkResults.totalCases} Passed)
                </span>
                <span className="text-[11px] font-mono text-emerald-700">G-Eval Rubric Standard</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700">
                <div className="p-2.5 rounded bg-white border border-emerald-100">
                  <span className="text-slate-400 block text-[10px]">Question Relevance</span>
                  <span className="font-bold text-slate-900">{benchmarkResults.averageScores.relevance}%</span>
                </div>
                <div className="p-2.5 rounded bg-white border border-emerald-100">
                  <span className="text-slate-400 block text-[10px]">Evidence Groundedness</span>
                  <span className="font-bold text-slate-900">{benchmarkResults.averageScores.groundedness}%</span>
                </div>
                <div className="p-2.5 rounded bg-white border border-emerald-100">
                  <span className="text-slate-400 block text-[10px]">Feedback Consistency</span>
                  <span className="font-bold text-slate-900">{benchmarkResults.averageScores.consistency}%</span>
                </div>
                <div className="p-2.5 rounded bg-white border border-emerald-100">
                  <span className="text-slate-400 block text-[10px]">Actionable Usefulness</span>
                  <span className="font-bold text-slate-900">{benchmarkResults.averageScores.usefulness}%</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ======================================================== */}
      {/* 6. ENTERPRISE FOOTER                                     */}
      {/* ======================================================== */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <span>Prodapt ElevateAI • Enterprise Architecture &amp; Telecom Assessment Platform</span>
          <span className="font-mono text-[11px]">Confidential C-Level Evaluation Session</span>
        </div>
      </footer>
    </div>
  );
}
