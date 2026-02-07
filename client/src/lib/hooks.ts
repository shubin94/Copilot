import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { User, Detective, Service, Review, Order, DetectiveApplication, ProfileClaim, ServiceCategory, InsertDetective, InsertService, InsertReview, InsertOrder, InsertServiceCategory, InsertDetectiveApplication } from "@shared/schema";

export function useAuth() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
    retry: false,
    staleTime: 60 * 1000, // 1 minute instead of 5 to prevent stale session data
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes but refresh more frequently
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.auth.login(email, password),
    onSuccess: async () => {
      // CRITICAL: Invalidate and REFETCH auth to ensure fresh data before redirect
      // This prevents race condition where dashboard loads before auth is known
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
      // Also refetch /api/user since some pages query it separately
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      // Force refetch auth status
      queryClient.refetchQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      api.auth.register(email, password, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useDetectives(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["detectives", "all", limit, offset],
    queryFn: () => api.detectives.getAll(limit, offset),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useDetective(id: string | null | undefined) {
  return useQuery({
    queryKey: ["detectives", id],
    queryFn: () => api.detectives.getById(id!),
    enabled: !!id,
  });
}

export function useCurrentDetective() {
  return useQuery({
    queryKey: ["detectives", "current"],
    queryFn: () => api.detectives.getCurrent(),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useSubscriptionLimits() {
  return useQuery({
    queryKey: ["subscription", "limits"],
    queryFn: () => api.detectives.getSubscriptionLimits(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDetectivesByCountry(country: string | null | undefined) {
  return useQuery({
    queryKey: ["detectives", "country", country],
    queryFn: () => api.detectives.getByCountry(country!),
    enabled: !!country,
  });
}

export function useSearchDetectives(params?: {
  country?: string;
  status?: "active" | "pending" | "suspended" | "inactive";
  plan?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["detectives", "search", params],
    queryFn: () => api.detectives.search(params),
  });
}

export function useCreateDetective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertDetective) => api.detectives.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detectives"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useUpdateDetective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Detective> }) =>
      api.detectives.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["detectives"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useAdminUpdateDetective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Detective> }) =>
      api.detectives.adminUpdate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["detectives"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useAdminDeleteDetective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.detectives.adminDelete(id),
    onSuccess: () => {
      // Invalidate all detective queries to update the UI immediately
      queryClient.invalidateQueries({ queryKey: ["detectives"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      // Force refetch to ensure UI updates immediately
      queryClient.refetchQueries({ queryKey: ["detectives"] });
      // Also invalidate services since detective deletion cascades to their services
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.refetchQueries({ queryKey: ["services"] });
    },
  });
}

export function useServices(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["services", "all", limit, offset],
    queryFn: () => api.services.getAll(limit, offset),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useSearchServices(params?: {
  category?: string;
  country?: string;
  state?: string;
  city?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  minRating?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["services", "search", params],
    queryFn: () => api.services.search(params),
  });
}

export function useService(id: string | null | undefined, preview?: boolean) {
  return useQuery({
    queryKey: ["services", id, preview ? "preview" : "public"],
    queryFn: () => api.services.getById(id!, { preview }),
    enabled: !!id,
  });
}

export function usePublicServiceCount(detectiveId: string | null | undefined) {
  return useQuery({
    queryKey: ["detectives", detectiveId, "public-service-count"],
    queryFn: () => api.detectives.getPublicServiceCount(detectiveId!),
    enabled: !!detectiveId,
  });
}

export function useServicesByDetective(detectiveId: string | null | undefined) {
  return useQuery({
    queryKey: ["services", "detective", detectiveId],
    queryFn: () => api.services.getByDetective(detectiveId!),
    enabled: !!detectiveId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useAdminServicesByDetective(detectiveId: string | null | undefined) {
  return useQuery({
    queryKey: ["services", "detective", detectiveId, "admin"],
    queryFn: () => api.services.adminGetByDetective(detectiveId!),
    enabled: !!detectiveId,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertService) => api.services.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Service> }) =>
      api.services.update(id, data),
    onSuccess: (result: { service: Service }, variables) => {
      // Invalidate all variations of the specific service query
      queryClient.invalidateQueries({ queryKey: ["services", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["services", variables.id, "preview"] });
      queryClient.invalidateQueries({ queryKey: ["services", variables.id, "public"] });
      // Invalidate service lists
      queryClient.invalidateQueries({ queryKey: ["services", "all"] });
      // Invalidate detective's services if detectiveId is known
      if (result?.service?.detectiveId) {
        queryClient.invalidateQueries({ queryKey: ["services", "detective", result.service.detectiveId] });
        queryClient.invalidateQueries({ queryKey: ["services", "detective", result.service.detectiveId, "admin"] });
      }
    },
  });
}

export function useAdminCreateServiceForDetective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ detectiveId, data }: { detectiveId: string; data: Omit<InsertService, "detectiveId"> }) =>
      api.services.adminCreateForDetective(detectiveId, data),
    onSuccess: (result: { service: Service }, variables: { detectiveId: string; data: any }) => {
      queryClient.invalidateQueries({ queryKey: ["services", "detective", variables.detectiveId] });
      queryClient.invalidateQueries({ queryKey: ["services", "detective", variables.detectiveId, "admin"] });
      queryClient.invalidateQueries({ queryKey: ["services", "all"] });
      const key = ["services", "detective", variables.detectiveId, "admin"];
      const existing: any = queryClient.getQueryData(key);
      const next = Array.isArray(existing?.services) ? [result.service, ...existing.services] : [result.service];
      queryClient.setQueryData(key, { services: next });
    },
  });
}

export function useAdminUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, detectiveId, data }: { id: string; detectiveId: string; data: Partial<Service> }) =>
      api.services.update(id, data),
    onSuccess: (_: any, variables: { id: string; detectiveId: string; data: Partial<Service> }) => {
      // Invalidate all variations of the specific service query
      queryClient.invalidateQueries({ queryKey: ["services", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["services", variables.id, "preview"] });
      queryClient.invalidateQueries({ queryKey: ["services", variables.id, "public"] });
      // Invalidate detective's services
      queryClient.invalidateQueries({ queryKey: ["services", "detective", variables.detectiveId, "admin"] });
      queryClient.invalidateQueries({ queryKey: ["services", "detective", variables.detectiveId] });
      // Invalidate all services list
      queryClient.invalidateQueries({ queryKey: ["services", "all"] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.services.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.refetchQueries({ queryKey: ["services"] });
    },
  });
}

export function useReviews(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["reviews", "all", limit, offset],
    queryFn: () => api.reviews.getAll(limit, offset),
  });
}

export function useReviewsByService(serviceId: string | null | undefined, limit?: number) {
  return useQuery({
    queryKey: ["reviews", "service", serviceId, limit],
    queryFn: () => api.reviews.getByService(serviceId!, limit),
    enabled: !!serviceId,
  });
}

export function useReviewsByDetective() {
  const { data: me } = useCurrentDetective();
  const detectiveId = me?.detective?.id;
  return useQuery({
    queryKey: ["reviews", "detective", detectiveId],
    queryFn: () => api.reviews.getByDetective(),
    enabled: !!detectiveId,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertReview) => api.reviews.create(data),
    onSuccess: (response: any) => {
      // Invalidate all review queries
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      
      // CRITICAL: Also invalidate service queries since avgRating/reviewCount changed
      // This ensures service cards, detail pages, and search results show updated data
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["detectives"] });
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Review> }) =>
      api.reviews.update(id, data),
    onSuccess: (_, variables) => {
      // Invalidate all review queries
      queryClient.invalidateQueries({ queryKey: ["reviews", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "all"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      
      // CRITICAL: Also invalidate service queries since avgRating/reviewCount changed
      // This ensures service cards, detail pages, and search results show updated data
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["detectives"] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.reviews.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.refetchQueries({ queryKey: ["reviews"] });
    },
  });
}

export function useOrders(limit?: number, offset?: number) {
  return useQuery({
    queryKey: ["orders", "all", limit, offset],
    queryFn: () => api.orders.getAll(limit, offset),
  });
}

export function useOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () => api.orders.getById(id!),
    enabled: !!id,
  });
}

export function useOrdersByUser(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["orders", "user", userId],
    queryFn: () => api.orders.getByUser(userId!),
    enabled: !!userId,
  });
}

export function useOrdersByDetective(detectiveId: string | null | undefined) {
  return useQuery({
    queryKey: ["orders", "detective", detectiveId],
    queryFn: () => api.orders.getByDetective(detectiveId!),
    enabled: !!detectiveId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertOrder) => api.orders.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Order> }) =>
      api.orders.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["orders", "all"] });
    },
  });
}

export function useFavorites(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["favorites", "user", userId],
    queryFn: () => api.favorites.getByUser(userId!),
    enabled: !!userId,
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, detectiveId }: { userId: string; detectiveId: string }) =>
      api.favorites.add(userId, detectiveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, detectiveId }: { userId: string; detectiveId: string }) =>
      api.favorites.remove(userId, detectiveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
}

export function useUser(id: string | null | undefined) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => api.users.getById(id!),
    enabled: !!id,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      api.users.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useApplications(params?: { status?: string; search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["applications", params?.status, params?.search, params?.limit, params?.offset],
    queryFn: () => api.applications.getAll(params),
  });
}

export function useApplication(id: string | null | undefined) {
  return useQuery({
    queryKey: ["applications", id],
    queryFn: () => api.applications.getById(id!),
    enabled: !!id,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertDetectiveApplication) =>
      api.applications.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: "approved" | "rejected"; reviewNotes?: string }) =>
      api.applications.updateStatus(id, { status, reviewNotes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applications", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["detectives"] });
    },
  });
}

export function useUpdateApplicationNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewNotes }: { id: string; reviewNotes: string }) =>
      api.applications.updateStatus(id, { reviewNotes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["applications", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useClaims(status: string = "pending", limit: number = 50) {
  return useQuery({
    queryKey: ["claims", status, limit],
    queryFn: () => api.claims.getAll(status, limit),
  });
}

export function useUpdateClaimStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      api.claims.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      queryClient.invalidateQueries({ queryKey: ["detectives"] });
    },
  });
}

export function useServiceCategories(activeOnly?: boolean, enabled: boolean = true) {
  return useQuery({
    queryKey: ["serviceCategories", activeOnly],
    queryFn: () => api.serviceCategories.getAll(activeOnly),
    enabled,
  });
}

export function useServiceCategory(id: string | null | undefined) {
  return useQuery({
    queryKey: ["serviceCategories", id],
    queryFn: () => api.serviceCategories.getById(id!),
    enabled: !!id,
  });
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["settings", "site"],
    queryFn: () => api.settings.getSite(),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { logoUrl?: string | null; footerLinks?: Array<{ label: string; href: string }> }) => api.settings.updateSite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "site"] });
    },
  });
}

export function usePopularCategories() {
  return useQuery({
    queryKey: ["categories", "popular"],
    queryFn: () => api.catalog.getPopularCategories(),
    staleTime: 60 * 1000,
  });
}

export function useCreateServiceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertServiceCategory) => api.serviceCategories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceCategories"] });
      queryClient.invalidateQueries({ queryKey: ["serviceCategories", true] });
      queryClient.invalidateQueries({ queryKey: ["serviceCategories", false] });
      queryClient.invalidateQueries({ queryKey: ["serviceCategories", undefined] });
    },
  });
}

export function useUpdateServiceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServiceCategory> }) =>
      api.serviceCategories.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["serviceCategories", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["serviceCategories"] });
      queryClient.invalidateQueries({ queryKey: ["serviceCategories", true] });
      queryClient.invalidateQueries({ queryKey: ["serviceCategories", false] });
      queryClient.invalidateQueries({ queryKey: ["serviceCategories", undefined] });
    },
  });
}

export function useDeleteServiceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.serviceCategories.delete(id),
    onSuccess: (_data, id) => {
      const keys = [
        ["serviceCategories"],
        ["serviceCategories", true],
        ["serviceCategories", false],
        ["serviceCategories", undefined],
      ] as const;
      
      // Update local cache first
      for (const key of keys) {
        const current = queryClient.getQueryData<{ categories: ServiceCategory[] }>(key as any);
        if (current?.categories) {
          queryClient.setQueryData(key as any, {
            categories: current.categories.filter((c) => c.id !== id),
          });
        }
      }
      
      // Then invalidate and refetch to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["serviceCategories"] });
      
      // Force refetch specifically for the keys that might be in use
      queryClient.refetchQueries({ queryKey: ["serviceCategories", false], type: "active" });
      queryClient.refetchQueries({ queryKey: ["serviceCategories", undefined], type: "active" });
    },
  });
}

// Location hooks
export function useCountries() {
  return useQuery({
    queryKey: ["locations", "countries"],
    queryFn: () => api.locations.getCountries(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useStates(country: string | undefined) {
  return useQuery({
    queryKey: ["locations", "states", country],
    queryFn: () => api.locations.getStates(country!),
    enabled: !!country,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCities(country: string | undefined, state: string | undefined) {
  return useQuery({
    queryKey: ["locations", "cities", country, state],
    queryFn: () => api.locations.getCities(country!, state!),
    enabled: !!country && !!state,
    staleTime: 5 * 60 * 1000,
  });
}
