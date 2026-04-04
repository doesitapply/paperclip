import { api } from "./client";

export interface AppAssistantRequest {
  message: string;
  context: {
    path: string;
    pageTitle?: string;
    companyId?: string;
    issueId?: string;
  };
}

export interface AppAssistantResponse {
  message: string;
  mode: "model" | "fallback";
}

export const assistantApi = {
  chat: (input: AppAssistantRequest) => api.post<AppAssistantResponse>("/assistant/chat", input),
};
