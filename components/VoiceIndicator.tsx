import React from 'react';
import { VoiceState } from '../types';
import Icon from './Icon';

interface VoiceIndicatorProps {
  voiceState: VoiceState;
  interimTranscript: string;
}

const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({ voiceState, interimTranscript }) => {
    
    const getIndicatorClasses = () => {
        switch (voiceState) {
            case VoiceState.IDLE:
                return 'bg-slate-700/80 text-slate-300';
            case VoiceState.PASSIVE_LISTENING:
                return 'bg-slate-800/80 text-fuchsia-400 animate-slow-pulse';
            case VoiceState.ACTIVE_LISTENING:
                return 'bg-rose-600/90 text-white ring-4 ring-rose-500/50 animate-pulse';
            case VoiceState.PROCESSING:
                return 'bg-amber-500/90 text-white';
            default:
                return 'bg-slate-800/80';
        }
    };
    
    const getText = () => {
        if (interimTranscript && voiceState === VoiceState.ACTIVE_LISTENING) {
            return interimTranscript;
        }
        switch (voiceState) {
            case VoiceState.IDLE:
                return "Mic permission needed";
            case VoiceState.PASSIVE_LISTENING:
                return "Say 'Hey VoiceBook'";
            case VoiceState.ACTIVE_LISTENING:
                return "Listening...";
            case VoiceState.PROCESSING:
                return "Processing...";
            default:
                return "";
        }
    };

    if (voiceState === VoiceState.IDLE) return null; // Don't show if not active

    return (
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex justify-center">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-300 ${getIndicatorClasses()}`}>
                <Icon name={voiceState === VoiceState.PROCESSING ? 'logo' : 'mic'} className={`w-6 h-6 ${voiceState === VoiceState.PROCESSING ? 'animate-spin' : ''}`} />
                <p className="font-semibold">{getText()}</p>
            </div>
        </div>
    );
};

export default VoiceIndicator;
