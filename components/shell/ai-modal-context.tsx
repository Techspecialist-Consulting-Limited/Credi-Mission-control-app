"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AiModalContextValue = {
  isOpen: boolean;
  presetPrompt: string | null;
  open: (presetPrompt?: string) => void;
  close: () => void;
};

const AiModalContext = createContext<AiModalContextValue | null>(null);

export function AiModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [presetPrompt, setPresetPrompt] = useState<string | null>(null);

  return (
    <AiModalContext.Provider
      value={{
        isOpen,
        presetPrompt,
        open: (prompt) => {
          setPresetPrompt(prompt ?? null);
          setIsOpen(true);
        },
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </AiModalContext.Provider>
  );
}

export function useAiModal() {
  const ctx = useContext(AiModalContext);
  if (!ctx) throw new Error("useAiModal must be used within an AiModalProvider");
  return ctx;
}
