import { NextRequest, NextResponse } from 'next/server';
import { runMultiAgentInterviewCoaching } from '@/agents/orchestrator';
import { MultiAgentPipeline, type PipelineStageCallback } from '@/agents/multiAgentPipeline';
import { enhanceSpecialistWithLLM } from '@/server/evaluation/specialistEvaluators';
import { evaluateSemanticallyWithLLM } from '@/server/evaluation/semanticEvaluator';
import { CandidateProfile, InterviewQuestion, SpeechMetrics } from '@/types/interview';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      candidateProfile,
      question,
      candidateResponse,
      speechMetrics,
      apiKey
    } = body as {
      candidateProfile: CandidateProfile;
      question: InterviewQuestion;
      candidateResponse: string;
      speechMetrics?: SpeechMetrics;
      apiKey?: string;
    };

    // Active hybrid pipeline: objective signals remain deterministic while
    // each specialist independently attempts a server-only semantic LLM pass.
    if (body?.answer && body?.question?.question) {
      const pipelineInput = {
        question: body.question,
        answer: body.answer,
        mode: body.mode || 'text',
        candidateProfile: body.candidateProfile || null,
        wpm: body.wpm ?? null,
        specialistEvaluator: enhanceSpecialistWithLLM,
        // The final five-dimension score is semantically reviewed separately
        // from the specialists' deterministic objective measurements.
        semanticEvaluator: evaluateSemanticallyWithLLM,
      };

      if (body.stream === true) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const send = (event: string, payload: unknown) => {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
            };
            const onStage: PipelineStageCallback = (id, status, out) => send('stage', { id, status, out });

            void MultiAgentPipeline.execute(pipelineInput, onStage)
              .then((result) => {
                send('result', result);
                controller.close();
              })
              .catch((error) => {
                send('error', { message: error instanceof Error ? error.message : 'Evaluation failed.' });
                controller.close();
              });
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        });
      }

      const result = await MultiAgentPipeline.execute(pipelineInput);
      return NextResponse.json(result);
    }

    if (!question || !candidateResponse) {
      return NextResponse.json(
        { error: 'Question and candidate response are required.' },
        { status: 400 }
      );
    }

    const defaultProfile: CandidateProfile = candidateProfile || {
      id: 'default-cand',
      fullName: 'Prodapt Engineering Candidate',
      targetRole: question.role || 'Fullstack Software Engineer',
      experienceYears: 3,
      keySkills: ['Distributed Systems', 'Microservices', 'TypeScript'],
      bio: 'Aspiring engineer preparing for technical rounds.'
    };

    const result = await runMultiAgentInterviewCoaching(
      defaultProfile,
      question,
      candidateResponse,
      speechMetrics,
      apiKey
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Evaluation Route Error:', error);
    return NextResponse.json(
      { error: 'Failed to process multi-agent evaluation', details: String(error) },
      { status: 500 }
    );
  }
}
