"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { PERSONAS, personaByKey, type Persona, type PersonaKey } from "@/lib/personas";

type ViewerContextValue = {
  persona: Persona;
  personas: Persona[];
  setPersonaKey: (key: PersonaKey) => void;
};

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<PersonaKey>("md");

  const value = useMemo<ViewerContextValue>(
    () => ({ persona: personaByKey(key), personas: PERSONAS, setPersonaKey: setKey }),
    [key]
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within a ViewerProvider");
  return ctx;
}
