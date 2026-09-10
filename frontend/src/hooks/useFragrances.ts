import useSWR from "swr";
import { ApiResponse, Fragrance } from "@/types/fragrance";

// In production, Flask serves /api/* from the same origin.
// In dev with NEXT_PUBLIC_API_URL set, proxy to the Flask backend.
const API_BASE =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api`
    : "/api";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface UseFragrancesOptions {
  search?: string;
  limit?: number;
  page?: number;
  gender?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function useFragrances(opts: UseFragrancesOptions = {}) {
  const { search = "", limit = 12, page = 1, gender = "", sortBy = "popularity", sortOrder = "desc" } = opts;
  const params = new URLSearchParams({ limit: String(limit), page: String(page) });
  if (search) params.set("search", search);
  if (gender) params.set("gender", gender);
  if (sortBy) params.set("sort_by", sortBy);
  if (sortOrder) params.set("sort_order", sortOrder);

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Fragrance[]>>(
    `${API_BASE}/fragrances?${params}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  return {
    fragrances: Array.isArray(data?.data) ? data.data : [],
    isMock: data?.mock ?? false,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function useFragrance(id: string | null) {
  const { data, error, isLoading } = useSWR<ApiResponse<Fragrance>>(
    id ? `${API_BASE}/fragrances/${id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    fragrance: data?.data ?? null,
    isLoading,
    isError: !!error,
  };
}

export function useAccords(search = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const { data } = useSWR<ApiResponse<{ name: string }[]>>(
    `${API_BASE}/accords?${params}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  return data?.data ?? [];
}

export function useNotes(search = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const { data } = useSWR<ApiResponse<{ name: string }[]>>(
    `${API_BASE}/notes?${params}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  return data?.data ?? [];
}
