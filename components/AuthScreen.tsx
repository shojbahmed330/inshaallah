import React, { useState, useEffect, useCallback } from 'react';
import { AuthMode } from '../types';
import { firebaseService } from '../services/firebaseService';
import Icon from './Icon';
import { useSettings } from '../contexts/SettingsContext';

interface AuthScreenProps {
  initialAuthError?: string;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ 
  initialAuthError
}) => {
  const [mode, setMode] = useState<AuthMode>(AuthMode.LOGIN);
  
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [prompt, setPrompt] = useState('');
  const { language } = useSettings();

  useEffect(() => {
    if (initialAuthError) {
        setAuthError(initialAuthError);
    }
  }, [initialAuthError]);

  useEffect(() => {
    if (!initialAuthError) {
        setPrompt("Enter your username or email, then your password.");
    }
    setMode(AuthMode.LOGIN); 
  }, [initialAuthError, language]);

  const resetSignupState = () => {
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setAuthError('');
  };

  const handleManualLogin = async () => {
       setIsLoading(true);
       setAuthError('');
       try {
         await firebaseService.signInWithEmail(identifier, password);
       } catch (error: any) {
           console.error("Auth error:", error);
           const errorMessage = error.message || "An unexpected error occurred.";
           setAuthError(errorMessage);
           setIdentifier('');
           setPassword('');
       } finally {
          setIsLoading(false);
       }
  };
  
  const handleManualSignup = async () => {
       setIsLoading(true);
       setAuthError('');
       try {
         const isTaken = await firebaseService.isUsernameTaken(username);
         if(isTaken) {
             setAuthError("That username is already taken. Please choose another one.");
             setIsLoading(false);
             return;
         }
         if (password.length < 6) {
             setAuthError("Password must be at least 6 characters long.");
             setIsLoading(false);
             return;
         }
         const success = await firebaseService.signUpWithEmail(email, password, fullName, username);
         if (!success) {
             setAuthError("Could not create account. The email might be in use.");
             resetSignupState();
             setMode(AuthMode.LOGIN);
         }
       } catch (error: any) {
          console.error("Auth error:", error);
          setAuthError(error.message || "An unexpected error occurred.");
       } finally {
           setIsLoading(false);
       }
  };
  
  const renderSignupForm = () => {
      return (
         <div className="w-full max-w-sm text-left">
            <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>
             <div className="space-y-4">
                 <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="w-full bg-slate-700/50 border-slate-600 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500" />
                 <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="w-full bg-slate-700/50 border-slate-600 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500" />
                 <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full bg-slate-700/50 border-slate-600 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500" />
                 <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-700/50 border-slate-600 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500" />
             </div>
             {authError && <p className="text-red-400 mt-4 text-center">{authError}</p>}
             <button onClick={handleManualSignup} disabled={isLoading} className="w-full mt-6 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg">
                {isLoading ? "Creating..." : "Sign Up"}
            </button>
             <p className="text-center text-sm mt-4">
                 Already have an account? <button onClick={() => setMode(AuthMode.LOGIN)} className="font-semibold text-rose-400 hover:underline">Log In</button>
            </p>
         </div>
      )
  }

  const renderLoginForm = () => {
       return (
         <div className="w-full max-w-sm text-left">
            <h2 className="text-2xl font-bold text-center mb-6">Log In</h2>
             <div className="space-y-4">
                 <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Username or Email" className="w-full bg-slate-700/50 border-slate-600 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500" />
                 <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-700/50 border-slate-600 rounded-lg p-3 focus:ring-rose-500 focus:border-rose-500" />
             </div>
             {authError && <p className="text-red-400 mt-4 text-center">{authError}</p>}
             <button onClick={handleManualLogin} disabled={isLoading} className="w-full mt-6 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg">
                {isLoading ? "Logging In..." : "Log In"}
            </button>
             <p className="text-center text-sm mt-4">
                 Don't have an account? <button onClick={() => setMode(AuthMode.SIGNUP_FULLNAME)} className="font-semibold text-rose-400 hover:underline">Sign Up</button>
            </p>
         </div>
      )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-rose-400 p-4 sm:p-8 bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,70,239,0.3),rgba(255,255,255,0))] opacity-20 pointer-events-none"></div>

      <Icon name="logo" className="w-24 h-24 text-rose-400 mb-4 text-shadow-lg" />
      <h1 className="text-5xl font-bold mb-2 text-shadow-lg">VoiceBook</h1>
      <p className="text-rose-400/80 mb-8 animate-pulse">The Social Experience</p>
      
      {mode === AuthMode.LOGIN ? renderLoginForm() : renderSignupForm()}
    </div>
  );
};

export default AuthScreen;