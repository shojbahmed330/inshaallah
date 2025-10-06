import React from 'react';
import Icon from './Icon';

interface HelpScreenProps {
  onGoBack: () => void;
}

const CommandCategory: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        <h2 className="text-2xl font-bold text-fuchsia-300 mb-4 border-b-2 border-fuchsia-500/30 pb-2">{title}</h2>
        <div className="space-y-3">{children}</div>
    </div>
);

const CommandItem: React.FC<{ command: string, description: string }> = ({ command, description }) => (
    <div className="bg-slate-800/60 p-4 rounded-lg">
        <p className="font-mono text-lg text-white">" {command} "</p>
        <p className="text-slate-400 mt-1 text-sm">{description}</p>
    </div>
);

const HelpScreen: React.FC<HelpScreenProps> = ({ onGoBack }) => {
    return (
        <div className="h-full w-full overflow-y-auto text-white p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                     <button onClick={onGoBack} className="p-2 -ml-2 rounded-full text-fuchsia-400 hover:bg-slate-800 md:hidden">
                        <Icon name="back" className="w-6 h-6" />
                    </button>
                    <h1 className="text-4xl font-bold">Command List</h1>
                </div>
                
                <p className="text-slate-300 mb-8 text-lg">
                    Here are some example commands you can use. You can speak in English, Bengali, or a mix (Banglish). The AI is flexible!
                </p>

                <CommandCategory title="Navigation">
                    <CommandItem command="Go to my feed / হোম পেজে যাও" description="Navigates to the main feed screen." />
                    <CommandItem command="Open explore / এক্সপ্লোর" description="Goes to the explore page to discover new content." />
                    <CommandItem command="Show my profile / আমার প্রোফাইল" description="Opens your personal profile page." />
                    <CommandItem command="Open [Friend's Name]'s profile" description="Example: 'Open Shojib Khan's profile'." />
                    <CommandItem command="Go back / ফিরে যাও" description="Navigates to the previous screen." />
                    <CommandItem command="Open messages / মেসেজ দেখাও" description="Goes to your conversations screen." />
                </CommandCategory>
                
                <CommandCategory title="Interactions">
                    <CommandItem command="Like this post / লাইক দাও" description="Likes the current post on screen." />
                    <CommandItem command="Comment on this post" description="Opens the comment section for the current post." />
                    <CommandItem command="Share this post / শেয়ার কর" description="Opens the sharing options for the current post." />
                    <CommandItem command="Play post / প্লে কর" description="Plays the audio or video of the current post." />
                    <CommandItem command="Next post / পরের পোস্টে যাও" description="Scrolls to and focuses on the next post in the feed." />
                    <CommandItem command="Previous post / আগের পোস্টে যাও" description="Scrolls to the previous post." />
                </CommandCategory>

                <CommandCategory title="Creating Content">
                    <CommandItem command="Create a new post / নতুন পোস্ট" description="Opens the screen to create a new post." />
                    <CommandItem command="Start a voice post / ভয়েস পোস্ট" description="Starts recording a new voice post immediately." />
                    <CommandItem command="Stop recording / রেকর্ডিং বন্ধ কর" description="Stops an ongoing voice recording." />
                    <CommandItem command="Post it / পোস্ট কর" description="Confirms and publishes your created post or comment." />
                </CommandCategory>

                 <CommandCategory title="Friends & Social">
                    <CommandItem command="Show my friends / আমার বন্ধুদের দেখাও" description="Navigates to your friends list." />
                    <CommandItem command="Show friend requests" description="Goes to the friend requests tab." />
                    <CommandItem command="Add [Name] as friend" description="Sends a friend request to the specified user." />
                    <CommandItem command="Accept [Name]'s request" description="Accepts a pending friend request from a user." />
                </CommandCategory>

            </div>
        </div>
    );
};

export default HelpScreen;
