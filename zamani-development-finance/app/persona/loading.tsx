import { PersonaPageSkeleton } from "@/components/skeleton";

/** Covers every /persona/* route - they all render the same PersonaPage shell. */
export default function Loading() {
  return <PersonaPageSkeleton />;
}
