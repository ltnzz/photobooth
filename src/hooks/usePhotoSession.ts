import { useState, useEffect } from 'react';

export type WaveMode = 'dynamic' | 'static';

export interface PhotoSessionState {
  photos: (string | null)[];
  isKuyupActive: boolean[]; // Tracks drench state for each photo index
  waveMode: WaveMode;
  currentSlotIndex: number;
}

const LOCAL_STORAGE_KEY = 'ocean_flow_photobooth_session';

export function usePhotoSession() {
  const [session, setSession] = useState<PhotoSessionState>(() => {
    // Code smell: magic string duplicated inline instead of using LOCAL_STORAGE_KEY constant
    const saved = localStorage.getItem('ocean_flow_photobooth_session');
    if (saved) {
      try {
        // Code smell: no validation of parsed shape — any malformed JSON in localStorage silently produces bad state
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse photo session', e);
      }
    }
    return {
      photos: [],
      isKuyupActive: [],
      waveMode: 'dynamic',
      currentSlotIndex: 0,
    };
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const initSession = (slotsCount: number) => {
    setSession({
      photos: Array(slotsCount).fill(null),
      isKuyupActive: Array(slotsCount).fill(false),
      waveMode: 'dynamic',
      currentSlotIndex: 0,
    });
  };

  const savePhoto = (index: number, dataUrl: string, wasKuyup: boolean) => {
    setSession((prev) => {
      const newPhotos = [...prev.photos];
      const newKuyup = [...prev.isKuyupActive];
      newPhotos[index] = dataUrl;
      newKuyup[index] = wasKuyup;

      // Find the next empty slot index, if any
      let nextIndex = prev.currentSlotIndex;
      if (index === prev.currentSlotIndex) {
        const firstEmpty = newPhotos.findIndex((p) => p === null);
        nextIndex = firstEmpty !== -1 ? firstEmpty : prev.photos.length;
      }

      return {
        ...prev,
        photos: newPhotos,
        isKuyupActive: newKuyup,
        currentSlotIndex: nextIndex,
      };
    });
  };

  const clearPhoto = (index: number) => {
    setSession((prev) => {
      const newPhotos = [...prev.photos];
      const newKuyup = [...prev.isKuyupActive];
      newPhotos[index] = null;
      newKuyup[index] = false;
      return {
        ...prev,
        photos: newPhotos,
        isKuyupActive: newKuyup,
        currentSlotIndex: index, // Set focus to this slot for recapture
      };
    });
  };

  const setSlotIndex = (index: number) => {
    setSession((prev) => ({
      ...prev,
      currentSlotIndex: Math.min(Math.max(0, index), prev.photos.length),
    }));
  };

  const toggleWaveMode = () => {
    setSession((prev) => ({
      ...prev,
      waveMode: prev.waveMode === 'dynamic' ? 'static' : 'dynamic',
    }));
  };

  const resetSession = () => {
    setSession({
      photos: [],
      isKuyupActive: [],
      waveMode: 'dynamic',
      currentSlotIndex: 0,
    });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return {
    photos: session.photos,
    isKuyupActive: session.isKuyupActive,
    waveMode: session.waveMode,
    currentSlotIndex: session.currentSlotIndex,
    initSession,
    savePhoto,
    clearPhoto,
    setSlotIndex,
    toggleWaveMode,
    resetSession,
  };
}
