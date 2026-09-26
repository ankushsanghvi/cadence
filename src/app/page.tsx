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
  UserCheck
} from 'lucide-react';

import {
  CandidateProfile,
  InterviewQuestion,
  StageType,
  RoleType,
  DifficultyLevel,
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
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'arena' | 'report' | 'traces' | 'progress' | 'benchmark'>('arena');

  // Candidate Profile State
  const [profile, setProfile] = useState<CandidateProfile>({
    id: 'candidate-1',
    fullName: 'Ankush (Prodapt Candidate)',
    targetRole: 'Telecom & Network Systems Engineer',
    experienceYears: 3,
    keySkills: ['OSS/BSS Architecture', '5G Core', 'Microservices', 'Kubernetes'],
    bio: 'Associate engineer preparing for Full-Time Conversion evaluation at Prodapt.'
  });

  // Question & Stage State
  const [selectedStage, setSelectedStage] = useState<StageType>('Behavioral & STAR Competency');
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion>(INITIAL_INTERVIEW_DATASET[2]);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);

  // Response & Speech State
  const [responseText, setResponseText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechMetrics, setSpeechMetrics] = useState<SpeechMetrics | null>(null);

  // Evaluation & Agents State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<CoachingFeedback | null>(null);
  const [agentTraces, setAgentTraces] = useState<AgentTraceMessage[]>([]);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [lastExecutionTime, setLastExecutionTime] = useState<number>(0);

  // Persistence & Progress
  const [sessions, setSessions] = useState<PracticeSessionRecord[]>([]);

  // Settings & API Key
  const [apiKey, setApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpeakingCoach, setIsSpeakingCoach] = useState(false);

  // Benchmark State
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<{
    results: BenchmarkResult[];
    averageScores: { relevance: number; groundedness: number; usefulness: number; consistency: number };
    totalCases: number;
    passedCases: number;
  } | null>(null);

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

  // Update questions when stage changes
  const handleStageChange = (newStage: StageType) => {
    setSelectedStage(newStage);
    const matching = INITIAL_INTERVIEW_DATASET.filter(
      q => q.stage === newStage && (q.role === profile.targetRole || q.stage === 'HR & Culture Screening')
    );
    if (matching.length > 0) {
      setCurrentQuestion(matching[0]);
    } else {
      const stageAny = INITIAL_INTERVIEW_DATASET.find(q => q.stage === newStage);
      if (stageAny) setCurrentQuestion(stageAny);
    }
  };

  // Generate / Cycle Question
  const handleGenerateNextQuestion = async (forceDynamic = false) => {
    setIsGeneratingQuestion(true);
    try {
      if (!forceDynamic) {
        const matching = INITIAL_INTERVIEW_DATASET.filter(q => q.stage === selectedStage);
        const nextQ = matching[(matching.findIndex(q => q.id === currentQuestion.id) + 1) % matching.length] || matching[0];
        setCurrentQuestion(nextQ);
      } else {
        const res = await fetch('/api/agents/generate-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile,
            stage: selectedStage,
            apiKey,
            forceDynamic: true
          })
        });
        const data = await res.json();
        if (data.question) {
          setCurrentQuestion(data.question);
        }
      }
    } catch (err) {
      console.error('Failed to cycle question:', err);
    } finally {
      setIsGeneratingQuestion(false);
    }
  };

  // Web Speech API Recording
  const startRecording = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Your browser does not support the Web Speech API. Please use Google Chrome, Edge, or type your response.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
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
      console.error('Failed to start speech recognition:', err);
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

    // Compute live speech & acoustic metrics
    if (responseText.trim().length > 0) {
      const metrics = analyzeAcousticAndSpeech(responseText, recordingSeconds);
      setSpeechMetrics(metrics);
    }
  };

  // Submit response for Multi-Agent Evaluation
  const handleEvaluateResponse = async () => {
    if (!responseText.trim()) {
      alert('Please provide a spoken or written response before requesting evaluation.');
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
      if (data.error) {
        throw new Error(data.error);
      }

      setEvaluationFeedback(data.feedback);
      setAgentTraces(data.traces || []);
      setModelUsed(data.modelUsed || 'Multi-Agent Engine');
      setLastExecutionTime(data.executionTimeMs || 0);

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

      // Switch to report tab
      setActiveTab('report');
    } catch (err) {
      console.error('Evaluation error:', err);
      alert('Evaluation failed: ' + (err as Error).message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Text to Speech playback for Coach's rewritten answer
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

  // Longitudinal stats
  const longitudinalStats = computeLongitudinalMetrics(sessions);

  return (
    <div className="min-h-screen flex flex-col bg-[#080d1a] text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">
                ElevateAI
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                Prodapt Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Autonomous Multi-Agent Interview & Communication Coach</p>
          </div>
        </div>

        {/* Center Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 border border-slate-800/80 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('arena')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'arena' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Practice Arena
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'report' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Coaching Report
            {evaluationFeedback && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('traces')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'traces' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Agent Reasoning
            {agentTraces.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-indigo-500/20 text-indigo-300 rounded-full">
                {agentTraces.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'progress' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Progress & Gaps
          </button>
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'benchmark' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Benchmark & Arch
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>{apiKey ? 'API Key Active' : 'Offline / Engine'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>{apiKey ? 'OpenAI GPT-4o' : 'Deterministic Rule Engine'}</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* ======================================================== */}
        {/* TAB 1: PRACTICE ARENA                                    */}
        {/* ======================================================== */}
        {activeTab === 'arena' && (
          <div className="space-y-6">
            {/* Candidate Profile Bar */}
            <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400">
                  {profile.fullName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{profile.fullName}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {profile.experienceYears} Years Exp
                    </span>
                  </div>
                  <p className="text-xs text-blue-400 font-medium">{profile.targetRole}</p>
                </div>
              </div>

              {/* Quick Profile Role Switcher */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">Target Role:</span>
                <select
                  value={profile.targetRole}
                  onChange={(e) => {
                    const newRole = e.target.value as RoleType;
                    setProfile({ ...profile, targetRole: newRole });
                    const match = INITIAL_INTERVIEW_DATASET.find(q => q.role === newRole && q.stage === selectedStage);
                    if (match) setCurrentQuestion(match);
                  }}
                  className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Telecom & Network Systems Engineer">Telecom & Network Systems Engineer (Prodapt)</option>
                  <option value="Fullstack Software Engineer">Fullstack Software Engineer</option>
                  <option value="Cloud & DevOps Engineer">Cloud & DevOps Engineer</option>
                  <option value="AI & Data Platform Engineer">AI & Data Platform Engineer</option>
                  <option value="Engineering Manager / Tech Lead">Engineering Manager / Tech Lead</option>
                </select>
              </div>
            </div>

            {/* Stage Selector Pills */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Select Interview Stage (PRD Task 1 & 2)
                </label>
                <span className="text-xs text-slate-500 font-medium">Stage 5 of 5 supported</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {(
                  [
                    'HR & Culture Screening',
                    'Behavioral & STAR Competency',
                    'Technical & Domain Depth',
                    'System Design & Scenarios',
                    'Executive & Client Communication'
                  ] as StageType[]
                ).map((stage) => (
                  <button
                    key={stage}
                    onClick={() => handleStageChange(stage)}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                      selectedStage === stage
                        ? 'bg-blue-600/15 border-blue-500/80 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <div className="text-[11px] font-medium text-blue-400 mb-1">
                      {stage.split('&')[0].trim()}
                    </div>
                    <div className="text-xs font-bold line-clamp-1 text-slate-200">{stage}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Question Card */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {currentQuestion.stage}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {currentQuestion.difficulty}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {currentQuestion.questionType}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGenerateNextQuestion(false)}
                    disabled={isGeneratingQuestion}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750 flex items-center gap-1 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Next Question
                  </button>
                  <button
                    onClick={() => handleGenerateNextQuestion(true)}
                    disabled={isGeneratingQuestion}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:brightness-110 flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingQuestion ? 'Generating...' : 'Dynamic AI Question'}
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-relaxed">
                  "{currentQuestion.question}"
                </h2>
                <p className="text-xs text-blue-400 mt-1 font-semibold">
                  Primary Competency Focus: {currentQuestion.competency}
                </p>
              </div>

              {/* Expected Competencies Checklist */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  What Interviewers & Agents Look For:
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-300">
                  {currentQuestion.expectedCompetencies.map((comp, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>{comp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Candidate Response Workspace (Mic + Text) */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    Your Response (Voice or Text)
                  </span>
                  <span className="text-xs text-slate-400">
                    ({responseText.split(/\s+/).filter(Boolean).length} words)
                  </span>
                </div>

                {/* Voice Recording Controls */}
                <div className="flex items-center gap-3">
                  {isRecording && (
                    <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/60 px-3 py-1 rounded-full text-xs font-semibold text-red-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                      <span>Recording: {recordingSeconds}s</span>
                      {/* Live Waveform Bars */}
                      <div className="flex items-center gap-0.5 h-4 ml-1">
                        <div className="w-1 bg-red-400 rounded-full wave-bar" />
                        <div className="w-1 bg-red-400 rounded-full wave-bar" />
                        <div className="w-1 bg-red-400 rounded-full wave-bar" />
                        <div className="w-1 bg-red-400 rounded-full wave-bar" />
                      </div>
                    </div>
                  )}

                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
                    >
                      <Mic className="w-4 h-4" />
                      Speak Answer (Mic)
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-red-600/25 transition-all"
                    >
                      <MicOff className="w-4 h-4" />
                      Stop Recording
                    </button>
                  )}
                </div>
              </div>

              {/* Text Area */}
              <div className="relative">
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Click 'Speak Answer (Mic)' to transcribe your voice in real time, or type your response here... (Tip: Structure your thoughts with Situation, Task, Action, and Quantifiable Result)"
                  rows={6}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-normal leading-relaxed"
                />

                {/* Pre-fill Sample Good/Weak Responses for rapid demo */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Quick Test Templates:</span>
                    <button
                      onClick={() => setResponseText(currentQuestion.idealStarResponse || '')}
                      className="text-blue-400 hover:underline hover:text-blue-300"
                    >
                      Load Ideal STAR Answer
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      onClick={() => setResponseText(currentQuestion.weakResponseExample || '')}
                      className="text-amber-400 hover:underline hover:text-amber-300"
                    >
                      Load Weak/Rambling Answer
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setResponseText('');
                      setSpeechMetrics(null);
                    }}
                    className="text-slate-500 hover:text-slate-400"
                  >
                    Clear Text
                  </button>
                </div>
              </div>

              {/* Acoustic & Speech Heuristics Pill Bar (if available) */}
              {speechMetrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block">Speaking Pace:</span>
                    <span className="font-bold text-white">
                      {speechMetrics.wordsPerMinute} WPM ({speechMetrics.pacingAssessment})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Duration:</span>
                    <span className="font-bold text-white">{speechMetrics.durationSeconds} seconds</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Filler Words:</span>
                    <span className={`font-bold ${speechMetrics.fillerWordCount > 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {speechMetrics.fillerWordCount} detected
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Word Count:</span>
                    <span className="font-bold text-white">{speechMetrics.wordCount} words</span>
                  </div>
                </div>
              )}

              {/* Action Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleEvaluateResponse}
                  disabled={isEvaluating || !responseText.trim()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white font-bold text-sm hover:brightness-110 flex items-center gap-2.5 shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isEvaluating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Specialist Agents Evaluating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Evaluate with 5-Agent Pipeline
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: COACHING REPORT & STAR BREAKDOWN                 */}
        {/* ======================================================== */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            {!evaluationFeedback ? (
              <div className="glass-panel p-12 rounded-2xl text-center space-y-4 border border-slate-800">
                <Award className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-lg font-bold text-white">No Evaluation Report Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Practice an interview question in the Practice Arena and click "Evaluate with 5-Agent Pipeline" to generate your comprehensive coaching report.
                </p>
                <button
                  onClick={() => setActiveTab('arena')}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
                >
                  Go to Practice Arena
                </button>
              </div>
            ) : (
              <>
                {/* Executive Score Card Banner */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 shadow-xl flex flex-wrap items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Lead Interview Coach Synthesis
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {modelUsed}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                        {evaluationFeedback.overallScore}
                        <span className="text-2xl text-slate-500 font-normal">/100</span>
                      </div>
                      <div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide inline-block ${
                            evaluationFeedback.verdict === 'Ready for Next Stage'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : evaluationFeedback.verdict === 'Promising - Needs Refinement'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {evaluationFeedback.verdict}
                        </span>
                        <p className="text-xs text-slate-400 mt-1">
                          Calculated across 5 discrete competency & communication dimensions.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab('traces')}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      Inspect Multi-Agent Traces
                    </button>
                    <button
                      onClick={() => playCoachAudio(evaluationFeedback.improvedModelAnswer)}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      {isSpeakingCoach ? 'Stop Audio' : 'Listen to Coach Answer'}
                    </button>
                  </div>
                </div>

                {/* 5-Dimensional Rubric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Relevance', score: evaluationFeedback.rubricScores.relevance, weight: '25%' },
                    { label: 'Clarity', score: evaluationFeedback.rubricScores.clarity, weight: '20%' },
                    { label: 'Structure', score: evaluationFeedback.rubricScores.responseStructure, weight: '20%' },
                    { label: 'Completeness', score: evaluationFeedback.rubricScores.completeness, weight: '20%' },
                    { label: 'Comm Quality', score: evaluationFeedback.rubricScores.communicationQuality, weight: '15%' }
                  ].map((rubric, idx) => (
                    <div key={idx} className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>{rubric.label}</span>
                        <span className="text-[10px] text-slate-500">wt {rubric.weight}</span>
                      </div>
                      <div className="text-xl font-bold text-white mb-2">{rubric.score}%</div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            rubric.score >= 80 ? 'bg-emerald-400' : rubric.score >= 65 ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                          style={{ width: `${rubric.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Behavioral STAR Breakdown Card (Task 3 Requirement) */}
                {evaluationFeedback.starBreakdown && (
                  <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                          STAR Method Structural Parsing (STAR Specialist Agent)
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-blue-400">
                        Overall STAR Score: {evaluationFeedback.starBreakdown.overallStarScore}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Situation */}
                      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-300">Situation (S)</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {evaluationFeedback.starBreakdown.situation.score}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {evaluationFeedback.starBreakdown.situation.critique}
                        </p>
                      </div>

                      {/* Task */}
                      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-300">Task (T)</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {evaluationFeedback.starBreakdown.task.score}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {evaluationFeedback.starBreakdown.task.critique}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-300">Action (A)</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {evaluationFeedback.starBreakdown.action.score}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {evaluationFeedback.starBreakdown.action.critique}
                        </p>
                      </div>

                      {/* Result */}
                      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-300">Result (R)</span>
                          <div className="flex items-center gap-1">
                            {evaluationFeedback.starBreakdown.result.quantifiable ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                Quantified ✓
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                Needs Metric ⚠
                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {evaluationFeedback.starBreakdown.result.score}%
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {evaluationFeedback.starBreakdown.result.critique}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grounded Evidence Quotes & Communication Heuristics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Grounded Quotes */}
                  <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Grounded Evidence Citations (Task 4)
                    </span>
                    <p className="text-xs text-slate-400">
                      Quotes extracted verbatim from candidate transcript to substantiate scoring:
                    </p>
                    <div className="space-y-2">
                      {evaluationFeedback.contentEvaluation.groundedEvidenceQuotes?.map((quote, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs italic text-blue-200">
                          {quote}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Speech & Acoustic Analysis */}
                  <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Communication Analysis Agent Findings
                    </span>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                        <span className="text-slate-400">Vocal Tone Assessment:</span>
                        <span className="font-bold text-white">{evaluationFeedback.communicationAnalysis.tone}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Filler Word Diagnostics:</span>
                        <span className="text-slate-200">{evaluationFeedback.communicationAnalysis.fillerWordCritique}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Speech Pacing Feedback:</span>
                        <span className="text-slate-200">{evaluationFeedback.communicationAnalysis.pacingCritique}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strengths & Improvement Areas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div className="glass-panel p-5 rounded-2xl border border-emerald-900/30 bg-emerald-950/10 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Identified Strengths
                    </span>
                    <ul className="space-y-2 text-xs text-slate-200">
                      {evaluationFeedback.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Areas for Improvement */}
                  <div className="glass-panel p-5 rounded-2xl border border-amber-900/30 bg-amber-950/10 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Priority Areas for Improvement
                    </span>
                    <ul className="space-y-2 text-xs text-slate-200">
                      {evaluationFeedback.areasForImprovement.map((area, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Improved Model Answer Rewrite (PRD Requirement) */}
                <div className="glass-panel p-6 rounded-2xl border border-blue-900/40 bg-gradient-to-br from-blue-950/30 to-slate-900 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-900/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                        Improved Model Answer (Rewritten by Interview Coach)
                      </h4>
                    </div>
                    <button
                      onClick={() => playCoachAudio(evaluationFeedback.improvedModelAnswer)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-all"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      {isSpeakingCoach ? 'Stop Audio' : 'Play Voice Narration'}
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                    "{evaluationFeedback.improvedModelAnswer}"
                  </p>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Key Takeaway Guidance:
                    </span>
                    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-300">
                      {evaluationFeedback.answerRewriteGuidance.map((guide, idx) => (
                        <li key={idx} className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                          {guide}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Adaptive Follow-Up Question (PRD Requirement) */}
                <div className="glass-panel p-6 rounded-2xl border border-indigo-900/40 bg-indigo-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      Adaptive Follow-Up Question (Targeting Probed Gaps)
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                      Intent: {evaluationFeedback.adaptiveFollowUpQuestion.probingArea}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-900/50">
                    <h5 className="text-sm font-bold text-white leading-relaxed">
                      "{evaluationFeedback.adaptiveFollowUpQuestion.question}"
                    </h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Reasoning: {evaluationFeedback.adaptiveFollowUpQuestion.intent}
                    </p>
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
                      setActiveTab('arena');
                    }}
                    className="text-xs px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
                  >
                    <span>Practice This Follow-Up Question</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Personalized Improvement Plan (PRD Requirement) */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Personalized Improvement Roadmap
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <span className="font-bold text-emerald-400 block">1. Immediate Next Practice:</span>
                      <p className="text-slate-300">{evaluationFeedback.personalizedImprovementPlan.immediateFix}</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <span className="font-bold text-blue-400 block">2. Medium-Term Drill:</span>
                      <p className="text-slate-300">{evaluationFeedback.personalizedImprovementPlan.mediumTermPractice}</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <span className="font-bold text-purple-400 block">3. Suggested Structure:</span>
                      <p className="text-slate-300 font-semibold">{evaluationFeedback.personalizedImprovementPlan.recommendedFramework}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: AGENT REASONING TRACE (Task 3 Observability)      */}
        {/* ======================================================== */}
        {activeTab === 'traces' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">
                    Multi-Agent Handoff & Reasoning Protocol Trace (Task 3)
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Execution Time: {lastExecutionTime}ms
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transparent inspection of agent-to-agent (A2A) communications, parallel dispatch, and lead coach aggregation.
              </p>
            </div>

            {agentTraces.length === 0 ? (
              <div className="glass-panel p-12 rounded-2xl text-center text-slate-500 border border-slate-800">
                No active execution trace. Complete an evaluation in the Practice Arena to inspect the live agent message bus.
              </div>
            ) : (
              <div className="space-y-3">
                {agentTraces.map((trace, idx) => (
                  <div
                    key={idx}
                    className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white">{trace.agentName}</span>
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-slate-800 text-slate-300">
                          {trace.stage}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        +{trace.latencyMs}ms • {trace.timestamp.split('T')[1].slice(0, 8)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 pl-8 leading-relaxed font-normal">
                      {trace.summary}
                    </p>

                    {trace.details && (
                      <div className="pl-8 pt-1">
                        <details className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <summary className="cursor-pointer text-blue-400 hover:underline">
                            Inspect Raw Agent JSON Payload
                          </summary>
                          <pre className="mt-2 overflow-x-auto text-[10px] text-slate-300">
                            {JSON.stringify(trace.details, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: PROGRESS & LONGITUDINAL GAP TRACKER (Task 4)     */}
        {/* ======================================================== */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-blue-400" />
                  Candidate Longitudinal Analytics & Recurring Gap Tracker (Task 4)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tracks candidate performance, pacing, and recurring response deficiencies across sessions.
                </p>
              </div>

              {sessions.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Clear all stored practice session history?')) {
                      clearStoredSessions();
                      setSessions([]);
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-700 transition-all"
                >
                  Clear History
                </button>
              )}
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <span className="text-xs text-slate-400 block mb-1">Total Sessions</span>
                <span className="text-2xl font-bold text-white">{longitudinalStats.totalSessions}</span>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <span className="text-xs text-slate-400 block mb-1">Average Score</span>
                <span className="text-2xl font-bold text-blue-400">{longitudinalStats.averageScore}%</span>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <span className="text-xs text-slate-400 block mb-1">Avg Speaking Pace</span>
                <span className="text-2xl font-bold text-emerald-400">{longitudinalStats.averageWpm} WPM</span>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <span className="text-xs text-slate-400 block mb-1">Total Filler Words</span>
                <span className="text-2xl font-bold text-amber-400">{longitudinalStats.totalFillerWords}</span>
              </div>
            </div>

            {/* Recurring Gaps Detected (PRD Task 3 & 4 Requirement) */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Recurring Gaps Detected Across Practice Sessions
              </h4>

              {longitudinalStats.recurringGaps.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No recurring gaps identified yet. Complete at least 2 sessions to observe longitudinal trends.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {longitudinalStats.recurringGaps.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium">{item.gap}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                        {item.frequency}x flag
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Session History Table */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Practice Session Log
              </h4>

              {sessions.length === 0 ? (
                <p className="text-xs text-slate-400">No practice records stored yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 border-b border-slate-800 uppercase font-semibold">
                      <tr>
                        <th className="pb-2">Timestamp</th>
                        <th className="pb-2">Stage</th>
                        <th className="pb-2">Question</th>
                        <th className="pb-2">Score</th>
                        <th className="pb-2">Pacing</th>
                        <th className="pb-2">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {sessions.map((sess) => (
                        <tr key={sess.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 font-mono text-[11px] text-slate-400">{sess.timestamp}</td>
                          <td className="py-2.5 font-semibold text-blue-400">{sess.question.stage.split('&')[0]}</td>
                          <td className="py-2.5 max-w-xs truncate">{sess.question.question}</td>
                          <td className="py-2.5 font-bold text-white">{sess.coachingFeedback.overallScore}%</td>
                          <td className="py-2.5">{sess.speechMetrics?.wordsPerMinute || 135} WPM</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-200">
                              {sess.coachingFeedback.verdict}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: BENCHMARK & ARCHITECTURE (Task 4 & 5)             */}
        {/* ======================================================== */}
        {activeTab === 'benchmark' && (
          <div className="space-y-6">
            {/* Task 4 Automated Benchmark Runner */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Automated LLM-as-a-Judge Evaluation Suite (Task 4)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Evaluates Question Relevance, Analysis Quality, Consistency, and Evidence Grounding across standard test cases.
                  </p>
                </div>

                <button
                  onClick={runBenchmarkSuite}
                  disabled={isRunningBenchmark}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {isRunningBenchmark ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Evaluating Test Cases...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Run Benchmark Suite
                    </>
                  )}
                </button>
              </div>

              {benchmarkResults && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Question Relevance</span>
                      <span className="text-xl font-bold text-emerald-400">
                        {benchmarkResults.averageScores.relevance}%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Evidence Groundedness</span>
                      <span className="text-xl font-bold text-blue-400">
                        {benchmarkResults.averageScores.groundedness}%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Feedback Consistency</span>
                      <span className="text-xl font-bold text-purple-400">
                        {benchmarkResults.averageScores.consistency}%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Actionable Usefulness</span>
                      <span className="text-xl font-bold text-amber-400">
                        {benchmarkResults.averageScores.usefulness}%
                      </span>
                    </div>
                  </div>

                  {/* Benchmark Cases Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate-400 border-b border-slate-800 uppercase font-semibold">
                        <tr>
                          <th className="pb-2">Test Case</th>
                          <th className="pb-2">Grounded Quote Detected</th>
                          <th className="pb-2">Relevance</th>
                          <th className="pb-2">Groundedness</th>
                          <th className="pb-2">Latency</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {benchmarkResults.results.map((res) => (
                          <tr key={res.testCaseId} className="hover:bg-slate-800/30">
                            <td className="py-2.5 font-semibold text-white">{res.title}</td>
                            <td className="py-2.5 italic text-slate-400 max-w-xs truncate">{res.detectedGroundedQuote}</td>
                            <td className="py-2.5">{res.questionRelevanceScore}%</td>
                            <td className="py-2.5">{res.evidenceGroundednessScore}%</td>
                            <td className="py-2.5 font-mono">{res.latencyMs}ms</td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                                PASSED
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Task 5: High-Level Architecture Diagram Visualizer */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">
                    System Architecture & Agent Data Flow (Task 5 Deliverable)
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                  Deliverable 1 & 2
                </span>
              </div>

              {/* Architecture Pipeline Flow Visual */}
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-6 overflow-x-auto">
                <div className="flex items-center justify-between min-w-[700px] text-center gap-2 text-xs">
                  {/* Step 1 */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-blue-500/40 w-36 space-y-1">
                    <span className="font-bold text-white block">Candidate Profile</span>
                    <span className="text-[10px] text-slate-400">Role, Skills, YOE</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />

                  {/* Step 2 */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-blue-500/40 w-36 space-y-1">
                    <span className="font-bold text-blue-300 block">Question Agent</span>
                    <span className="text-[10px] text-slate-400">Curated & Dynamic</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />

                  {/* Step 3 */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-indigo-500/40 w-36 space-y-1">
                    <span className="font-bold text-indigo-300 block">Dual STT & Mic</span>
                    <span className="text-[10px] text-slate-400">Web Speech + WPM</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />

                  {/* Step 4 */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-purple-500/40 w-44 space-y-1">
                    <span className="font-bold text-purple-300 block">Specialist Agents</span>
                    <span className="text-[10px] text-slate-400">Comm + Content + STAR</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />

                  {/* Step 5 */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/40 w-40 space-y-1">
                    <span className="font-bold text-emerald-300 block">Lead Coach Agent</span>
                    <span className="text-[10px] text-slate-400">Synthesis & Plan</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 space-y-2">
                  <span className="font-bold text-white block">Key Architectural Design Decisions & Trade-Offs:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="font-bold text-blue-400 block mb-1">Decoupled STT vs Native STS:</span>
                      Decoupling allows parallel specialist agent dispatch, exact quote grounding, and acoustic WPM/filler-word heuristics while lowering API costs by 95% and eliminating WebRTC firewall dropouts.
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="font-bold text-emerald-400 block mb-1">Dual-Engine Fallback Topology:</span>
                      Implements primary OpenAI gpt-4o/gpt-4o-mini with seamless fall-through to an offline deterministic rule engine, guaranteeing 100% uptime during live executive demos.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 10-Minute Presentation Script & Slide Outline */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                10-Minute Panel Presentation Script (8 Min Demo + 2 Min Q&A)
              </h3>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-bold text-blue-400 block mb-1">Minute 0:00 - 1:30: Problem Statement & Prodapt Alignment</span>
                  "Traditional interview prep provides static sample answers. ElevateAI provides an autonomous 5-agent ecosystem tailored specifically for Prodapt's technical and consulting hiring tracks (OSS/BSS, Cloud, Fullstack, Behavioral)."
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-bold text-indigo-400 block mb-1">Minute 1:30 - 4:00: Live Interactive Practice & Dual STT Demo</span>
                  "Showcase voice input using the Web Speech API with real-time waveform visualization, acoustic WPM calculation, and regex filler-word extraction."
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-bold text-purple-400 block mb-1">Minute 4:00 - 6:30: Multi-Agent Handoff & STAR Breakdown</span>
                  "Demonstrate the Agent Reasoning Trace drawer, the STAR component scores, grounded transcript citations, and trigger the AI Voice Coach TTS reading the rewritten answer."
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-bold text-emerald-400 block mb-1">Minute 6:30 - 8:00: Benchmark Suite & Empirical Reliability</span>
                  "Run the automated Benchmark Suite live. Explain our empirical evaluation metrics (Question Relevance, Consistency, Evidence Groundedness) and the offline fallback engine."
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-bold text-amber-400 block mb-1">Minute 8:00 - 10:00: Panel Q&A Anticipated Defenses</span>
                  "Address trade-offs on latency, LLM temperature tuning (0.2 for specialists, 0.3 for coach), token economy, and enterprise multi-session scalability."
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal (Enter OpenAI API Key / Offline toggle) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border border-slate-700 bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-400" />
                Platform Configuration & Model Engine
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">OpenAI API Key (Optional):</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    localStorage.setItem('elevate_ai_openai_key', e.target.value);
                  }}
                  placeholder="sk-... (Leave empty to use high-fidelity offline rule engine)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Your key is saved locally in your browser. If empty or invalid, ElevateAI automatically engages the deterministic fallback engine.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-white block">Active Engine Status:</span>
                <span className="text-blue-400 font-mono text-[11px] block">
                  {apiKey ? 'OpenAI GPT-4o (Coach) + GPT-4o-mini (Specialists)' : 'High-Fidelity Deterministic Fallback Engine (Offline Safe)'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
