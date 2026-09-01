import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Deniz verisi saatlik güncelleniyor; 15 dk taze say, 2 gün sakla (çevrimdışı).
      staleTime: 15 * 60 * 1000,
      gcTime: 2 * 24 * 60 * 60 * 1000,
      retry: 2,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "alarga.query-cache.v1",
});

export const MAX_CACHE_AGE = 2 * 24 * 60 * 60 * 1000;
