export const notificationQueryKeys = {
  all: ["notifications"] as const,
  user: (userId: string) => ["notifications", "user", userId] as const,
};
