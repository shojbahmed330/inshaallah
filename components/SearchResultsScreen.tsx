
import React, { useEffect, useCallback } from 'react';
import { User } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { useSettings } from '../contexts/SettingsContext';
import UserCard from './UserCard';

interface SearchResultsScreenProps {
  results: User[];
  query: string;
  onOpenProfile: (username: string) => void;
  onGoBack: () => void;
}

// FIX: Add export to allow component to be imported in UserApp.tsx
export const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({ results, query, onOpenProfile, onGoBack }) => {
  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-4 text-lime-200">Search Results</h1>
            <p className="text-slate-400 mb-6">Showing results for: <span className="font-bold text-slate-200">"{query}"</span></p>

            {results.length > 0 ? (
                <div className="flex flex-col gap-4">
                    {results.map(user => (
                        <UserCard
                            key={user.id}
                            user={user}
                            onProfileClick={onOpenProfile}
                        >
                            <button onClick={() => onOpenProfile(user.username)} className="px-3 py-2 text-sm rounded-lg bg-lime-600 hover:bg-lime-500 text-black font-bold transition-colors flex items-center gap-2">
                                View Profile
                            </button>
                        </UserCard>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-800/50 rounded-lg">
                    <p className="text-xl font-semibold text-slate-300">No users found</p>
                    <p className="text-slate-400 mt-2">Try searching for a different name or username.</p>
                </div>
            )}
        </div>
    </div>
  );
};
