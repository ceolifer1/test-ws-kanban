export const LABELS = {
  housing: { name: "Housing", color: "#f59e0b" },
  voucher: { name: "Voucher", color: "#8b5cf6" },
  listing: { name: "Listing", color: "#06b6d4" },
  compliance: { name: "Compliance", color: "#ef4444" },
  development: { name: "Development", color: "#ec4899" },
  marketing: { name: "Marketing", color: "#22c55e" },
  tenant: { name: "Tenant", color: "#f97316" },
  agent: { name: "Agent", color: "#3b82f6" },
  operations: { name: "Operations", color: "#a855f7" },
  onboarding: { name: "Onboarding", color: "#14b8a6" },
};

export const PRIORITY = {
  high: { emoji: "\ud83d\udd34", label: "High" },
  medium: { emoji: "\ud83d\udfe1", label: "Medium" },
  low: { emoji: "\ud83d\udfe2", label: "Low" },
};

export const DEFAULT_COLUMNS = {
  development: [
    { name: "Backlog", emoji: "\ud83d\udccb", position: 0 },
    { name: "Design", emoji: "\ud83c\udfa8", position: 1 },
    { name: "Development", emoji: "\u2699\ufe0f", position: 2 },
    { name: "Testing", emoji: "\ud83e\uddea", position: 3 },
    { name: "Deployed", emoji: "\ud83d\ude80", position: 4 },
  ],
  marketing: [
    { name: "Ideas", emoji: "\ud83d\udca1", position: 0 },
    { name: "Planning", emoji: "\ud83d\udcdd", position: 1 },
    { name: "In Progress", emoji: "\ud83d\udd04", position: 2 },
    { name: "Review", emoji: "\ud83d\udc40", position: 3 },
    { name: "Published", emoji: "\u2705", position: 4 },
  ],
  general: [
    { name: "To Do", emoji: "\ud83d\udccb", position: 0 },
    { name: "In Progress", emoji: "\ud83d\udd04", position: 1 },
    { name: "Review", emoji: "\ud83d\udc40", position: 2 },
    { name: "Done", emoji: "\u2705", position: 3 },
  ],
};

export const AVATAR_COLORS = [
  "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444", "#ec4899",
  "#22c55e", "#f97316", "#3b82f6", "#a855f7", "#14b8a6",
];
