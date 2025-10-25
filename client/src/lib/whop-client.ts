// Whop client-side SDK utilities
export interface IframeSdk {
  inAppPurchase: (options: { planId?: string; id?: string }) => Promise<{
    status: "ok" | "error";
    data?: { receipt_id: string };
    error?: string;
  }>;
}

export interface WhopWebSocketMessage {
  isTrusted: boolean;
  json: string;
  fromUserId?: string;
}

export interface WhopWebSocket {
  connect: () => void;
  disconnect: () => void;
  broadcast: (options: { message: string; target: "everyone" | { experience: string } | { custom: string } | { user: string } }) => void;
  on: (event: "appMessage" | "connect" | "disconnect" | "connectionStatus", callback: (data: any) => void) => void;
}

// Mock iframe SDK for development
export const mockIframeSdk: IframeSdk = {
  inAppPurchase: async (options) => {
    console.log("Mock purchase:", options);
    // Simulate a successful purchase
    return {
      status: "ok" as const,
      data: { receipt_id: `receipt_${Date.now()}` }
    };
  }
};

// Mock WebSocket for development
export const mockWhopWebSocket: WhopWebSocket = {
  connect: () => console.log("Mock WebSocket connected"),
  disconnect: () => console.log("Mock WebSocket disconnected"),
  broadcast: (options) => console.log("Mock WebSocket broadcast:", options),
  on: (event, callback) => {
    console.log("Mock WebSocket event listener:", event);
    // Simulate some events for development
    if (event === "connect") {
      setTimeout(() => callback({}), 100);
    }
  }
};

// In a real Whop app, this would be provided by the Whop iframe context
export function getIframeSdk(): IframeSdk {
  // For development, return mock SDK
  if (process.env.NODE_ENV === "development") {
    return mockIframeSdk;
  }
  
  // In production, this would be the actual Whop iframe SDK
  // return window.whop?.iframe || mockIframeSdk;
  return mockIframeSdk;
}

export function getWhopWebSocket(options?: { joinExperience?: string; joinCustom?: string }): WhopWebSocket {
  // For development, return mock WebSocket
  if (process.env.NODE_ENV === "development") {
    return mockWhopWebSocket;
  }
  
  // In production, this would be the actual Whop WebSocket client
  // return window.whop?.websockets?.client(options) || mockWhopWebSocket;
  return mockWhopWebSocket;
}

// Helper to send push notifications from client
export async function sendPushNotification(options: {
  experienceId: string;
  title: string;
  content: string;
  restPath?: string;
  userIds?: string[];
}) {
  const endpoint = options.userIds ? "/api/whop/notify-users" : "/api/whop/notify-experience";
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });
  
  if (!response.ok) {
    throw new Error("Failed to send notification");
  }
  
  return response.json();
}