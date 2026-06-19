import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Message } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const messages = db.getMessages();

    // Filter messages: Broadcasts, OR messages sent by/to this user
    const filteredMessages = messages.filter(
      (msg) =>
        msg.isBroadcast ||
        msg.senderId === userId ||
        msg.recipientId === userId
    );

    // Sort by timestamp ascending (so they display chronologically in chat threads)
    filteredMessages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return NextResponse.json({ success: true, messages: filteredMessages });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch messages.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { senderId, recipientId, content, isBroadcast, isAlertBanner } = body;

    if (!senderId || !content) {
      return NextResponse.json(
        { error: 'Sender ID and message content are required.' },
        { status: 400 }
      );
    }

    // Resolve sender
    const sender = db.getUserById(senderId);
    if (!sender) {
      return NextResponse.json({ error: 'Sender user not found.' }, { status: 400 });
    }

    let resolvedRecipientId = recipientId;
    let resolvedRecipientName = '';
    let resolvedRecipientUsername = '';
    const resolvedIsBroadcast = !!isBroadcast;
    let resolvedIsAlertBanner = !!isAlertBanner;

    if (resolvedIsBroadcast) {
      // Validate that sender is Super Admin
      if (sender.role !== 'Super Admin') {
        return NextResponse.json(
          { error: 'Only Super Admins are authorized to broadcast announcements.' },
          { status: 403 }
        );
      }
      resolvedRecipientId = 'all';
      resolvedRecipientName = 'All Users';
      resolvedRecipientUsername = 'all';

      // If this is a new alert banner, clear the banner status on all older messages
      if (resolvedIsAlertBanner) {
        const allMessages = db.getMessages();
        let changed = false;
        allMessages.forEach((msg) => {
          if (msg.isAlertBanner) {
            msg.isAlertBanner = false;
            changed = true;
            db.saveMessage(msg);
          }
        });
      }
    } else {
      if (!recipientId || recipientId === 'all') {
        return NextResponse.json(
          { error: 'Recipient ID is required for direct messages.' },
          { status: 400 }
        );
      }
      const recipient = db.getUserById(recipientId);
      if (!recipient) {
        return NextResponse.json({ error: 'Recipient user not found.' }, { status: 400 });
      }
      resolvedRecipientName = recipient.name;
      resolvedRecipientUsername = recipient.username;
      resolvedIsAlertBanner = false; // direct messages cannot be global alert banners
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId,
      senderName: sender.name,
      senderUsername: sender.username,
      recipientId: resolvedRecipientId,
      recipientName: resolvedRecipientName,
      recipientUsername: resolvedRecipientUsername,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      isReadBy: [senderId], // sender has read their own message
      isBroadcast: resolvedIsBroadcast,
      isAlertBanner: resolvedIsAlertBanner,
    };

    db.saveMessage(newMessage);

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send message.' },
      { status: 500 }
    );
  }
}
