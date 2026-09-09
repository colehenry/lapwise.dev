import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { type ChatConversation, listConversations } from "@/lib/chat";

export const conversationKeys = {
  list: (userId: number | null) => ["ai-conversations", userId] as const,
};

export function conversationsQuery(userId: number | null) {
  return queryOptions({
    queryKey: conversationKeys.list(userId),
    queryFn: listConversations,
    enabled: userId !== null,
    refetchOnWindowFocus: false,
  });
}

export function invalidateConversations(
  queryClient: QueryClient,
  userId: number | null,
) {
  return queryClient.invalidateQueries({
    queryKey: conversationKeys.list(userId),
  });
}

export function removeCachedConversation(
  queryClient: QueryClient,
  userId: number | null,
  conversationId: string,
) {
  queryClient.setQueryData<ChatConversation[]>(
    conversationKeys.list(userId),
    (previous) =>
      previous?.filter((conversation) => conversation.id !== conversationId) ??
      [],
  );
}
