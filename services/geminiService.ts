// @ts-nocheck
import { GoogleGenAI, Type } from "@google/genai";
import { User, Post, Campaign, FriendshipStatus, Comment, Group } from '../types';
import { firebaseService } from './firebaseService';


// --- Gemini API Initialization ---
const apiKey = process.env.API_KEY;
if (!apiKey) {
    alert("CRITICAL ERROR: Gemini API key is not configured. Please ensure your environment variables are set up correctly.");
    throw new Error("API_KEY not configured. Please set it in your environment.");
}
const ai = new GoogleGenAI({ apiKey });

export const geminiService = {
  // --- Intent Processing ---
  async processIntent(command: string, context?: any): Promise<{ intent: string; slots?: any }> {
    const systemInstruction = `You are an intent recognition system for a social media app called VoiceBook. Your task is to understand user commands in any language (especially English and Bengali) and extract relevant information.
    
    Available Intents:
    - Navigation: intent_open_feed, intent_open_friends_page, intent_open_messages, intent_open_settings, intent_go_back, intent_open_profile, intent_open_explore, intent_open_reels, intent_open_rooms, intent_open_groups, intent_open_ads_center, intent_open_menu.
    - Scrolling & Feed Navigation: intent_scroll_down, intent_scroll_up, intent_stop_scroll, intent_next_post, intent_previous_post.
    - Post Interaction: intent_like, intent_share, intent_comment, intent_play_post, intent_pause_post, intent_save_post, intent_copy_link, intent_hide_post, intent_report_post.
    - Post Creation: intent_create_post, intent_create_voice_post, intent_start_recording, intent_stop_recording, intent_re_record, intent_post_confirm, intent_clear_image, intent_create_poll.
    - Friends: intent_accept_request, intent_decline_request, intent_add_friend, intent_unfriend_user, intent_cancel_friend_request.
    - Comments: intent_play_comment_by_author.
    - Rooms/Groups: intent_create_group, intent_manage_group, intent_open_group_invite_page, intent_open_group_chat, intent_open_group_events.
    - Stories: intent_add_music, intent_post_story.
    - Ads: intent_create_campaign, intent_view_campaign_dashboard, intent_launch_campaign.
    - General: intent_reload_page, intent_unknown.
    
    Intents with slots:
    - intent_open_profile: { "target_name": "my" | "<user name>" } (Bengali: "আমার প্রোফাইল", "এক্স ব্যবহারকারীর প্রোফাইল")
    - intent_search_user: { "target_name": "<user name>" } (Bengali: "খোঁজো [নাম]")
    - intent_generate_image: { "prompt": "<image description>" } (Bengali: "একটা ছবি আঁকো [বিবরণ]")
    - intent_add_text_to_story: { "text": "<story text>" } (Bengali: "স্টোরিতে লেখো [টেক্সট]")
    - intent_set_story_privacy: { "privacy_level": "public" | "friends" } (Bengali: "প্রাইভেসি পাবলিক করো")
    - intent_view_group_by_name: { "group_name": "<group name>" } (Bengali: "[গ্রুপের নাম] গ্রুপটা দেখাও")
    - intent_filter_groups_by_category: { "category_name": "<category>" } (Bengali: "[ক্যাটাগরি] গ্রুপের তালিকা দেখাও")
    - intent_search_group: { "search_query": "<query>" } (Bengali: "[বিষয়] নিয়ে গ্রুপ খোঁজো")
    - intent_set_sponsor_name, intent_set_campaign_caption, intent_set_campaign_budget, intent_set_media_type.

    Context for the current screen may be provided. Use it to resolve ambiguity. Context: ${JSON.stringify(context || {})}
    
    The user command can be in English, Bengali, or a mix (Banglish). Interpret it correctly.
    Respond with a single JSON object: {"intent": "intent_name", "slots": {"key": "value"}}. Do not add any other text.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Command: "${command}"`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
            },
        });
        
        const jsonString = response.text.trim();
        const cleanedJsonString = jsonString.replace(/^```json\s*|```$/g, '');
        const result = JSON.parse(cleanedJsonString);
        return result;

    } catch (error) {
        console.error("Error processing intent with Gemini:", error);
        try {
            const match = error.toString().match(/\{.*\}/s);
            if (match) {
                return JSON.parse(match[0]);
            }
        } catch(e) { /* ignore parse error */ }
        return { intent: 'intent_unknown' };
    }
  },
  
  // --- This service now acts as a facade, calling firebaseService for data operations ---
  // --- This keeps the UI components clean and separates concerns. ---

  getFriendRequests: (userId) => firebaseService.getFriendRequests(userId),
  acceptFriendRequest: (currentUserId, requestingUserId) => firebaseService.acceptFriendRequest(currentUserId, requestingUserId),
  declineFriendRequest: (currentUserId, requestingUserId) => firebaseService.declineFriendRequest(currentUserId, requestingUserId),
  addFriend: (currentUserId, targetUserId) => firebaseService.addFriend(currentUserId, targetUserId),
  unfriendUser: (currentUserId, targetUserId) => firebaseService.unfriendUser(currentUserId, targetUserId),
  cancelFriendRequest: (currentUserId, targetUserId) => firebaseService.cancelFriendRequest(currentUserId, targetUserId),
  getRecommendedFriends: (userId) => firebaseService.getRecommendedFriends(userId),
  getCommonFriends: (userId1, userId2) => firebaseService.getCommonFriends(userId1, userId2),
  
  getUserById: (userId) => firebaseService.getUserProfileById(userId),
  searchUsers: (query) => firebaseService.searchUsers(query),
  updateProfile: (userId, updates) => firebaseService.updateProfile(userId, updates),
  updateProfilePicture: (userId, base64, caption, style) => firebaseService.updateProfilePicture(userId, base64, caption, style),
  updateCoverPhoto: (userId, base64, caption, style) => firebaseService.updateCoverPhoto(userId, base64, caption, style),
  blockUser: (currentUserId, targetUserId) => firebaseService.blockUser(currentUserId, targetUserId),
  unblockUser: (currentUserId, targetUserId) => firebaseService.unblockUser(currentUserId, targetUserId),
  changePassword: (userId, currentPass, newPass) => firebaseService.changePassword(userId, currentPass, newPass),
  deactivateAccount: (userId) => firebaseService.deactivateAccount(userId),
  
  updateVoiceCoins: (userId, amount) => firebaseService.updateVoiceCoins(userId, amount),
  
  savePost: (userId, postId) => firebaseService.savePost(userId, postId),
  unsavePost: (userId, postId) => firebaseService.unsavePost(userId, postId),
  getPostsByIds: (postIds) => firebaseService.getPostsByIds(postIds),

  async generateImageForPost(prompt: string): Promise<string | null> {
      try {
          const hash = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const imageUrl = `https://picsum.photos/seed/${hash}/1024`;
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
          });
      } catch (error) {
          console.error("Failed to generate placeholder image:", error);
          return null;
      }
  },

  // Groups
  getGroupById: (groupId) => firebaseService.getGroupById(groupId),
  getSuggestedGroups: (userId) => firebaseService.getSuggestedGroups(userId),
  createGroup: (creator, name, description, coverUrl, privacy, requiresApproval, category) => firebaseService.createGroup(creator, name, description, coverUrl, privacy, requiresApproval, category),
  updateGroupSettings: (groupId, settings) => firebaseService.updateGroupSettings(groupId, settings),

  // Stories
  getStories: (currentUserId) => firebaseService.getStories(currentUserId),

  // Reports
  createReport: (reporter, content, contentType, reason) => firebaseService.createReport(reporter, content, contentType, reason),
  
  // Admin
  getPendingCampaigns: () => firebaseService.getPendingCampaigns(),
  approveCampaign: (campaignId) => firebaseService.approveCampaign(campaignId),
  rejectCampaign: (campaignId, reason) => firebaseService.rejectCampaign(campaignId, reason),
  getAllUsersForAdmin: () => firebaseService.getAllUsersForAdmin(),
  banUser: (userId) => firebaseService.banUser(userId),
  unbanUser: (userId) => firebaseService.unbanUser(userId),
  suspendUserCommenting: (userId, days) => firebaseService.suspendUserCommenting(userId, days),
  liftUserCommentingSuspension: (userId) => firebaseService.liftUserCommentingSuspension(userId),
  suspendUserPosting: (userId, days) => firebaseService.suspendUserPosting(userId, days),
  liftUserPostingSuspension: (userId) => firebaseService.liftUserPostingSuspension(userId),
  warnUser: (userId, message) => firebaseService.warnUser(userId, message),
  reactivateUserAsAdmin: (userId) => firebaseService.reactivateUserAsAdmin(userId),
  adminUpdateUserProfilePicture: (userId, base64) => firebaseService.adminUpdateUserProfilePicture(userId, base64),
  
  // Polls & Answers
  voteOnPoll: (userId, postId, optionIndex) => firebaseService.voteOnPoll(userId, postId, optionIndex),
  markBestAnswer: (userId, postId, commentId) => firebaseService.markBestAnswer(userId, postId, commentId),
};
