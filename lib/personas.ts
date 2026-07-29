export type PersonaKey = "md" | "it" | "procurement" | "strategy";

export type Persona = {
  key: PersonaKey;
  name: string;
  firstName: string;
  title: string;
  initials: string;
};

export const PERSONAS: Persona[] = [
  { key: "md", name: "Michael Kanu", firstName: "Michael", title: "Managing Director / CEO", initials: "MK" },
  { key: "it", name: "Adaeze Okafor", firstName: "Adaeze", title: "Head, Information Technology", initials: "AO" },
  { key: "procurement", name: "Ibrahim Bello", firstName: "Ibrahim", title: "Head, Procurement", initials: "IB" },
  { key: "strategy", name: "Funmi Adeyemi", firstName: "Funmi", title: "Head, Innovation & Strategy", initials: "FA" },
];

export function personaByKey(key: PersonaKey): Persona {
  return PERSONAS.find((p) => p.key === key) ?? PERSONAS[0];
}

export function timeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const PERSONA_SUBTEXT: Record<PersonaKey, string> = {
  md: "Here's what needs a decision across CREDICORP today.",
  it: "Service levels and support ticket load across Credo.",
  procurement: "Vendor registration status across the Procurement Portal.",
  strategy: "Where volume and risk are concentrated across every connected platform.",
};
