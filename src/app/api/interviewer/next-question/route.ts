import { NextRequest, NextResponse } from 'next/server';
import { InterviewSessionState, type InterviewEvaluation } from '@/agents/resumeInterviewerAgent';
import { runInterviewGraph } from '@/lib/interview/graph';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionState, lastAnswer, lastEvaluation } = body as {
      sessionState: InterviewSessionState;
      lastAnswer?: string;
      lastEvaluation?: InterviewEvaluation;
    };

    if (!sessionState || !sessionState.resumeKnowledge) {
      return NextResponse.json(
        { error: 'Session state and resume knowledge are required.' },
        { status: 400 }
      );
    }

    const graphResult = await runInterviewGraph({
      sessionState,
      lastAnswer,
      lastEvaluation,
      nextQuestion: undefined,
      complete: false,
    });

    return NextResponse.json({
      nextQuestion: graphResult.nextQuestion,
      sessionState: graphResult.sessionState,
    });
  } catch (err: unknown) {
    console.error('API /api/interviewer/next-question error:', err);
    return NextResponse.json(
      { error: 'Interviewer agent error', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
