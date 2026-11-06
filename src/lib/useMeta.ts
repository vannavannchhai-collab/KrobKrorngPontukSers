import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Meta, Term } from "./types";

export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: () => api<Meta>("/meta"),
    staleTime: 60_000,
  });
}

export function termLabel(term: Term | undefined | null, years?: { id: number; name: string }[]) {
  if (!term) return "—";
  const yearName = term.year_name ?? years?.find((y) => y.id === term.academic_year_id)?.name;
  return yearName ? `${term.name} · ${yearName}` : term.name;
}

export function currentTerm(terms: Term[] | undefined): Term | undefined {
  if (!terms?.length) return undefined;
  return terms.find((t) => t.is_current === 1) ?? terms[0];
}
