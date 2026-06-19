'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Search, 
  Megaphone, 
  User as UserIcon, 
  CheckCheck, 
  Loader2, 
  AlertCircle, 
  MessageSquare, 
  Filter, 
  Sparkles,
  Volume2
} from 'lucide-react';
import { User, Message } from '@/lib/types';

// Web Audio API Synthesized sound effects to avoid local file download and CORS issues
const playAudioFeedback = (type: 'send' | 'receive') => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'send') {
      // Modern bubble pop sound effect
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      // Warm C5-E5 chime notification
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch (err) {
    console.warn('Audio feedback blocked by browser autoplay rules:', err);
  }
};

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Navigation & selection
  const [activeRecipientId, setActiveRecipientId] = useState<string>('all'); // 'all' for broadcasts
  
  // Input fields
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadFilter, setUnreadFilter] = useState(false);
  const [isAlertBannerInput, setIsAlertBannerInput] = useState(false);

  // Loading & sync state
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [syncing, setSyncing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef(true);
  const activeRecipientIdRef = useRef(activeRecipientId);

  // Keep activeRecipientIdRef in sync
  useEffect(() => {
    activeRecipientIdRef.current = activeRecipientId;
  }, [activeRecipientId]);

  // Load current user, then list users and messages
  useEffect(() => {
    const storedUser = localStorage.getItem('99store_user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchInitialData = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchMessages()]);
      setLoading(false);
    };

    fetchInitialData();
  }, [currentUser]);

  // Sync messages and mark as read periodically
  useEffect(() => {
    if (!currentUser) return;

    const syncInterval = setInterval(async () => {
      setSyncing(true);
      await fetchMessages();
      setLastSynced(new Date());
      setSyncing(false);
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [currentUser, activeRecipientId]);

  // Mark messages in active thread as read
  useEffect(() => {
    if (!currentUser || messages.length === 0) return;
    markActiveThreadAsRead();
  }, [currentUser, activeRecipientId, messages.length]);

  // Scroll to bottom of messages container
  useEffect(() => {
    scrollToBottom();
  }, [messages, activeRecipientId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Exclude current user from contact list
          setUsers(data.users.filter((u: User) => u.id !== currentUser?.id));
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchMessages = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/messages?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.messages) {
          const msgs: Message[] = data.messages;
          setMessages(msgs);

          // Real-time notifications and chime trigger
          if (isFirstFetchRef.current) {
            msgs.forEach((m) => knownIdsRef.current.add(m.id));
            isFirstFetchRef.current = false;
          } else {
            let hasNewIncoming = false;
            msgs.forEach((m) => {
              if (!knownIdsRef.current.has(m.id)) {
                knownIdsRef.current.add(m.id);

                // Only handle notifications if the message is from someone else
                if (m.senderId !== currentUser.id) {
                  hasNewIncoming = true;

                  // Show HTML5 desktop notification
                  const currentActiveId = activeRecipientIdRef.current;
                  const isForActiveThread = 
                    (currentActiveId === 'all' && m.isBroadcast) || 
                    (currentActiveId !== 'all' && !m.isBroadcast && m.senderId === currentActiveId);

                  const shouldNotifyDesktop = document.hidden || !isForActiveThread;

                  if (shouldNotifyDesktop && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    const title = m.isBroadcast 
                      ? `Broadcast from ${m.senderName}` 
                      : `New message from ${m.senderName}`;
                    try {
                      const notification = new Notification(title, {
                        body: m.content,
                      });
                      notification.onclick = () => {
                        window.focus();
                      };
                    } catch (err) {
                      console.error('Failed to trigger HTML5 desktop notification:', err);
                    }
                  }
                }
              }
            });

            if (hasNewIncoming) {
              playAudioFeedback('receive');
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const markActiveThreadAsRead = async () => {
    if (!currentUser) return;
    const unreadInThread = messages.filter(
      (m) =>
        !m.isReadBy.includes(currentUser.id) &&
        ((activeRecipientId === 'all' && m.isBroadcast && m.senderId !== currentUser.id) ||
          (activeRecipientId !== 'all' && !m.isBroadcast && m.senderId === activeRecipientId && m.recipientId === currentUser.id))
    );

    if (unreadInThread.length === 0) return;

    try {
      const res = await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          senderId: activeRecipientId,
        }),
      });

      if (res.ok) {
        // Optimistically update local state to avoid flickers
        setMessages((prev) =>
          prev.map((msg) => {
            if (
              (activeRecipientId === 'all' && msg.isBroadcast && !msg.isReadBy.includes(currentUser.id)) ||
              (activeRecipientId !== 'all' &&
                !msg.isBroadcast &&
                msg.senderId === activeRecipientId &&
                msg.recipientId === currentUser.id &&
                !msg.isReadBy.includes(currentUser.id))
            ) {
              return { ...msg, isReadBy: [...msg.isReadBy, currentUser.id] };
            }
            return msg;
          })
        );
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, templateText?: string) => {
    if (e) e.preventDefault();
    const contentToSend = templateText || inputText;

    if (!currentUser || !contentToSend.trim() || sending) return;

    setSending(true);
    try {
      const isBroadcast = activeRecipientId === 'all';
      const payload = {
        senderId: currentUser.id,
        recipientId: isBroadcast ? 'all' : activeRecipientId,
        content: contentToSend.trim(),
        isBroadcast,
        isAlertBanner: isBroadcast ? isAlertBannerInput : false,
      };

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          knownIdsRef.current.add(data.message.id);
          setMessages((prev) => [...prev, data.message]);
          setInputText('');
          setIsAlertBannerInput(false);
          playAudioFeedback('send');
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to send message.');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  // Quick reply templates
  const quickTemplates = [
    { text: 'Is Order 99S- ready for dispatch?', type: 'direct' },
    { text: 'Verify customer secondary contact details.', type: 'direct' },
    { text: 'NDR Alert: Please check internal remarks.', type: 'direct' },
    { text: 'Packing queue has been cleared.', type: 'direct' },
    { text: 'Warehouse Dispatch queue is delayed by 1 hour.', type: 'broadcast', adminOnly: true },
    { text: 'System Check: Courier API endpoints functional.', type: 'broadcast', adminOnly: true },
    { text: 'Emergency: Courier manifests failing, routing via DTDC.', type: 'broadcast', adminOnly: true },
  ];

  // Helper to format timestamps nicely
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${timeStr}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${timeStr}`;
    } else {
      return `${date.toLocaleDateString()} ${timeStr}`;
    }
  };

  // Get active thread title and info
  const getThreadInfo = () => {
    if (activeRecipientId === 'all') {
      return {
        name: 'Announcements & Broadcasts',
        sub: 'Global updates for the entire team',
        isBroadcast: true,
      };
    }
    const targetUser = users.find((u) => u.id === activeRecipientId);
    return {
      name: targetUser ? targetUser.name : 'Unknown User',
      sub: targetUser ? `${targetUser.role} • Online` : 'Offline',
      isBroadcast: false,
    };
  };

  const activeInfo = getThreadInfo();

  // Filter messages for active chat thread
  const activeChatMessages = messages.filter((msg) => {
    if (activeRecipientId === 'all') {
      return msg.isBroadcast;
    } else {
      return (
        !msg.isBroadcast &&
        ((msg.senderId === currentUser?.id && msg.recipientId === activeRecipientId) ||
          (msg.senderId === activeRecipientId && msg.recipientId === currentUser?.id))
      );
    }
  });

  // Filter messages in active thread by search query and unread status
  const filteredActiveMessages = activeChatMessages.filter((msg) => {
    const matchesSearch = msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          msg.senderName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (unreadFilter && currentUser) {
      const isUnread = !msg.isReadBy.includes(currentUser.id) && msg.senderId !== currentUser.id;
      return matchesSearch && isUnread;
    }
    
    return matchesSearch;
  });

  // Calculate unread message counts per contact channel
  const getUnreadCount = (recipientId: string) => {
    if (!currentUser) return 0;
    return messages.filter((msg) => {
      if (msg.isReadBy.includes(currentUser.id)) return false;
      if (msg.senderId === currentUser.id) return false;

      if (recipientId === 'all') {
        return msg.isBroadcast;
      } else {
        return !msg.isBroadcast && msg.senderId === recipientId && msg.recipientId === currentUser.id;
      }
    }).length;
  };

  // Role pill styling colors
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Super Admin': return { border: '#FAFAFA', bg: 'rgba(250, 250, 250, 0.05)', text: '#FAFAFA' };
      case 'Order Team': return { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.05)', text: '#3B82F6' };
      case 'Packing Team': return { border: '#EC4899', bg: 'rgba(236, 72, 153, 0.05)', text: '#EC4899' };
      case 'Tracking Team': return { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.05)', text: '#F59E0B' };
      default: return { border: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.05)', text: '#8B5CF6' };
    }
  };

  if (!currentUser) {
    return (
      <div style={{ color: '#8A8A8A', padding: '20px', textAlign: 'center' }}>
        Resolving user details...
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header bar with connection and statistics summary */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#FAFAFA', letterSpacing: '-0.03em' }}>
            INTERNAL COMMUNICATIONS
          </h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '14px', marginTop: '4px' }}>
            Instant coordination gateway for the 99Store OMS Operations Hub
          </p>
        </div>

        {/* Sync Status Badge & Statistics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#121212',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--muted-foreground)'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: syncing ? '#F59E0B' : '#10B981',
              display: 'inline-block'
            }} />
            <span>{syncing ? 'Syncing...' : `Synced ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}</span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{
              backgroundColor: '#121212',
              border: '1px solid var(--border)',
              padding: '6px 12px',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Directs</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#FAFAFA' }}>
                {messages.filter(m => !m.isBroadcast).length}
              </p>
            </div>
            <div style={{
              backgroundColor: '#121212',
              border: '1px solid var(--border)',
              padding: '6px 12px',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Broadcasts</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#FAFAFA' }}>
                {messages.filter(m => m.isBroadcast).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--muted-foreground)'
        }}>
          <Loader2 className="animate-spin" size={32} />
          <span>Restructuring chat threads...</span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr 280px',
          gap: '24px',
          minHeight: '600px',
          alignItems: 'stretch'
        }} className="premium-grid-layout">
          
          {/* COLUMN 1: Channels and Direct Message Contacts Sidebar */}
          <div className="premium-card" style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            height: '650px'
          }}>
            <div>
              <h3 style={{ fontSize: '14px', color: '#FAFAFA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Operational Channels
              </h3>
            </div>

            {/* Broadcast Channel Button */}
            <button
              onClick={() => setActiveRecipientId('all')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid ' + (activeRecipientId === 'all' ? '#FAFAFA' : 'var(--border)'),
                backgroundColor: activeRecipientId === 'all' ? 'rgba(255, 255, 255, 0.05)' : '#121212',
                color: '#FAFAFA',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid #F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F59E0B'
              }}>
                <Megaphone size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600 }}>📢 Announcements</p>
                <p style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>Broadcast feed for all teams</p>
              </div>
              {getUnreadCount('all') > 0 && (
                <div style={{
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '10px'
                }}>
                  {getUnreadCount('all')}
                </div>
              )}
            </button>

            <div style={{ borderBottom: '1px solid var(--border)', margin: '4px 0' }} />

            <div>
              <h3 style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Direct Messaging ({users.length})
              </h3>
            </div>

            {/* Direct Message User List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingRight: '4px'
            }}>
              {users.map((u) => {
                const isSelected = activeRecipientId === u.id;
                const unread = getUnreadCount(u.id);
                const roleStyle = getRoleColor(u.role);
                const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2);

                return (
                  <button
                    key={u.id}
                    onClick={() => setActiveRecipientId(u.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid ' + (isSelected ? 'var(--border-focus)' : 'transparent'),
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                      color: '#FAFAFA',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    className="contact-item"
                  >
                    {/* User Avatar with role-based border */}
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: roleStyle.bg,
                      border: `1.5px solid ${roleStyle.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: roleStyle.text,
                      position: 'relative'
                    }}>
                      {initials}
                      {/* Connection status indicator */}
                      <span style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#10B981',
                        border: '1.5px solid #121212'
                      }} />
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {u.name}
                      </p>
                      <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        {u.role}
                      </p>
                    </div>

                    {unread > 0 && (
                      <div style={{
                        backgroundColor: '#EF4444',
                        color: '#FFFFFF',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '1px 5px',
                        borderRadius: '10px'
                      }}>
                        {unread}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* COLUMN 2: Message Logs and Compose Input Box */}
          <div className="premium-card" style={{
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '650px',
            overflow: 'hidden'
          }}>
            {/* Active chat header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: '#121212',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FAFAFA' }}>
                  {activeInfo.name}
                </h2>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                  {activeInfo.sub}
                </p>
              </div>

              {/* Chat thread filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{
                    position: 'absolute',
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted-foreground)'
                  }} />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      backgroundColor: 'var(--input)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: '#FAFAFA',
                      padding: '4px 8px 4px 28px',
                      fontSize: '12px',
                      outline: 'none',
                      width: '160px'
                    }}
                  />
                </div>

                <button
                  onClick={() => setUnreadFilter(!unreadFilter)}
                  style={{
                    backgroundColor: unreadFilter ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: unreadFilter ? '#FAFAFA' : 'var(--muted-foreground)',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px'
                  }}
                  title="Filter by unread messages"
                >
                  <Filter size={12} />
                  <span>Unread</span>
                </button>
              </div>
            </div>

            {/* Scrollable messages history area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {filteredActiveMessages.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted-foreground)',
                  gap: '8px'
                }}>
                  <MessageSquare size={32} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '13px' }}>
                    {searchQuery || unreadFilter 
                      ? 'No messages match your filters.' 
                      : 'No messages in this conversation yet. Send a greeting!'}
                  </span>
                </div>
              ) : (
                filteredActiveMessages.map((msg) => {
                  const isSelf = msg.senderId === currentUser.id;
                  const initials = msg.senderName.split(' ').map(n => n[0]).join('').slice(0, 2);

                  // Decide bubble aesthetics
                  if (msg.isBroadcast) {
                    const isAlert = msg.isAlertBanner;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          backgroundColor: isAlert ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.03)',
                          border: '1.5px dashed ' + (isAlert ? '#EF4444' : '#F59E0B'),
                          borderRadius: '8px',
                          padding: '16px',
                          alignSelf: 'stretch',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                          <span style={{
                            backgroundColor: isAlert ? '#EF4444' : '#F59E0B',
                            color: '#FFFFFF',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {isAlert ? <AlertCircle size={10} /> : <Volume2 size={10} />}
                            {isAlert ? 'Urgent Alert Banner' : 'Broadcast Announcement'}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p style={{ fontSize: '13.5px', color: '#E4E4E7', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </p>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#FAFAFA' }}>
                            Posted by: {msg.senderName} ({msg.senderUsername})
                          </span>
                          <span style={{ fontSize: '9px', color: 'var(--muted-foreground)' }}>
                            Seen by {msg.isReadBy.length} {msg.isReadBy.length === 1 ? 'user' : 'users'}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        alignSelf: isSelf ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                        gap: '10px',
                        flexDirection: isSelf ? 'row-reverse' : 'row'
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: isSelf ? '#FAFAFA' : '#1E1E24',
                        color: isSelf ? '#0A0A0A' : '#FAFAFA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        {initials}
                      </div>

                      {/* Msg container */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          justifyContent: isSelf ? 'flex-end' : 'flex-start'
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)' }}>
                            {isSelf ? 'You' : msg.senderName}
                          </span>
                          <span style={{ fontSize: '9px', color: 'var(--muted-foreground)' }}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>

                        {/* Speech Bubble */}
                        <div style={{
                          backgroundColor: isSelf ? '#FAFAFA' : '#1A1A1E',
                          color: isSelf ? '#0A0A0A' : '#FAFAFA',
                          border: isSelf ? '1px solid #FFFFFF' : '1px solid var(--border)',
                          padding: '10px 14px',
                          borderRadius: isSelf ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          boxShadow: isSelf ? '0 4px 15px rgba(255,255,255,0.05)' : 'none'
                        }}>
                          {msg.content}
                        </div>

                        {/* Read confirmation */}
                        {isSelf && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '3px', color: msg.isReadBy.length > 1 ? '#3B82F6' : 'var(--muted-foreground)' }}>
                            <CheckCheck size={12} />
                            <span style={{ fontSize: '8px' }}>
                              {msg.isReadBy.length > 1 ? 'Read' : 'Delivered'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message composer keyboard block */}
            <form onSubmit={handleSendMessage} style={{
              padding: '16px',
              borderTop: '1px solid var(--border)',
              backgroundColor: '#121212',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <textarea
                  placeholder={
                    activeRecipientId === 'all'
                      ? 'Compose a broadcast announcement to all users...'
                      : `Type your message here...`
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value.slice(0, 1000))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: '#FAFAFA',
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                    height: '42px',
                    minHeight: '42px',
                    maxHeight: '120px'
                  }}
                />

                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="premium-btn premium-btn-primary"
                  style={{
                    height: '42px',
                    padding: '0 16px',
                    opacity: !inputText.trim() ? 0.5 : 1
                  }}
                >
                  {sending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                </button>
              </div>

              {/* Special options and character limit */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--muted-foreground)'
              }}>
                <div>
                  {/* Broadcast specific banner control overlay */}
                  {activeRecipientId === 'all' && currentUser.role === 'Super Admin' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#F59E0B' }}>
                      <input
                        type="checkbox"
                        checked={isAlertBannerInput}
                        onChange={(e) => setIsAlertBannerInput(e.target.checked)}
                        style={{ accentColor: '#F59E0B' }}
                      />
                      <Sparkles size={11} />
                      <span>Pin as Urgent Top Dashboard Banner Notice</span>
                    </label>
                  )}
                  {activeRecipientId === 'all' && currentUser.role !== 'Super Admin' && (
                    <span style={{ color: '#EF4444' }}>⚠️ Only Super Admins can write announcements.</span>
                  )}
                </div>
                <span>{inputText.length} / 1000 characters</span>
              </div>
            </form>
          </div>

          {/* COLUMN 3: Quick Templates Desk and Details Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Quick Actions / Role Specific info card */}
            <div className="premium-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px' }}>
                Operational Context
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                <div>
                  <p style={{ color: 'var(--muted-foreground)' }}>Active User ID:</p>
                  <p style={{ fontWeight: 600, color: '#FAFAFA' }}>{currentUser.id}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--muted-foreground)' }}>Your Role Authorization:</p>
                  <p style={{ fontWeight: 600, color: '#FAFAFA' }}>{currentUser.role}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--muted-foreground)' }}>Session Status:</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontWeight: 600 }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                    <span>Active Terminal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick reply templates */}
            <div className="premium-card" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px' }}>
                OMS Quick Templates
              </h3>
              
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '2px'
              }}>
                {quickTemplates
                  .filter(t => !t.adminOnly || currentUser.role === 'Super Admin')
                  .filter(t => t.type === 'broadcast' === (activeRecipientId === 'all'))
                  .map((template, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(undefined, template.text)}
                      disabled={sending || (activeRecipientId === 'all' && currentUser.role !== 'Super Admin')}
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        textAlign: 'left',
                        color: 'var(--muted-foreground)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        lineHeight: '1.4'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-focus)';
                        e.currentTarget.style.color = '#FAFAFA';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--muted-foreground)';
                      }}
                    >
                      {template.text}
                    </button>
                  ))
                }
              </div>
              
              <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '12px', fontStyle: 'italic', textAlign: 'center' }}>
                * Clicking a template sends it instantly to the active channel
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
