'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  BarChart3,
  Package,
  Tag,
  Truck,
  AlertOctagon,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  User as UserIcon,
  MessageSquare,
  Send,
  ArrowLeft,
  Megaphone,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { User, UserRole, Message } from '@/lib/types';

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeBanner, setActiveBanner] = useState<{ id: string; content: string; senderName: string } | null>(null);

  // Collapsible Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('99store_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Mini chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [miniActiveRecipientId, setMiniActiveRecipientId] = useState<string | null>(null);
  const [chatInputText, setChatInputText] = useState('');
  const [layoutMessages, setLayoutMessages] = useState<Message[]>([]);
  const [layoutUsers, setLayoutUsers] = useState<User[]>([]);
  const [toasts, setToasts] = useState<{ id: string; senderId: string; senderName: string; role: string; content: string }[]>([]);

  // Module 8: Real-Time SSE Notification Architecture states
  const [streamEvents, setStreamEvents] = useState<{ id: string; title: string; message: string; timestamp: string; type: string }[]>([]);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [streamUnreadCount, setStreamUnreadCount] = useState(0);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef(true);
  const miniChatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    const storedUser = localStorage.getItem('99store_user');
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }

    const savedCollapse = localStorage.getItem('99store_sidebar_collapsed');
    if (savedCollapse === 'true') {
      setIsSidebarCollapsed(true);
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, [router]);

  // Module 8: SSE Real-Time Stream Event Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStreamEvents((prev) => [data, ...prev].slice(0, 50));
        setStreamUnreadCount((prev) => prev + 1);
        playAudioFeedback('receive');
      } catch (err) {
        console.error('Failed to parse SSE notification message:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Load user list
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setLayoutUsers(data.users.filter((u: User) => u.id !== user.id));
          }
        }
      } catch (err) {
        console.error('Error layout fetching users:', err);
      }
    };
    fetchUsers();
  }, [user]);

  // Background Messages Poller
  useEffect(() => {
    if (!user) return;

    const fetchMessagesAndBanner = async () => {
      try {
        const res = await fetch(`/api/messages?userId=${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.messages) {
          const msgs: Message[] = data.messages;
          setLayoutMessages(msgs);

          // Calculate unread count
          let count = 0;
          msgs.forEach((m) => {
            if (!m.isReadBy.includes(user.id)) {
              if (m.isBroadcast && m.senderId !== user.id) {
                count++;
              } else if (!m.isBroadcast && m.recipientId === user.id) {
                count++;
              }
            }
          });
          setUnreadCount(count);

          // Real-time notifications toast trigger
          if (isFirstFetchRef.current) {
            msgs.forEach((m) => knownIdsRef.current.add(m.id));
            isFirstFetchRef.current = false;
          } else {
            let hasNewIncoming = false;
            msgs.forEach((m) => {
              if (!knownIdsRef.current.has(m.id)) {
                knownIdsRef.current.add(m.id);

                // Only alert if the message is from someone else AND user is not on messages page
                if (m.senderId !== user.id && pathname !== '/dashboard/messages') {
                  const senderUser = layoutUsers.find(lu => lu.id === m.senderId);
                  const senderRole = senderUser ? senderUser.role : (m.isBroadcast ? 'Broadcast' : 'OMS User');

                  const newToast = {
                    id: m.id,
                    senderId: m.isBroadcast ? 'all' : m.senderId,
                    senderName: m.senderName,
                    role: senderRole,
                    content: m.content
                  };

                  setToasts((prev) => [...prev, newToast]);
                  hasNewIncoming = true;

                  // Trigger HTML5 desktop notification if window is hidden
                  if (document.hidden && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    const title = m.isBroadcast
                      ? `Broadcast from ${m.senderName}`
                      : `New message from ${m.senderName}`;
                    try {
                      const notification = new Notification(title, {
                        body: m.content,
                      });
                      notification.onclick = () => {
                        window.focus();
                        setMiniActiveRecipientId(m.isBroadcast ? 'all' : m.senderId);
                        setIsChatOpen(true);
                      };
                    } catch (err) {
                      console.error('Failed to trigger HTML5 desktop notification:', err);
                    }
                  }

                  // Auto remove toast after 4.5 seconds
                  setTimeout(() => {
                    setToasts((prev) => prev.filter((t) => t.id !== m.id));
                  }, 4500);
                }
              }
            });

            if (hasNewIncoming) {
              playAudioFeedback('receive');
            }
          }

          // Find active alert banner
          const activeAlert = msgs.find(m => m.isBroadcast && m.isAlertBanner);
          if (activeAlert) {
            setActiveBanner({
              id: activeAlert.id,
              content: activeAlert.content,
              senderName: activeAlert.senderName
            });
          } else {
            setActiveBanner(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch messages for sidebar unread count:', err);
      }
    };

    fetchMessagesAndBanner();
    const interval = setInterval(fetchMessagesAndBanner, 5000);
    return () => clearInterval(interval);
  }, [user, layoutUsers]);

  // Mark thread as read inside mini-chat tray
  useEffect(() => {
    if (!user || !isChatOpen || !miniActiveRecipientId || layoutMessages.length === 0) return;

    const markAsRead = async () => {
      const unreadInThread = layoutMessages.filter(
        (m) =>
          !m.isReadBy.includes(user.id) &&
          ((miniActiveRecipientId === 'all' && m.isBroadcast && m.senderId !== user.id) ||
            (miniActiveRecipientId !== 'all' && !m.isBroadcast && m.senderId === miniActiveRecipientId && m.recipientId === user.id))
      );

      if (unreadInThread.length === 0) return;

      try {
        await fetch('/api/messages/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            senderId: miniActiveRecipientId,
          }),
        });

        // Update local list optimistically
        setLayoutMessages((prev) =>
          prev.map((msg) => {
            if (
              (miniActiveRecipientId === 'all' && msg.isBroadcast && !msg.isReadBy.includes(user.id)) ||
              (miniActiveRecipientId !== 'all' &&
                !msg.isBroadcast &&
                msg.senderId === miniActiveRecipientId &&
                msg.recipientId === user.id &&
                !msg.isReadBy.includes(user.id))
            ) {
              return { ...msg, isReadBy: [...msg.isReadBy, user.id] };
            }
            return msg;
          })
        );
      } catch (err) {
        console.error('Error marking read inside mini-chat:', err);
      }
    };

    markAsRead();
  }, [user, isChatOpen, miniActiveRecipientId, layoutMessages.length]);

  // Scroll mini chat thread to bottom
  useEffect(() => {
    if (isChatOpen && miniActiveRecipientId) {
      miniChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [layoutMessages, miniActiveRecipientId, isChatOpen]);

  const handleMiniSendMessage = async (e?: React.FormEvent, templateText?: string) => {
    if (e) e.preventDefault();
    const contentToSend = templateText || chatInputText;
    if (!user || !miniActiveRecipientId || !contentToSend.trim()) return;

    try {
      const isBroadcast = miniActiveRecipientId === 'all';
      const payload = {
        senderId: user.id,
        recipientId: isBroadcast ? 'all' : miniActiveRecipientId,
        content: contentToSend.trim(),
        isBroadcast,
        isAlertBanner: false
      };

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLayoutMessages((prev) => [...prev, data.message]);
          knownIdsRef.current.add(data.message.id);
          setChatInputText('');
          playAudioFeedback('send');
        }
      }
    } catch (err) {
      console.error('Error sending mini-chat message:', err);
    }
  };

  // Find name and info for active chat inside mini tray
  const miniActiveInfo = (() => {
    if (!miniActiveRecipientId) return { name: '', role: '' };
    if (miniActiveRecipientId === 'all') return { name: 'Announcements & Broadcasts', role: 'Global Feed' };
    const foundUser = layoutUsers.find(u => u.id === miniActiveRecipientId);
    return foundUser ? { name: foundUser.name, role: foundUser.role } : { name: 'OMS User', role: 'Team Member' };
  })();

  // Filter messages for active mini chat
  const miniChatMessages = layoutMessages.filter((msg) => {
    if (!miniActiveRecipientId) return false;
    if (miniActiveRecipientId === 'all') {
      return msg.isBroadcast;
    } else {
      return (
        !msg.isBroadcast &&
        ((msg.senderId === user?.id && msg.recipientId === miniActiveRecipientId) ||
          (msg.senderId === miniActiveRecipientId && msg.recipientId === user?.id))
      );
    }
  });

  // Calculate unread counts inside the mini chat lists
  const getMiniUnreadCount = (recipientId: string) => {
    if (!user) return 0;
    return layoutMessages.filter((msg) => {
      if (msg.isReadBy.includes(user.id)) return false;
      if (msg.senderId === user.id) return false;
      if (recipientId === 'all') {
        return msg.isBroadcast;
      } else {
        return !msg.isBroadcast && msg.senderId === recipientId && msg.recipientId === user.id;
      }
    }).length;
  };

  if (!isClient || !user) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0A0A0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#737373', fontSize: '14px' }}>Loading session...</div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('99store_user');
    router.push('/login');
  };

  // Helper to dynamically override role for quick debugging
  const handleDebugRoleSwitch = (newRole: UserRole) => {
    const updatedUser = { ...user, role: newRole, name: `Demo ${newRole}` };
    setUser(updatedUser);
    localStorage.setItem('99store_user', JSON.stringify(updatedUser));
    // Trigger local state updates
    window.location.reload();
  };

  // Navigation Items with role-based restriction arrays
  const navItems = [
    {
      name: 'Dashboard & Reports',
      path: '/dashboard',
      icon: BarChart3,
      roles: ['Super Admin', 'Order Team', 'Packing Team', 'Tracking Team', 'Accounts Team']
    },
    {
      name: 'Order Entry & Manuals',
      path: '/dashboard/orders',
      icon: Package,
      roles: ['Super Admin', 'Order Team', 'Accounts Team']
    },
    {
      name: 'Packing & AWB Queue',
      path: '/dashboard/packing',
      icon: Tag,
      roles: ['Super Admin', 'Packing Team']
    },
    {
      name: 'Fulfillment & Dispatch',
      path: '/dashboard/tracking',
      icon: Truck,
      roles: ['Super Admin', 'Tracking Team']
    },
    {
      name: 'All Shipments Menu',
      path: '/dashboard/shipments',
      icon: Package,
      roles: ['Super Admin', 'Order Team', 'Packing Team', 'Tracking Team', 'Accounts Team']
    },
    {
      name: 'NDR Management',
      path: '/dashboard/ndr',
      icon: AlertOctagon,
      roles: ['Super Admin', 'Tracking Team']
    },
    {
      name: 'OFD Management',
      path: '/dashboard/ofd',
      icon: Truck,
      roles: ['Super Admin', 'Tracking Team']
    },
    {
      name: 'Internal Messages',
      path: '/dashboard/messages',
      icon: MessageSquare,
      roles: ['Super Admin', 'Order Team', 'Packing Team', 'Tracking Team', 'Accounts Team']
    },
    {
      name: 'User Accounts Management',
      path: '/dashboard/users',
      icon: Users,
      roles: ['Super Admin']
    },
    {
      name: 'API Integrations Hub',
      path: '/dashboard/settings',
      icon: Settings,
      roles: ['Super Admin']
    }
  ];

  const currentNav = navItems.find(item => item.path === pathname);
  const isAuthorized = currentNav ? currentNav.roles.includes(user.role) : true;

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#0A0A0A',
      color: '#FAFAFA'
    }}>
      {/* 1. Dynamic Role-Switching Debug Overlay Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '36px',
        backgroundColor: '#161619',
        borderBottom: '1px solid #2A2A30',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '11px',
        color: '#FAFAFA'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            backgroundColor: '#FAFAFA',
            color: '#0A0A0A',
            padding: '2px 6px',
            borderRadius: '3px',
            fontWeight: 'bold',
            fontSize: '9px',
            letterSpacing: '0.05em'
          }}>
            REVIEWER BAR
          </span>
          <span style={{ color: '#8A8A8A' }}>Use this to test different views:</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(['Super Admin', 'Order Team', 'Packing Team', 'Tracking Team', 'Accounts Team'] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => handleDebugRoleSwitch(r)}
              style={{
                background: user.role === r ? '#FAFAFA' : 'rgba(255,255,255,0.03)',
                color: user.role === r ? '#0A0A0A' : '#A1A1AA',
                border: '1px solid ' + (user.role === r ? '#FFFFFF' : '#2A2A30'),
                borderRadius: '4px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: user.role === r ? 'bold' : 'normal',
                transition: 'all 0.15s ease'
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Left Desktop Sidebar */}
      <aside style={{
        width: isSidebarCollapsed ? '72px' : '260px',
        backgroundColor: '#0F0F11',
        borderRight: '1px solid #1C1C21',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: '36px',
        bottom: 0,
        left: 0,
        zIndex: 999,
        padding: isSidebarCollapsed ? '24px 8px' : '24px 16px',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }} className="desktop-sidebar">
        {/* Brand */}
        <div style={{
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
          paddingLeft: isSidebarCollapsed ? '0' : '8px',
          gap: '8px'
        }}>
          {!isSidebarCollapsed ? (
            <div>
              <h2 style={{
                fontFamily: 'Outfit',
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#FAFAFA',
                margin: 0
              }}>
                99Store
              </h2>
              <span style={{ fontSize: '10px', color: '#737373', letterSpacing: '0.15em' }}>OMS SOFTWARE</span>
            </div>
          ) : (
            <div style={{
              fontFamily: 'Outfit',
              fontSize: '15px',
              fontWeight: 800,
              color: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }} title="99Store OMS Software">
              99
            </div>
          )}

          <button
            onClick={toggleSidebarCollapse}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #2A2A30',
              color: '#A1A1AA',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginTop: isSidebarCollapsed ? '8px' : '0'
            }}
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Sidebar Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const hasAccess = item.roles.includes(user.role);

            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                disabled={!hasAccess}
                title={isSidebarCollapsed ? item.name : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: isSidebarCollapsed ? '0' : '12px',
                  width: '100%',
                  padding: isSidebarCollapsed ? '10px 0' : '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                  color: isActive ? '#FFFFFF' : hasAccess ? '#A1A1AA' : '#3F3F46',
                  border: 'none',
                  textAlign: 'left',
                  cursor: hasAccess ? 'pointer' : 'not-allowed',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                  opacity: hasAccess ? 1 : 0.4,
                  position: 'relative'
                }}
              >
                <Icon size={18} />
                {!isSidebarCollapsed && (
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{item.name}</span>
                    {item.path === '/dashboard/messages' && unreadCount > 0 && (
                      <span style={{
                        backgroundColor: '#EF4444',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '10px',
                        lineHeight: 1
                      }}>
                        {unreadCount}
                      </span>
                    )}
                  </span>
                )}
                {isSidebarCollapsed && item.path === '/dashboard/messages' && unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '10px',
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    fontSize: '9px',
                    fontWeight: 700,
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadCount}
                  </span>
                )}
                {!hasAccess && !isSidebarCollapsed && <ShieldAlert size={12} style={{ color: '#E11D48' }} />}
              </button>
            );
          })}
        </nav>

        {/* Footer User Info */}
        <div style={{
          borderTop: '1px solid #1E1E24',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: isSidebarCollapsed ? 'center' : 'stretch'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', paddingLeft: isSidebarCollapsed ? '0' : '4px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#1E1E24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FAFAFA'
            }} title={isSidebarCollapsed ? `${user.name} (${user.role})` : undefined}>
              <UserIcon size={14} />
            </div>
            {!isSidebarCollapsed && (
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#FAFAFA', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {user.name}
                </p>
                <p style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  {user.role}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="premium-btn premium-btn-secondary"
            style={{
              width: '100%',
              padding: isSidebarCollapsed ? '8px' : '8px 12px',
              fontSize: '12.5px',
              justifyContent: 'center'
            }}
            title="Logout Terminal"
          >
            <LogOut size={14} />
            {!isSidebarCollapsed && <span>Logout Terminal</span>}
          </button>
        </div>
      </aside>

      <div style={{
        flex: 1,
        minWidth: 0,
        width: '100%',
        paddingLeft: isSidebarCollapsed ? '72px' : '260px',
        paddingTop: '36px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        transition: 'padding-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }} className="main-viewport">
        {/* Global Urgent Announcement Alert Banner */}
        {activeBanner && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#F87171',
            fontSize: '13px',
            fontWeight: 500,
            animation: 'fadeIn 0.3s ease',
            zIndex: 100
          }}>
            <span style={{
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              ALERT
            </span>
            <span style={{ flex: 1, color: '#E4E4E7' }}>
              <strong style={{ color: '#FAFAFA' }}>{activeBanner.senderName}:</strong> {activeBanner.content}
            </span>
            <button
              onClick={() => setActiveBanner(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#A1A1AA',
                cursor: 'pointer',
                fontSize: '11px',
                textDecoration: 'underline',
                padding: '2px 6px'
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Mobile Header Bar */}
        <header style={{
          height: '56px',
          borderBottom: '1px solid #1C1C21',
          padding: '0 16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          display: 'none',
          backgroundColor: '#0F0F11'
        }} className="mobile-header">
          <h2 style={{ fontFamily: 'Outfit', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            99Store
          </h2>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#FAFAFA',
              cursor: 'pointer'
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Desktop Header Navigation & Notification Bar */}
        <div style={{
          height: '52px',
          borderBottom: '1px solid #1C1C21',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0F0F11',
          zIndex: 900
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#737373' }}>Console /</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA' }}>{currentNav?.name || 'Overview'}</span>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Notification Bell Icon */}
            <button
              onClick={() => {
                setIsNotificationDrawerOpen(!isNotificationDrawerOpen);
                setStreamUnreadCount(0);
              }}
              style={{
                position: 'relative',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #2A2A30',
                borderRadius: '8px',
                padding: '8px',
                color: '#FAFAFA',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Real-Time System Event Pane"
            >
              <Bell size={18} />
              {streamUnreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#3B82F6',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 800,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)'
                }}>
                  {streamUnreadCount}
                </span>
              )}
            </button>

            {/* Notification Event Stream Drawer Pane */}
            {isNotificationDrawerOpen && (
              <div style={{
                position: 'absolute',
                top: '44px',
                right: 0,
                width: '360px',
                maxHeight: '480px',
                backgroundColor: '#161619',
                border: '1px solid #2A2A30',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }} className="animate-fade-in">
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A30', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F0F11' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={16} style={{ color: '#3B82F6' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#FAFAFA' }}>Real-Time Stream Feed</span>
                  </div>
                  <button onClick={() => setIsNotificationDrawerOpen(false)} style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {streamEvents.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#737373', fontSize: '13px' }}>Listening for live system events...</div>
                  ) : (
                    streamEvents.map((evt) => (
                      <div key={evt.id} style={{ padding: '10px 12px', backgroundColor: '#1A1A1E', borderRadius: '8px', borderLeft: '3px solid #3B82F6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAFAFA' }}>{evt.title}</span>
                          <span style={{ fontSize: '10px', color: '#737373' }}>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#A1A1AA', margin: 0 }}>{evt.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Auth Checker / View Render Panel */}
        <main style={{
          flex: 1,
          padding: '40px',
          maxWidth: '1440px',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          margin: '0 auto'
        }}>
          {isAuthorized ? (
            children
          ) : (
            <div className="premium-card animate-fade-in" style={{
              textAlign: 'center',
              padding: '60px 40px',
              marginTop: '40px',
              border: '1px dashed #E11D48',
              backgroundColor: 'rgba(225, 29, 72, 0.02)'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(225, 29, 72, 0.08)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#E11D48',
                marginBottom: '20px'
              }}>
                <ShieldAlert size={36} />
              </div>
              <h2 style={{ fontSize: '24px', color: '#FAFAFA', marginBottom: '10px' }}>
                ACCESS RESTRICTED
              </h2>
              <p style={{ fontSize: '14px', color: '#8A8A8A', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.6' }}>
                Your current account role (<strong>{user.role}</strong>) does not hold the proper authorization permissions to access the module at <code>{pathname}</code>.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="premium-btn premium-btn-primary"
                >
                  Return to Dashboard
                </button>
                <button
                  onClick={() => handleDebugRoleSwitch('Super Admin')}
                  className="premium-btn premium-btn-secondary"
                  style={{ borderColor: '#E11D48', color: '#E11D48' }}
                >
                  Force Super Admin Override
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 5. Real-time Toast Notifications */}
      <div style={{
        position: 'fixed',
        top: '50px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none'
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              setMiniActiveRecipientId(t.senderId);
              setIsChatOpen(true);
              setToasts((prev) => prev.filter((toast) => toast.id !== t.id));
            }}
            style={{
              backgroundColor: '#161619',
              borderLeft: '4px solid #10B981',
              borderTop: '1px solid #2A2A30',
              borderRight: '1px solid #2A2A30',
              borderBottom: '1px solid #2A2A30',
              borderRadius: '6px',
              padding: '12px 16px',
              width: '300px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#FAFAFA' }}>{t.senderName}</span>
              <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#10B981', fontWeight: 600 }}>{t.role}</span>
            </div>
            <p style={{ fontSize: '11px', color: '#A1A1AA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.content}
            </p>
            <span style={{ fontSize: '8px', color: '#737373', textAlign: 'right', marginTop: '2px' }}>Click to reply</span>
          </div>
        ))}
      </div>

      {/* 6. Mini Chat Tray Popover */}
      {isChatOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '24px',
          width: '360px',
          height: '480px',
          backgroundColor: '#0F0F11',
          border: '1px solid #2A2A30',
          borderRadius: '12px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          zIndex: 1999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.25s ease'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#161619',
            borderBottom: '1px solid #2A2A30',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {miniActiveRecipientId !== null && (
                <button
                  onClick={() => setMiniActiveRecipientId(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FAFAFA',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px'
                  }}
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#FAFAFA' }}>
                  {miniActiveRecipientId !== null ? miniActiveInfo.name : 'OMS Internal Chat'}
                </h4>
                <p style={{ fontSize: '9px', color: '#8A8A8A' }}>
                  {miniActiveRecipientId !== null ? miniActiveInfo.role : 'Instant Team Coordination'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsChatOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#8A8A8A',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {miniActiveRecipientId === null ? (
              /* Contact List View */
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Announcements */}
                <button
                  onClick={() => setMiniActiveRecipientId('all')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #2A2A30',
                    backgroundColor: 'rgba(245, 158, 11, 0.02)',
                    color: '#FAFAFA',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F59E0B'
                  }}>
                    <Megaphone size={14} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600 }}>📢 Announcements</p>
                    <p style={{ fontSize: '9px', color: '#737373' }}>Broadcast updates</p>
                  </div>
                  {getMiniUnreadCount('all') > 0 && (
                    <span style={{
                      backgroundColor: '#EF4444',
                      color: '#FFFFFF',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      padding: '2px 5px',
                      borderRadius: '10px'
                    }}>
                      {getMiniUnreadCount('all')}
                    </span>
                  )}
                </button>

                <div style={{ borderBottom: '1px solid #1C1C21', margin: '4px 0' }} />

                {/* Team Members List */}
                {layoutUsers.map((u) => {
                  const unread = getMiniUnreadCount(u.id);
                  const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                  return (
                    <button
                      key={u.id}
                      onClick={() => setMiniActiveRecipientId(u.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid transparent',
                        backgroundColor: 'transparent',
                        color: '#FAFAFA',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                        e.currentTarget.style.borderColor = '#1C1C21';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: '#1E1E24',
                        color: '#FAFAFA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {u.name}
                        </p>
                        <p style={{ fontSize: '9px', color: '#737373' }}>{u.role}</p>
                      </div>
                      {unread > 0 && (
                        <span style={{
                          backgroundColor: '#EF4444',
                          color: '#FFFFFF',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '1px 5px',
                          borderRadius: '10px',
                          flexShrink: 0
                        }}>
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Active Chat View */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Message list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {miniChatMessages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#737373', fontSize: '11px' }}>
                      No messages yet.
                    </div>
                  ) : (
                    miniChatMessages.map((msg) => {
                      const isSelf = msg.senderId === user.id;
                      if (msg.isBroadcast) {
                        return (
                          <div
                            key={msg.id}
                            style={{
                              backgroundColor: 'rgba(245, 158, 11, 0.02)',
                              border: '1px dashed #F59E0B',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              fontSize: '11px',
                              color: '#E4E4E7'
                            }}
                          >
                            <p style={{ fontWeight: 'bold', color: '#F59E0B', marginBottom: '2px' }}>
                              📢 Broadcast Notice:
                            </p>
                            <p style={{ lineHeight: '1.4' }}>{msg.content}</p>
                            <span style={{ fontSize: '8px', color: '#737373', display: 'block', marginTop: '4px', textAlign: 'right' }}>
                              by {msg.senderName}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={msg.id}
                          style={{
                            alignSelf: isSelf ? 'flex-end' : 'flex-start',
                            backgroundColor: isSelf ? '#FAFAFA' : '#1A1A1E',
                            color: isSelf ? '#0A0A0A' : '#FAFAFA',
                            border: isSelf ? '1px solid #FFFFFF' : '1px solid #222222',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            maxWidth: '85%',
                            fontSize: '11px',
                            lineHeight: '1.4',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {!isSelf && (
                            <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#8A8A8A', marginBottom: '2px' }}>
                              {msg.senderName}
                            </p>
                          )}
                          <p>{msg.content}</p>
                        </div>
                      );
                    })
                  )}
                  <div ref={miniChatEndRef} />
                </div>

                {/* Quick replies chips in mini chat */}
                {(!miniActiveRecipientId || miniActiveRecipientId !== 'all' || user.role === 'Super Admin') && (
                  <div style={{
                    padding: '6px 12px',
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    borderTop: '1px solid #1C1C21',
                    backgroundColor: '#121215',
                    scrollbarWidth: 'none'
                  }}>
                    {miniActiveRecipientId === 'all' ? (
                      <button
                        type="button"
                        onClick={() => handleMiniSendMessage(undefined, 'Operations running smoothly.')}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          border: '1px solid #2A2A30',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          color: '#A1A1AA',
                          fontSize: '9px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Operations running smoothly.
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMiniSendMessage(undefined, 'Working on it now.')}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            border: '1px solid #2A2A30',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            color: '#A1A1AA',
                            fontSize: '9px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Working on it now.
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMiniSendMessage(undefined, 'Order is packed.')}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            border: '1px solid #2A2A30',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            color: '#A1A1AA',
                            fontSize: '9px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Order is packed.
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMiniSendMessage(undefined, 'Ready to dispatch.')}
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            border: '1px solid #2A2A30',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            color: '#A1A1AA',
                            fontSize: '9px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Ready to dispatch.
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Composer */}
                <form
                  onSubmit={handleMiniSendMessage}
                  style={{
                    padding: '10px 12px',
                    borderTop: '1px solid #2A2A30',
                    backgroundColor: '#161619',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
                  {miniActiveRecipientId === 'all' && user.role !== 'Super Admin' ? (
                    <p style={{ fontSize: '10px', color: '#EF4444', flex: 1, textAlign: 'center' }}>
                      Only Super Admins can write announcements.
                    </p>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Type message..."
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
                        style={{
                          flex: 1,
                          backgroundColor: '#121212',
                          border: '1px solid #2A2A30',
                          borderRadius: '4px',
                          color: '#FAFAFA',
                          padding: '6px 10px',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!chatInputText.trim()}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: chatInputText.trim() ? '#FAFAFA' : '#737373',
                          cursor: chatInputText.trim() ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Send size={14} />
                      </button>
                    </>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Floating Chat Head Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: isChatOpen ? '#1A1A1E' : '#FAFAFA',
          color: isChatOpen ? '#FAFAFA' : '#0A0A0A',
          border: isChatOpen ? '1px solid #2A2A30' : 'none',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {isChatOpen ? <X size={20} /> : <MessageSquare size={20} />}

        {/* Pulse unread count badge */}
        {!isChatOpen && unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            fontSize: '10px',
            fontWeight: 'bold',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(239, 68, 68, 0.5)',
            animation: 'pulse 1.5s infinite'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* CSS overrides for responsive layout */}
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            transform: scale(1.05);
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        @media (max-width: 1024px) {
          .desktop-sidebar {
            display: none !important;
          }
          .main-viewport {
            padding-left: 0 !important;
          }
          .mobile-header {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
