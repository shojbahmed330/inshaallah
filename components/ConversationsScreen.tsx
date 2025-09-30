import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Conversation, AppView } from '../types';
import { firebaseService } from '../services/firebaseService';
import Icon from './Icon';
import ChatWidget from './ChatWidget';

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
};

const ConversationRow: React.FC<{ 
    convo: Conversation; 
    onClick: () => void; 
    style: React.CSSProperties;
    className: string;
    onContextMenu: (e: React.MouseEvent) => void;
    isSelected: boolean;
}> = ({ convo, onClick, style, className, onContextMenu, isSelected }) => {
    const lastMessageText = () => {
        if (!convo.lastMessage) return 'No messages yet.';
        if (convo.lastMessage.isDeleted) return 'Unsent message';
        switch (convo.lastMessage.type) {
            case 'text': return convo.lastMessage.text;
            case 'image': return 'Photo';
            case 'video': return 'Video';
            case 'audio': return `Voice message · ${convo.lastMessage.duration}s`;
            case 'call_history': return `Call · ${convo.lastMessage.callStatus}`;
            default: return '...';
        }
    };

    const isUnread = convo.unreadCount > 0;
    const isOnline = convo.peer.onlineStatus === 'online';
    
    const bgClasses = useMemo(() => {
        if (isSelected) {
            return 'bg-slate-700';
        }
        let classes = 'bg-slate-800/50 hover:bg-slate-700/50';
        if (isUnread) {
            // Adding a subtle background tint for unread messages as requested in a previous turn.
            classes += ' bg-fuchsia-500/10';
        }
        return classes;
    }, [isSelected, isUnread]);

    return (
        <div
            className={`w-full rounded-lg transition-colors duration-200 ease-out cursor-pointer ${className} ${bgClasses}`}
            style={style}
            onContextMenu={onContextMenu}
            onClick={onClick}
        >
            <div className="w-full flex items-center gap-4 p-3 relative z-10">
                <div className="relative">
                    <img src={convo.peer.avatarUrl} alt={convo.peer.name} className="w-16 h-16 rounded-full" />
                    {isOnline && (
                         <div className="absolute bottom-0 right-0 w-4 h-4 bg-sky-500 rounded-full border-2 border-slate-800"></div>
                    )}
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="flex justify-between items-baseline">
                        <p className={`font-bold text-lg truncate ${isUnread ? 'text-white' : 'text-slate-200'}`}>{convo.peer.name}</p>
                        {convo.lastMessage && <p className="text-xs text-slate-400 flex-shrink-0">{new Date(convo.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                    </div>
                    <div className="flex justify-between items-center">
                        <p className={`text-sm truncate pr-2 ${isUnread ? 'text-pink-300 font-semibold' : 'text-slate-400'}`}>
                            {convo.lastMessage && convo.lastMessage.senderId === convo.peer.id ? '' : 'You: '}{lastMessageText()}
                        </p>
                        {isUnread && (
                            <span className="bg-fuchsia-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 animate-bounce-in">{convo.unreadCount}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ConversationsScreenProps {
  currentUser: User;
  onOpenConversation: (peer: User) => void;
  onNavigate: (view: AppView, props?: any) => void;
}

const ConversationsScreen: React.FC<ConversationsScreenProps> = ({ currentUser, onOpenConversation, onNavigate }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, convo: Conversation } | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [glowingItems, setGlowingItems] = useState<Set<string>>(new Set());
    const lastMessageIds = useRef(new Map<string, string>());
    const isMobile = useIsMobile();
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = firebaseService.listenToConversations(currentUser.id, (convos) => {
            const newGlows = new Set<string>();
            convos.forEach(convo => {
                const prevMsgId = lastMessageIds.current.get(convo.peer.id);
                const currentMsg = convo.lastMessage;
                if (currentMsg && currentMsg.id !== prevMsgId && currentMsg.senderId !== currentUser.id) {
                    newGlows.add(convo.peer.id);
                }
                if (currentMsg) {
                    lastMessageIds.current.set(convo.peer.id, currentMsg.id);
                }
            });

            if (newGlows.size > 0) {
                setGlowingItems(newGlows);
                setTimeout(() => setGlowingItems(new Set()), 1500);
            }
            
            setConversations(convos);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser.id]);
    
    const handleOpenChat = (convo: Conversation) => {
        if (isMobile) {
            setIsExiting(true);
            setTimeout(() => {
                onOpenConversation(convo.peer);
            }, 300); // Animation duration
        } else {
            setSelectedConvo(convo);
        }
    };
    
    const handleContextMenu = (e: React.MouseEvent, convo: Conversation) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, convo });
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setIsScrolled(e.currentTarget.scrollTop > 10);
    };

    const listPane = (
         <div className="h-full w-full flex flex-col bg-slate-900/80">
            <header className={`sticky top-0 z-20 flex-shrink-0 flex items-center justify-between p-4 border-b border-fuchsia-500/20 bg-black/50 transition-all duration-300 ${isScrolled ? 'h-16 backdrop-blur-md' : 'h-24'}`}>
                <h1 className={`font-bold text-slate-100 transition-all duration-300 ${isScrolled ? 'text-2xl' : 'text-3xl'}`}>Messages</h1>
            </header>
            <main ref={listRef} onScroll={handleScroll} className="flex-grow overflow-y-auto">
                {isLoading ? (
                    <p className="text-center p-8 text-slate-400">Loading conversations...</p>
                ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-8">
                        <Icon name="message" className="w-20 h-20 mb-4" />
                        <h2 className="text-xl font-bold text-slate-300">No conversations yet</h2>
                        <p className="mt-2">Find friends and start a chat to see it here.</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {conversations.map((convo, index) => (
                            <ConversationRow
                                key={convo.peer.id}
                                convo={convo}
                                onClick={() => handleOpenChat(convo)}
                                onContextMenu={(e) => handleContextMenu(e, convo)}
                                style={{ animationDelay: `${index * 50}ms` }}
                                className={`animate-fade-slide-in ${glowingItems.has(convo.peer.id) ? 'animate-glow-pulse' : ''}`}
                                isSelected={!isMobile && selectedConvo?.peer.id === convo.peer.id}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );

    return (
        <div className={`h-full w-full flex transition-transform duration-300 ${isExiting ? 'animate-slide-out-left' : ''}`}>
            <div className={`w-full lg:w-[420px] flex-shrink-0 h-full border-r border-slate-700/50 ${!isMobile && selectedConvo ? 'hidden lg:block' : 'block'}`}>
                {listPane}
            </div>
            
            {!isMobile && (
                <main className={`flex-grow h-full bg-slate-900 ${selectedConvo ? '' : 'flex items-center justify-center'}`}>
                    {selectedConvo ? (
                         <div className="w-full h-full animate-fade-scale-in">
                            <ChatWidget 
                                key={selectedConvo.peer.id}
                                currentUser={currentUser}
                                peerUser={selectedConvo.peer}
                                onGoBack={() => setSelectedConvo(null)}
                                isFullScreen={true}
                                onNavigate={onNavigate}
                                onMinimize={() => {}}
                                onClose={() => setSelectedConvo(null)}
                                onHeaderClick={() => {}}
                                isMinimized={false}
                                unreadCount={0}
                                setIsChatRecording={() => {}}
                                onSetTtsMessage={() => {}}
                                onBlockUser={() => {}}
                            />
                         </div>
                    ) : (
                        <div className="text-center text-slate-500">
                            <Icon name="message" className="w-24 h-24 mb-4" />
                            <h2 className="text-2xl font-bold text-slate-300">Select a conversation</h2>
                            <p>Choose a chat from the left to start messaging.</p>
                        </div>
                    )}
                </main>
            )}

            {contextMenu && (
                <div
                    className="fixed inset-0 z-50"
                    onClick={() => setContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                >
                    <div
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        className="absolute bg-slate-800 rounded-lg shadow-2xl border border-slate-700 w-48 text-sm font-semibold text-slate-200 animate-fade-scale-in"
                    >
                        <button className="w-full text-left p-3 hover:bg-slate-700 rounded-t-lg">Pin Conversation</button>
                        <button className="w-full text-left p-3 hover:bg-slate-700">Mute Notifications</button>
                        <button className="w-full text-left p-3 text-red-400 hover:bg-red-500/10 rounded-b-lg">Delete Chat</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConversationsScreen;