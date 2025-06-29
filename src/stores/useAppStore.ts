import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppConfig, OnboardingState, OnboardingStep } from '../types';
import { safeInvoke, isTauriApp, mockData } from '../utils/tauri';

interface AppState {
  // Config
  config: AppConfig | null;
  
  // Onboarding
  onboardingState: OnboardingState;
  isOnboardingComplete: boolean;
  
  // App state
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Theme
  theme: 'light' | 'dark' | 'auto';
  
  // Actions
  initializeApp: () => Promise<void>;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
  setOnboardingStep: (step: OnboardingStep) => void;
  setOnboardingComplete: (complete: boolean) => void;
  updateOnboardingState: (updates: Partial<OnboardingState>) => void;
  resetOnboarding: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      config: null,
      onboardingState: {
        currentStep: 'welcome',
        selectedFolders: [],
        isComplete: false,
      },
      isOnboardingComplete: false,
      isInitialized: false,
      isLoading: false,
      error: null,
      theme: 'auto',

      // Actions
      initializeApp: async () => {
        try {
          set({ isLoading: true, error: null });
          
          let config: AppConfig;
          
          if (isTauriApp()) {
            // Load config from Tauri backend
            const backendConfig = await safeInvoke<AppConfig>('get_config');
            config = backendConfig || (mockData.appConfig as AppConfig);
          } else {
            // Use mock config for web development
            console.log('Running in web mode - using mock config');
            config = mockData.appConfig as AppConfig;
          }
          
          set({ 
            config,
            isInitialized: true,
            isLoading: false 
          });
        } catch (error) {
          console.error('Failed to initialize app:', error);
          // Fallback to mock data if backend fails
          set({ 
            config: mockData.appConfig as AppConfig,
            isInitialized: true,
            isLoading: false,
            error: null // Don't show error in development mode
          });
        }
      },

      updateConfig: async (updates: Partial<AppConfig>) => {
        try {
          set({ isLoading: true, error: null });
          
          if (isTauriApp()) {
            await safeInvoke('update_config', { configUpdate: updates });
          } else {
            console.log('Config update in web mode:', updates);
          }
          
          const currentConfig = get().config;
          if (currentConfig) {
            set({ 
              config: { ...currentConfig, ...updates },
              isLoading: false 
            });
          }
        } catch (error) {
          console.error('Failed to update config:', error);
          // In development mode, just update the local state
          const currentConfig = get().config;
          if (currentConfig) {
            set({ 
              config: { ...currentConfig, ...updates },
              isLoading: false,
              error: null
            });
          }
        }
      },

      setOnboardingStep: (step: OnboardingStep) => {
        set(state => ({
          onboardingState: {
            ...state.onboardingState,
            currentStep: step
          }
        }));
      },

      setOnboardingComplete: (complete: boolean) => {
        set({ isOnboardingComplete: complete });
        if (complete) {
          set(state => ({
            onboardingState: {
              ...state.onboardingState,
              isComplete: true
            }
          }));
        }
      },

      updateOnboardingState: (updates: Partial<OnboardingState>) => {
        set(state => ({
          onboardingState: {
            ...state.onboardingState,
            ...updates
          }
        }));
      },

      resetOnboarding: () => {
        set({
          onboardingState: {
            currentStep: 'welcome',
            selectedFolders: [],
            isComplete: false,
          },
          isOnboardingComplete: false,
        });
      },

      setTheme: (theme: 'light' | 'dark' | 'auto') => {
        set({ theme });
        
        // Theme application is now handled by the useTheme hook
        // This ensures proper system theme detection and persistence
      },

      setError: (error: string | null) => {
        set({ error });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        onboardingState: state.onboardingState,
        isOnboardingComplete: state.isOnboardingComplete,
        theme: state.theme,
      }),
    }
  )
);