export const translations = {
  en: {
    welcomeTitle: "Ocean Flow",
    welcomeSubtitle: "Experience a premium interactive photo session with custom layouts.",
    startBtn: "START",
    
    selectFrameTitle: "CHOOSE FRAME",
    selectFrameSubtitle: "Select a layout frame to begin your photo strip session.",
    stripVertical: "4-Slot Vertical Strip",
    grid2x2: "4-Slot 2x2 Grid Collage",
    singleClassic: "Classic Single Frame",
    nextBtn: "Continue",
    backBtn: "Go Back",

    // Next steps placeholders
    nextStepTitle: "Photo Session Initialized",
    nextStepPlaceholder: "State initialized. Total photo slots: {slots}. Ready for PR #2 & PR #3.",
    newSessionBtn: "Start New Session"
  },
  id: {
    welcomeTitle: "Ocean Flow",
    welcomeSubtitle: "Nikmati sesi foto interaktif premium dengan tata letak pilihan Anda.",
    startBtn: "MULAI",
    
    selectFrameTitle: "PILIH FRAME",
    selectFrameSubtitle: "Pilih tata letak frame untuk memulai sesi foto strip Anda.",
    stripVertical: "Strip Vertikal 4-Slot",
    grid2x2: "Kolase Grid 2x2 4-Slot",
    singleClassic: "Frame Klasik Tunggal",
    nextBtn: "LANJUT",
    backBtn: "KEMBALI",

    // Next steps placeholders
    nextStepTitle: "Sesi Foto Diinisialisasi",
    nextStepPlaceholder: "State telah diinisialisasi. Jumlah slot foto: {slots}. Siap untuk PR #2 & PR #3.",
    newSessionBtn: "Mulai Sesi Baru"
  }
} as const;

export type TranslationKeys = keyof typeof translations.en;
export type Language = keyof typeof translations;
