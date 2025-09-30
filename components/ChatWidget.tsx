
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { User, Message, AppView, ReplyInfo } from '../types';
import { firebaseService } from '../services/firebaseService';
import Icon from './Icon';

interface ChatWidgetProps {
    currentUser: User;
    peerUser: User;
    isMinimized: boolean;
    unreadCount: number;
    onClose: (peerId: string) => void;
    onMinimize: (peerId: string) => void;
    onHeaderClick: (peerId: string) => void;
    setIsChatRecording: (isRecording: boolean) => void;
    onNavigate: (view: AppView, props?: any) => void;
    onSetTtsMessage: (message: string) => void;
    onBlockUser: (user: User) => void;
}

const ChatMessage: React.FC<{ message: Message; isMe: boolean; peerAvatar: string }> = ({ message, isMe, peerAvatar }) => {
    const messageContent = () => {
        if (message.isDeleted) {
            return <p className="italic text-slate-400">Unsent message</p>;
        }
        switch (message.type) {
            case 'text':
                return <p className="whitespace-pre-wrap">{message.text}</p>;
            case 'image':
                return <img src={message.mediaUrl} alt="sent" className="max-w-xs max-h-60 rounded-lg cursor-pointer" />;
            case 'video':
                 return <video src={message.mediaUrl} controls className="max-w-xs max-h-60 rounded-lg" />;
            case 'audio':
                return (
                    <div className="flex items-center gap-2 cursor-pointer">
                        <Icon name="play" className="w-5 h-5"/>
                        <span>Voice Message ({message.duration}s)</span>
                    </div>
                );
            case 'call_history':
                return (
                    <div className="flex items-center gap-2 italic text-slate-400">
                        <Icon name="phone" className="w-4 h-4" />
                        <span>{message.callType} call · {message.callStatus}</span>
                    </div>
                );
            default: return null;
        }
    };

    const bubbleClasses = isMe
        ? 'bg-rose-600 text-white rounded-l-2xl rounded-tr-2xl'
        : 'bg-slate-600 text-white rounded-r-2xl rounded-tl-2xl';

    return (
        <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
            {!isMe && <img src={peerAvatar} alt="peer" className="w-6 h-6 rounded-full mb-1"/>}
            <div className={`px-4 py-2 ${bubbleClasses} max-w-[80%]`}>
                {messageContent()}
            </div>
        </div>
    );
};

const ChatWidget: React.FC<ChatWidgetProps> = (props) => {
    const { currentUser, peerUser, isMinimized, unreadCount, onClose, onMinimize, onHeaderClick, setIsChatRecording, onNavigate, onBlockUser } = props;
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatId = useMemo(() => firebaseService.getChatId(currentUser.id, peerUser.id), [currentUser.id, peerUser.id]);

    useEffect(() => {
        if (!isMinimized) {
            const unsubscribe = firebaseService.listenToMessages(chatId, (newMessages) => {
                setMessages(newMessages);
                if (document.visibilityState === 'visible') {
                    firebaseService.markMessagesAsRead(chatId, currentUser.id);
                }
            });
            return () => unsubscribe();
        }
    }, [chatId, isMinimized, currentUser.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    useEffect(() => {
        setIsChatRecording(isRecording);
    }, [isRecording, setIsChatRecording]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await firebaseService.sendMessage(chatId, currentUser, peerUser, { type: 'text', text: newMessage });
        setNewMessage('');
    };
    
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            let startTime = Date.now();
            recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const duration = Math.round((Date.now() - startTime) / 1000);
                await firebaseService.sendMessage(chatId, currentUser, peerUser, { type: 'audio', audioBlob, duration });
                stream.getTracks().forEach(track => track.stop());
            };
            recorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Mic permission error:", err);
            props.onSetTtsMessage("Microphone permission denied.");
        }
    }, [chatId, currentUser, peerUser, props]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    }, []);


    if (isMinimized) {
        return (
            <button onClick={() => onHeaderClick(peerUser.id)} className="w-16 h-16 rounded-full shadow-2xl relative pointer-events-auto">
                <img src={peerUser.avatarUrl} alt={peerUser.name} className="w-full h-full rounded-full" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white border-2 border-slate-900">{unreadCount}</span>}
                {peerUser.onlineStatus === 'online' && <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800"></div>}
            </button>
        );
    }
    
    return (
        <div className="fixed inset-0 md:inset-auto md:relative w-full h-full md:w-80 md:h-96 flex flex-col bg-slate-800/80 backdrop-blur-md border border-fuchsia-500/30 rounded-lg shadow-2xl animate-fade-in-fast pointer-events-auto">
            <header className="flex-shrink-0 flex items-center p-2 border-b border-slate-700/50 cursor-pointer" onClick={() => onHeaderClick(peerUser.id)}>
                <img src={peerUser.avatarUrl} alt={peerUser.name} className="w-9 h-9 rounded-full"/>
                <div className="ml-2 flex-grow">
                    <p className="font-bold text-slate-100">{peerUser.name}</p>
                    <p className="text-xs text-slate-400">{peerUser.onlineStatus === 'online' ? 'Online' : 'Offline'}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onMinimize(peerUser.id); }} className="p-2 rounded-full hover:bg-slate-700"><Icon name="close" className="w-5 h-5"/></button>
                <button onClick={(e) => { e.stopPropagation(); onClose(peerUser.id); }} className="p-2 rounded-full hover:bg-slate-700"><Icon name="close" className="w-5 h-5"/></button>
            </header>
            <main className="flex-grow overflow-y-auto p-3 space-y-4">
                {messages.map(msg => <ChatMessage key={msg.id} message={msg} isMe={msg.senderId === currentUser.id} peerAvatar={peerUser.avatarUrl} />)}
                <div ref={messagesEndRef} />
            </main>
            <footer className="flex-shrink-0 p-2 border-t border-slate-700/50">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-grow bg-slate-700 border-slate-600 rounded-full py-2 px-4 focus:ring-fuchsia-500 focus:border-fuchsia-500 text-white"/>
                    {!newMessage && (
                        <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`p-2.5 rounded-full text-white ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-fuchsia-600'}`}>
                            <Icon name="mic" className="w-5 h-5"/>
                        </button>
                    )}
                    {newMessage && (
                        <button type="submit" className="p-2.5 rounded-full text-white bg-fuchsia-600">
                             <Icon name="paper-airplane" className="w-5 h-5" />
                        </button>
                    )}
                </form>
            </footer>
        </div>
    );
};

export default ChatWidget;
