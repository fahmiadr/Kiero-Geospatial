import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { askGeoAi, sendGeoAiFeedback } from '../utils/aiService';
import useGeoAiStore from '../stores/useGeoAiStore';

/**
 * Custom hook to manage Geo AI chat state and interactions using TanStack Query & Zustand.
 * Provides robust persistence, history management, and cross-tab synchronization.
 * 
 * @returns {object} Hook state and handlers
 */
export const useGeoAi = ({ onResponse } = {}) => {
    // Local state for input (UI state only)
    const [aiInput, setAiInput] = useState('');
    const [pendingSessions, setPendingSessions] = useState({});

    // Access Zustand store
    const {
        sessions,
        currentSessionId,
        addMessage,
        updateMessage,
        createNewSession,
        switchSession,
        deleteSession
    } = useGeoAiStore();

    // Derive current messages
    const currentSession = currentSessionId ? sessions[currentSessionId] : null;
    const aiMessages = currentSession ? currentSession.messages : [];

    // Ensure there is always a session active on mount if none exists (Double safety, though store handles hydration)
    useEffect(() => {
        // This effect can handle edge cases where hydration might leave us without a current session
        if (!currentSessionId && Object.keys(sessions).length === 0) {
            // Let the store logic handle this usually, but we can force it if needed.
            // Relying on store hydration callback for now.
        }
    }, [currentSessionId, sessions]);


    // TanStack Query mutation for robust API interaction
    const mutation = useMutation({
        mutationFn: ({ question, sessionId }) => askGeoAi(question, sessionId),
        onMutate: (variables) => {
            setPendingSessions(prev => ({ ...prev, [variables.sessionId]: true }));
        },
        onSettled: (data, error, variables) => {
            setPendingSessions(prev => ({ ...prev, [variables.sessionId]: false }));
        },
        onSuccess: (data, variables) => {
            // Format response untuk disimpan di state
            const aiResponse = {
                role: 'assistant',
                content: data.answer?.analysis_summary || data.answer || "Berikut hasil analisis data yang ditemukan.",
                tableData: data.answer?.data || [],
                status: data.answer?.status,
                message: data.answer?.message,
                request_id: data.request_id || data.answer?.request_id || null // Simpan request_id untuk feedback
            };
            addMessage(aiResponse, variables.sessionId);

            // Trigger callback if provided (e.g. for map auto-selection)
            if (onResponse) {
                onResponse(data);
            }
        },
        onError: (error, variables) => {
            console.error("Geo AI Error:", error);
            const errorMessage = {
                role: 'assistant',
                content: 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.',
                isError: true
            };
            addMessage(errorMessage, variables.sessionId);
        }
    });

    const handleAiSubmitContinue = useCallback((e) => {
        if (e) e.preventDefault();

        const trimmedInput = aiInput.trim();
        if (!trimmedInput || pendingSessions[currentSessionId]) return;

        // Optimistically add user message to current active Global Store session
        const userMessage = { role: 'user', content: trimmedInput };
        const activeSessionId = addMessage(userMessage, currentSessionId);

        // Clear input immediately
        setAiInput('');

        // Trigger the mutation
        mutation.mutate({ question: userMessage.content, sessionId: activeSessionId });

    }, [aiInput, mutation, addMessage, currentSessionId, pendingSessions]);

    const handleAiSubmitNew = useCallback((e) => {
        if (e) e.preventDefault();

        const trimmedInput = aiInput.trim();
        if (!trimmedInput) return; // New Session is naturally not pending

        // Memaksa membuat sesi background baru khusus dari tab history
        const newSessionId = uuidv4();
        const userMessage = { role: 'user', content: trimmedInput };
        const activeSessionId = addMessage(userMessage, newSessionId);

        // Clear input immediately
        setAiInput('');

        // Trigger the mutation
        mutation.mutate({ question: userMessage.content, sessionId: activeSessionId });

    }, [aiInput, mutation, addMessage]);

    // TanStack Query mutation for Feedback
    const feedbackMutation = useMutation({
        mutationFn: ({ rating, comment, requestId }) => sendGeoAiFeedback(rating, comment, requestId),
        onError: (error) => {
            console.error("Gagal mengirim feedback:", error);
        }
    });

    const handleFeedback = useCallback((messageId, requestId, rating, comment) => {
        if (!currentSessionId || !messageId || !requestId) return;

        // Optimistically update store
        updateMessage(currentSessionId, messageId, {
            feedback: { rating, comment },
            hasFeedback: true
        });

        // Send to API
        feedbackMutation.mutate({ rating, comment, requestId });
    }, [currentSessionId, updateMessage, feedbackMutation]);

    return {
        // Chat State
        aiInput,
        setAiInput,
        aiMessages,
        isAiLoading: currentSessionId ? !!pendingSessions[currentSessionId] : false, // Spesifik hanya memblokir session yang statusnya pending
        aiError: mutation.error,

        // Actions
        handleAiSubmitContinue,
        handleAiSubmitNew,
        resetAi: mutation.reset,
        handleFeedback,

        // Session / History Management
        currentSessionId,
        sessions: Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt), // Return as array sorted by recent
        createNewSession,
        switchSession,
        deleteSession
    };
};
