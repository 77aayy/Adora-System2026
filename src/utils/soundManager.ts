/**
 * Sound Manager Utility
 * Plays gamification sounds for unlocks, rewards, and achievements.
 */

// Audio asset URLs (using high-quality royalty-free CDN links for immediate use)
const SOUNDS = {
    UNLOCK: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3', // Crisp unlock sound
    SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Success/Milestone chime
    CLICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'   // Subtle click
};

class SoundManager {
    private enabled: boolean = true;

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    private play(url: string, volume: number = 0.5) {
        if (!this.enabled) return;
        try {
            const audio = new Audio(url);
            audio.volume = volume;
            audio.play().catch(err => console.warn('Audio play blocked or failed:', err));
        } catch (e) {
            console.error('SoundManager error:', e);
        }
    }

    playUnlock() {
        this.play(SOUNDS.UNLOCK, 0.6);
    }

    playSuccess() {
        this.play(SOUNDS.SUCCESS, 0.7);
    }

    playClick() {
        this.play(SOUNDS.CLICK, 0.3);
    }
}

export const soundManager = new SoundManager();
