import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

type AILanguage = 'ar' | 'en';

export interface AISettings {
	enabled: boolean;
	language: AILanguage;
	maxRequestsPerMinute: number;
	safetyLevel: 'standard' | 'strict';
	streaming: boolean;
	voiceFeedback: boolean;
}

interface AIContextType {
	settings: AISettings;
	setEnabled: (enabled: boolean) => void;
	updateSettings: (partial: Partial<AISettings>) => void;
	canSendNow: () => boolean;
	notifySent: () => void;
}

const DEFAULT_SETTINGS: AISettings = {
	enabled: true,
	language: 'ar',
	maxRequestsPerMinute: 20,
	safetyLevel: 'standard',
	streaming: true,
	voiceFeedback: false
};

const CTX = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { user } = useAuth();
	const storageKey = useMemo(() => {
		const tenant = (user as any)?.tenantId || 'global';
		return `adora_ai_settings_${tenant}`;
	}, [user]);

	const [settings, setSettings] = useState<AISettings>(() => {
		try {
			const raw = localStorage.getItem(storageKey);
			return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
		} catch {
			return DEFAULT_SETTINGS;
		}
	});

	// Simple token bucket for rate limit
	const [windowStart, setWindowStart] = useState<number>(Date.now());
	const [count, setCount] = useState<number>(0);

	useEffect(() => {
		try {
			localStorage.setItem(storageKey, JSON.stringify(settings));
		} catch {
			// ignore
		}
	}, [settings, storageKey]);

	const setEnabled = (enabled: boolean) => setSettings(prev => ({ ...prev, enabled }));
	const updateSettings = (partial: Partial<AISettings>) => setSettings(prev => ({ ...prev, ...partial }));

	const canSendNow = () => {
		const now = Date.now();
		if (now - windowStart >= 60_000) {
			setWindowStart(now);
			setCount(0);
			return true;
		}
		return count < settings.maxRequestsPerMinute;
	};

	const notifySent = () => {
		const now = Date.now();
		if (now - windowStart >= 60_000) {
			setWindowStart(now);
			setCount(1);
		} else {
			setCount(c => c + 1);
		}
	};

	const value: AIContextType = {
		settings,
		setEnabled,
		updateSettings,
		canSendNow,
		notifySent
	};

	return <CTX.Provider value={value}>{children}</CTX.Provider>;
};

export const useAI = (): AIContextType => {
	const ctx = useContext(CTX);
	if (!ctx) throw new Error('useAI must be used within AIProvider');
	return ctx;
};

