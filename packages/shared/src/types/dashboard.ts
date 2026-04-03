export interface DashboardSummary {
  companyId: string;
  company: {
    name: string;
    status: string;
    issuePrefix: string;
    brandColor: string | null;
  };
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
  voiceOps: {
    callsLast7d: number;
    booked: number;
    followUpSent: number;
    taskCreated: number;
    escalated: number;
    disqualified: number;
    liveExecutions: number;
    stubExecutions: number;
    lastCallAt: string | null;
  };
  integrations: {
    twilioVoice: {
      configured: boolean;
      live: boolean;
      fromPhone: string | null;
    };
    twilioSms: {
      configured: boolean;
      live: boolean;
      fromPhone: string | null;
    };
    googleCalendar: {
      configured: boolean;
      live: boolean;
    };
    openai: {
      configured: boolean;
      live: boolean;
    };
  };
}
