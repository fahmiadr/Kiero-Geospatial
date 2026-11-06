import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * Zustand store for Geo AI Chat data persistence.
 * Features:
 * - Multi-session management (Chat History)
 * - Auto-cleanup of data older than 7 days
 * - LocalStorage persistence
 */
const useGeoAiStore = create(
    persist(
        (set, get) => ({
            sessions: {}, // Map of sessionId -> session object
            currentSessionId: null,

            // --- Actions ---

            /**
             * Initialize a new chat session state.
             * Does NOT create a persistence entry yet. Just clears the current context.
             */
            createNewSession: () => {
                set({ currentSessionId: null });
            },

            /**
             * Switch current active chat session.
             */
            switchSession: (sessionId) => {
                const { sessions } = get();
                if (sessions[sessionId]) {
                    // Mark as read when switching to this session
                    const newSessions = { ...sessions };
                    newSessions[sessionId] = { ...newSessions[sessionId], hasUnread: false };
                    
                    set({ 
                        currentSessionId: sessionId,
                        sessions: newSessions
                    });
                }
            },

            /**
             * Add a message to a session.
             * Supports isolated sessions via targetSessionId.
             */
            addMessage: (message, targetSessionId = null) => {
                let { currentSessionId, sessions } = get();
                const actualSessionId = targetSessionId || currentSessionId;

                // Lazy Creation: If session doesn't exist, create one.
                if (!actualSessionId || !sessions[actualSessionId]) {
                    const newId = actualSessionId || uuidv4();
                    const newSession = {
                        id: newId,
                        title: 'New Chat',
                        messages: [],
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        hasUnread: false
                    };

                    sessions = { ...sessions, [newId]: newSession };
                    
                    // Update state immediately. Wait if there's no active session, make it active
                    set({
                        sessions,
                        currentSessionId: currentSessionId ? currentSessionId : newId
                    });
                }

                currentSessionId = get().currentSessionId; // Re-fetch in case it just generated
                const workingSessionId = targetSessionId || currentSessionId;
                const session = sessions[workingSessionId];
                const msgWithId = { id: uuidv4(), ...message };
                const newMessages = [...session.messages, msgWithId];

                // Auto-title logic
                let newTitle = session.title;
                if (session.title === 'New Chat' && message.role === 'user') {
                    newTitle = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
                }

                // Check Unread Status
                // If it's an assistant response AND we are NOT currently viewing this session, mark unread!
                let isUnread = session.hasUnread || false;
                if (message.role === 'assistant' && workingSessionId !== currentSessionId) {
                    isUnread = true;
                }

                set((state) => ({
                    sessions: {
                        ...state.sessions,
                        [workingSessionId]: {
                            ...session,
                            messages: newMessages,
                            title: newTitle,
                            updatedAt: Date.now(),
                            hasUnread: isUnread
                        },
                    },
                }));

                return workingSessionId;
            },

            /**
             * Update a specific message in a session.
             */
            updateMessage: (sessionId, messageId, updates) => {
                set((state) => {
                    const session = state.sessions[sessionId];
                    if (!session) return state;

                    const newMessages = session.messages.map((msg) =>
                        msg.id === messageId ? { ...msg, ...updates } : msg
                    );

                    return {
                        ...state,
                        sessions: {
                            ...state.sessions,
                            [sessionId]: {
                                ...session,
                                messages: newMessages,
                                updatedAt: Date.now(),
                            },
                        },
                    };
                });
            },

            /**
             * Delete a specific session.
             * If deleting current session, switches to the most recent one or creates a new one.
             */
            deleteSession: (sessionId) => {
                set((state) => {
                    const newSessions = { ...state.sessions };
                    delete newSessions[sessionId];

                    // Determine new current ID if we deleted the active one
                    let newCurrentId = state.currentSessionId;
                    if (state.currentSessionId === sessionId) {
                        const remainingSessions = Object.values(newSessions).sort((a, b) => b.updatedAt - a.updatedAt);
                        newCurrentId = remainingSessions.length > 0 ? remainingSessions[0].id : null;
                    }

                    return {
                        sessions: newSessions,
                        currentSessionId: newCurrentId,
                    };
                });
            },

            /**
             * Clear all history (manual action)
             */
            clearAllSessions: () => {
                set({ sessions: {}, currentSessionId: null });
            },

            /**
             * Prune sessions older than 7 days.
             * Should be called on initialization.
             */
            pruneOldSessions: () => {
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                const now = Date.now();

                set((state) => {
                    const newSessions = {};
                    let hasChanges = false;

                    Object.values(state.sessions).forEach((session) => {
                        if (now - session.updatedAt < sevenDaysMs) {
                            newSessions[session.id] = session;
                        } else {
                            hasChanges = true;
                        }
                    });

                    if (!hasChanges) return {}; // No state update needed

                    // If current session was pruned, reset it
                    let newCurrentId = state.currentSessionId;
                    if (newCurrentId && !newSessions[newCurrentId]) {
                        newCurrentId = null;
                    }

                    return {
                        sessions: newSessions,
                        currentSessionId: newCurrentId,
                    };
                });
            },
        }),
        {
            name: 'geo-ai-storage', // key in localStorage
            storage: createJSONStorage(() => localStorage),
            version: 1,
            onRehydrateStorage: () => (state) => {
                // Run prune logic immediately after hydration
                if (state) {
                    state.pruneOldSessions();

                    // Note: We no longer auto-create a session if empty.
                    // We just let currentSessionId be null, waiting for user input.
                }
            },
        }
    )
);

export default useGeoAiStore;
