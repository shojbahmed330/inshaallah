
import React, { useState, useEffect } from 'react';
import { User, Conversation, AppView } from '../types';
import { firebaseService } from '../services/firebaseService';
import Icon from './Icon';

interface ConversationsScreenProps {
  currentUser: User;
  onOpenConversation: (peer: User) => void;
  onNavigate: (view: AppView, props?: any) => void;
}

const ConversationRow: React.FC<{ convo: Conversation; onClick: () => void }> = ({ convo, onClick }) => {
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

    return (
        <button onClick={onClick} className="w-full flex items-center gap-4 p-3 rounded-lg text-left hover:bg-slate-800 transition-colors">
            <div className="relative">
                <img src={convo.peer.avatarUrl} alt={convo.peer.name} className="w-16 h-16 rounded-full" />
                {convo.peer.onlineStatus === 'online' && (
                     <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900"></div>
                )}
            </div>
            <div className="flex-grow overflow-hidden">
                <div className="flex justify-between items-baseline">
                    <p className={`font-bold text-lg truncate ${isUnread ? 'text-white' : 'text-slate-200'}`}>{convo.peer.name}</p>
                    {convo.lastMessage && <p className="text-xs text-slate-400 flex-shrink-0">{new Date(convo.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
                <div className="flex justify-between items-center">
                    <p className={`text-sm truncate ${isUnread ? 'text-white font-semibold' : 'text-slate-400'}`}>
                        {convo.lastMessage && convo.lastMessage.senderId !== convo.peer.id ? 'You: ' : ''}{lastMessageText()}
                    </p>
                    {isUnread && (
                        <span className="bg-rose-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">{convo.unreadCount}</span>
                    )}
                </div>
            </div>
        </button>
    );
};


const ConversationsScreen: React.FC<ConversationsScreenProps> = ({ currentUser, onOpenConversation }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = firebaseService.listenToConversations(currentUser.id, (convos) => {
            setConversations(convos);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser.id]);

    return (
        <div className="h-full w-full flex flex-col bg-slate-900">
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-fuchsia-500/20 bg-black/20 backdrop-blur-sm">
                <h1 className="text-2xl font-bold text-slate-100">Messages</h1>
            </header>

            <main className="flex-grow overflow-y-auto">
                {isLoading ? (
                    <p className="text-center p-8 text-slate-400">Loading conversations...</p>
                ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-8">
                        <Icon name="message" className="w-20 h-20 mb-4" />
                        <h2 className="text-xl font-bold text-slate-300">No conversations yet</h2>
                        <p className="mt-2">Find friends and start a chat to see it here.</p>
                    </div>
                ) : (
                    <div className="p-2">
                        {conversations.map(convo => (
                            <ConversationRow key={convo.peer.id} convo={convo} onClick={() => onOpenConversation(convo.peer)} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ConversationsScreen;
