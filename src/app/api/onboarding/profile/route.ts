import { NextRequest, NextResponse } from 'next/server';
import { normalizeResumeProfile } from '@/lib/resumeParser';
import type { CandidateProfile } from '@/lib/api';

// In-memory server profile store for the current session
let currentServerProfile: CandidateProfile | null = null;

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    profile: currentServerProfile,
    source: currentServerProfile ? 'saved' : 'empty',
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    currentServerProfile = normalizeResumeProfile(body);
    return NextResponse.json({
      status: 'ok',
      profile: currentServerProfile,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update profile' }, { status: 400 });
  }
}
