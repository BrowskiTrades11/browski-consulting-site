export type MockUser = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  isAdmin: boolean;
};

export type MockAccount = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  propAccountId: string;
  submittedAt: string;
  approvalStatus: "pending" | "approved" | "rejected" | "disabled";
  licenseKey: string | null;
  notes: string;
};

export type MockSubscription = {
  userId: string;
  status: string;
  botType: string;
  priceMonthlyUsd: number;
  currentPeriodEnd: string | null;
};

const users: MockUser[] = [
  {
    id: "admin_001",
    fullName: "Admin User",
    email: "admin@example.com",
    password: "password123",
    isAdmin: true,
  },
  {
    id: "user_001",
    fullName: "Demo User",
    email: "demo@example.com",
    password: "password123",
    isAdmin: false,
  },
];

const accounts: MockAccount[] = [
  {
    id: "acct_001",
    userId: "user_001",
    fullName: "Demo User",
    email: "demo@example.com",
    propAccountId: "TRD-104882",
    submittedAt: "2026-04-05 10:14 AM",
    approvalStatus: "pending",
    licenseKey: null,
    notes: "",
  },
  {
    id: "acct_002",
    userId: "user_001",
    fullName: "Demo User",
    email: "demo@example.com",
    propAccountId: "TRD-104913",
    submittedAt: "2026-04-05 11:02 AM",
    approvalStatus: "pending",
    licenseKey: null,
    notes: "",
  },
];

const subscriptions: MockSubscription[] = [];

export function getUsers() {
  return users;
}

export function findUserByEmail(email: string) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
}

export function createUser(fullName: string, email: string, password: string) {
  const user = {
    id: `user_${Date.now()}`,
    fullName,
    email,
    password,
    isAdmin: false,
  };
  users.push(user);
  return user;
}

export function getUserFromToken(token?: string | null) {
  if (!token) return null;
  const email = token.replace("mock-token-", "");
  return findUserByEmail(email);
}

export function getAccountsForUser(userId: string) {
  return accounts.filter((account) => account.userId === userId);
}

export function getAllAccounts() {
  return accounts;
}

export function submitAccount(user: MockUser, propAccountId: string) {
  const account = {
    id: `acct_${Date.now()}`,
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    propAccountId,
    submittedAt: new Date().toLocaleString(),
    approvalStatus: "pending" as const,
    licenseKey: null,
    notes: "",
  };
  accounts.push(account);
  return account;
}

export function updateAccountStatus(id: string, approvalStatus: MockAccount["approvalStatus"], notes: string, licenseKey?: string | null) {
  const account = accounts.find((item) => item.id === id);
  if (!account) return null;
  account.approvalStatus = approvalStatus;
  account.notes = notes;
  if (licenseKey !== undefined) {
    account.licenseKey = licenseKey;
  }
  return account;
}

export function getSubscriptionForUser(userId: string) {
  return subscriptions.find((subscription) => subscription.userId === userId) || null;
}

export function upsertSubscription(userId: string, status: string) {
  const existing = subscriptions.find((subscription) => subscription.userId === userId);
  if (existing) {
    existing.status = status;
    existing.currentPeriodEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    return existing;
  }
  const subscription = {
    userId,
    status,
    botType: "MONEY_PRINT_ORB",
    priceMonthlyUsd: 499,
    currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };
  subscriptions.push(subscription);
  return subscription;
}