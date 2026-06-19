import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, senderId } = body;

    if (!userId || !senderId) {
      return NextResponse.json(
        { error: 'User ID and Sender ID (or "all") are required.' },
        { status: 400 }
      );
    }

    db.markMessagesAsRead(userId, senderId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to mark messages as read.' },
      { status: 500 }
    );
  }
}
