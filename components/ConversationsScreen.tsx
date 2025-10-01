import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Conversation, AppView, Message } from '../types';
import Icon from './Icon';
import { useSettings } from '../contexts/SettingsContext';
import { firebaseService } from '../services/firebaseService';
import {
    doc, onSnapshot
} from 'firebase/firestore';
import { db } from '../services/firebaseConfig';


const SWIPE_THRESHOLD = -70; // Pixels to swipe before it's considered an action
const SWIPE_ACTION_WIDTH = 80; // Width for each action icon

const docToUser = (doc: any): User => {
    const data = doc.data();
    const user = {
        id: doc.id,
        ...data,
    } as User;
    
    if (user.createdAt && typeof (user.createdAt as any).toDate === 'function') {
        user.createdAt = (user.createdAt as any).toDate().toISOString();
    }
    if (user.commentingSuspendedUntil && typeof (user.commentingSuspendedUntil as any).toDate === 'function') {
        user.commentingSuspendedUntil = (user.commentingSuspendedUntil as any).toDate().toISOString();
    }
     if (user.lastActiveTimestamp && typeof (user.lastActiveTimestamp as any).toDate === 'function') {
        user.lastActiveTimestamp = (user.lastActiveTimestamp as any).toDate().toISOString();
    }
    
    return user;
};

const formatLastActive = (isoString?: string): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days === 1) return 'yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
};


// Re-engineered ConversationItem to be a stateful, interactive component with unified pointer events
const ConversationItem: React.FC<{
  conversation: Conversation;
  currentUserId: string;
  isPinned: boolean;
  isTyping: boolean;
  style: React.CSSProperties;
  animatedMessageIds: Set<string>;
  onAnimationEnd: (messageId: string) => void;
  onClick: () => void;
  onPinToggle: (peerId: string) => void;
  onDelete: (peerId: string) => void;
  onMute: (peerId: string) => void;
}> = ({ conversation, currentUserId, isPinned, isTyping, style, animatedMessageIds, onAnimationEnd, onClick, onPinToggle, onDelete, onMute }) => {
    const { peer, lastMessage, unreadCount } = conversation;
    
    // Interaction State
    const [swipeX, setSwipeX] = useState(0);
    
    const touchStart = useRef({ x: 0, y: 0, time: 0 });
    const isDragging = useRef(false);
    const isSwipingHorizontally = useRef(false);
    const dragStartSwipeX = useRef(0);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        isDragging.current = true;
        isSwipingHorizontally.current = false;
        touchStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        dragStartSwipeX.current = swipeX;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        const deltaX = e.clientX - touchStart.current.x;
        const deltaY = e.clientY - touchStart.current.y;
        
        if (!isSwipingHorizontally.current && Math.abs(deltaX) > Math.abs(deltaY) + 5) {
            isSwipingHorizontally.current = true;
            if (navigator.vibrate) navigator.vibrate(1); // Haptic feedback on swipe start
        }

        if (isSwipingHorizontally.current) {
             const newSwipeX = dragStartSwipeX.current + deltaX;
             const clampedSwipeX = Math.max(-SWIPE_ACTION_WIDTH * 3 - 20, Math.min(newSwipeX, 20));
             setSwipeX(clampedSwipeX);
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;

        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        isDragging.current = false;

        if (swipeX < SWIPE_THRESHOLD) {
            setSwipeX(-SWIPE_ACTION_WIDTH * 3);
        } else {
            setSwipeX(0);
        }

        const pressDuration = Date.now() - touchStart.current.time;
        const movedDistance = Math.hypot(e.clientX - touchStart.current.x, e.clientY - touchStart.current.y);

        if (pressDuration < 250 && movedDistance < 10) {
            onClick();
        }
    };
    
    const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging.current) handlePointerUp(e);
    };

    const handleActionClick = (action: 'pin' | 'mute' | 'delete', e: React.MouseEvent) => {
        e.stopPropagation();
        if (action === 'pin') onPinToggle(peer.id);
        else if (action === 'delete') onDelete(peer.id);
        else onMute(peer.id);
        setSwipeX(0);
    };

    if (!lastMessage) return null;

    const isLastMessageFromMe = lastMessage.senderId === currentUserId;
    const isUnread = unreadCount > 0 && !isLastMessageFromMe;
    
    const isNew = isUnread && lastMessage && !animatedMessageIds.has(lastMessage.id);

    const handleLocalAnimationEnd = () => {
        if (lastMessage) {
            onAnimationEnd(lastMessage.id);
        }
    };

    const timeDisplay = peer.onlineStatus === 'online'
        ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})
        : formatLastActive(peer.lastActiveTimestamp);

    const getSnippet = (message: Message): string => {
        if (message.isDeleted) return isLastMessageFromMe ? "You unsent a message" : "Unsent a message";
        const prefix = isLastMessageFromMe ? 'You: ' : '';
        switch (message.type) {
            case 'text': return prefix + (message.text || '');
            case 'image': return isLastMessageFromMe ? 'You sent an image 📷' : 'Sent an image 📷';
            case 'video': return isLastMessageFromMe ? 'You sent a video 📹' : 'Sent a video 📹';
            case 'audio': return `${prefix}Voice message · ${message.duration}s`;
            case 'call_history': 
                const callVerb = message.callStatus === 'missed' ? 'Missed' : 'Declined';
                return `${callVerb} ${message.callType} call`;
            default: return '...';
        }
    };
    
    const deleteSwipeProgress = Math.max(0, Math.min(1, (-swipeX - (SWIPE_ACTION_WIDTH * 2)) / SWIPE_ACTION_WIDTH));
    const deleteButtonStyle = {
        boxShadow: `0 0 ${deleteSwipeProgress * 20}px rgba(220, 38, 38, 0.8)`,
        transform: `scale(${1 + deleteSwipeProgress * 0.1})`,
    };

    return (
        <div className="w-full relative animate-list-item-slide-in" style={style}>
            <div className="absolute inset-y-0 right-0 flex items-center bg-slate-700 text-white z-0 overflow-hidden rounded-r-lg" style={{ width: `${-swipeX > 0 ? Math.min(-swipeX, SWIPE_ACTION_WIDTH * 3) : 0}px` }}>
                <button onClick={(e) => handleActionClick('pin', e)} className="w-20 h-full flex flex-col items-center justify-center gap-1 bg-sky-600 hover:bg-sky-500"><Icon name="pin" className="w-6 h-6"/>{isPinned ? 'Unpin' : 'Pin'}</button>
                <button onClick={(e) => handleActionClick('mute', e)} className="w-20 h-full flex flex-col items-center justify-center gap-1 bg-slate-600 hover:bg-slate-500"><Icon name="bell-slash" className="w-6 h-6"/>Mute</button>
                <button onClick={(e) => handleActionClick('delete', e)} style={deleteButtonStyle} className="w-20 h-full flex flex-col items-center justify-center gap-1 bg-red-600 hover:bg-red-500 transition-all rounded-r-lg"><Icon name="trash" className="w-6 h-6"/>Delete</button>
            </div>

            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onAnimationEnd={isNew ? handleLocalAnimationEnd : undefined}
                className={`w-full p-3 rounded-lg flex items-center gap-4 relative z-10 transition-transform duration-200 ease-out touch-pan-y ${isPinned ? 'bg-gradient-to-r from-fuchsia-900/40 via-slate-800/50 to-slate-800/50' : isUnread ? 'bg-slate-700/60' : 'bg-slate-800/50'} ${isNew ? 'animate-glow' : ''}`}
                style={{ transform: `translateX(${swipeX}px)` }}
            >
                <div className="relative flex-shrink-0">
                    <img src={peer.avatarUrl} alt={peer.name} className="w-16 h-16 rounded-full"/>
                    <div className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 ${
                        peer.onlineStatus === 'online' ? 'bg-green-500 border-slate-900' : 'bg-slate-500 border-slate-800'
                    }`} />
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="flex justify-between items-baseline">
                        <p className={`text-lg truncate ${isUnread ? 'text-white font-bold' : 'text-slate-300 font-semibold'}`}>{peer.name}</p>
                        <p className={`text-xs flex-shrink-0 ${isUnread ? 'text-fuchsia-400 font-semibold' : 'text-slate-400'}`}>{timeDisplay}</p>
                    </div>
                    <div className="flex justify-between items-start mt-1">
                        {isTyping ? (
                            <p className="text-sm truncate pr-2 text-fuchsia-400 italic animate-pulse">typing...</p>
                        ) : (
                            <p className={`text-sm truncate pr-2 ${isUnread ? 'text-slate-200 font-semibold' : 'text-slate-400'}`}>{getSnippet(lastMessage)}</p>
                        )}
                        {isUnread && <span className="bg-fuchsia-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">{unreadCount}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ConversationsScreen: React.FC<{
  currentUser: User;
  onOpenConversation: (peer: User) => void;
}> = ({ currentUser, onOpenConversation }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const { language } = useSettings();

  const [liveUsers, setLiveUsers] = useState<Map<string, User>>(new Map());
  const [animatedMessageIds, setAnimatedMessageIds] = useState(new Set<string>());

  const handleAnimationEnd = useCallback((messageId: string) => {
    setAnimatedMessageIds(prev => {
        if (prev.has(messageId)) return prev;
        const newSet = new Set(prev);
        newSet.add(messageId);
        return newSet;
    });
  }, []);

  const allRelevantUserIds = useMemo(() => {
    const peerIds = conversations.map(c => c.peer.id);
    const friendIds = currentUser.friendIds || [];
    return [...new Set([...peerIds, ...friendIds])];
  }, [conversations, currentUser.friendIds]);

  useEffect(() => {
    if (allRelevantUserIds.length === 0) return;

    const unsubscribes = allRelevantUserIds.map(userId => {
        const userRef = doc(db, 'users', userId);
        return onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                const user = docToUser(doc);
                setLiveUsers(prev => new Map(prev).set(userId, user));
            }
        });
    });

    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
  }, [JSON.stringify(allRelevantUserIds)]); // Use JSON.stringify for array dependency

  const onlineFriends = useMemo(() => {
    const friends: User[] = [];
    (currentUser.friendIds || []).forEach(friendId => {
        const user = liveUsers.get(friendId);
        if (user && user.onlineStatus === 'online') {
            friends.push(user);
        }
    });
    return friends;
  }, [liveUsers, currentUser.friendIds]);


  useEffect(() => {
    const unsubscribe = firebaseService.listenToConversations(currentUser.id, (newConversations) => {
        setConversations(newConversations);
    });

    return () => unsubscribe();
}, [currentUser.id]);

  const handlePinToggle = (peerId: string) => {
    setPinnedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(peerId)) {
        newSet.delete(peerId);
      } else {
        newSet.add(peerId);
      }
      return newSet;
    });
  };
  
  const handleDeleteChat = (peerId: string) => {
    if (window.confirm("Are you sure you want to permanently delete this conversation? This action cannot be undone.")) {
        const chatId = firebaseService.getChatId(currentUser.id, peerId);
        firebaseService.deleteChatHistory(chatId);
        // The real-time listener will update the UI automatically.
    }
  };

  const handleMuteChat = (peerId: string) => {
      alert(`Mute notifications for this user (feature coming soon).`);
  };
  
  const filteredConversations = conversations.filter(c =>
    c.peer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a, b) => {
      const aIsPinned = pinnedIds.has(a.peer.id);
      const bIsPinned = pinnedIds.has(b.peer.id);
      if (aIsPinned !== bIsPinned) return aIsPinned ? -1 : 1;
      // Handle cases where lastMessage or createdAt might be missing
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredConversations, pinnedIds]);

  const enrichedConversations = useMemo(() => {
    return sortedConversations.map(convo => {
        const liveUser = liveUsers.get(convo.peer.id);
        if (liveUser) {
            const enrichedPeer = { ...convo.peer, onlineStatus: liveUser.onlineStatus, lastActiveTimestamp: liveUser.lastActiveTimestamp };
            return { ...convo, peer: enrichedPeer };
        }
        return convo;
    });
  }, [sortedConversations, liveUsers]);

  return (
    <div className="h-full w-full flex flex-col">
      <header className="flex-shrink-0 p-4 border-b border-fuchsia-500/20 bg-black/30 backdrop-blur-sm z-10">
        <h1 className="text-3xl font-bold text-slate-100 mb-4">Messages</h1>
        <form className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
            </svg>
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="bg-slate-800 border border-slate-700 text-slate-100 text-base rounded-full focus:ring-fuchsia-500 focus:border-fuchsia-500 block w-full pl-11 p-3 transition"
          />
        </form>
      </header>
      
      {onlineFriends.length > 0 && (
        <div className="px-4 pt-4 flex-shrink-0">
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {onlineFriends.map(friend => (
              <button key={friend.id} onClick={() => onOpenConversation(friend)} className="flex flex-col items-center gap-1 w-16 text-center flex-shrink-0">
                <div className="relative">
                  <img src={friend.avatarUrl} alt={friend.name} className="w-14 h-14 rounded-full" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900"></div>
                </div>
                <p className="text-xs text-slate-300 truncate w-full">{friend.name.split(' ')[0]}</p>
              </button>
            ))}
          </div>
          <div className="border-t border-fuchsia-500/10 my-2"></div>
        </div>
      )}

      <div className="flex-grow overflow-y-auto p-4 space-y-3">
        {enrichedConversations.length > 0 ? (
          enrichedConversations.map((conversation, index) => (
            <ConversationItem
              key={conversation.peer.id}
              conversation={conversation}
              currentUserId={currentUser.id}
              isPinned={pinnedIds.has(conversation.peer.id)}
              isTyping={conversation.isTyping || false}
              style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
              animatedMessageIds={animatedMessageIds}
              onAnimationEnd={handleAnimationEnd}
              onClick={() => onOpenConversation(conversation.peer)}
              onPinToggle={handlePinToggle}
              onDelete={handleDeleteChat}
              onMute={handleMuteChat}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
            <Icon name="message" className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl font-semibold">No conversations yet</p>
            <p>Start a chat with a friend to see it here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationsScreen;