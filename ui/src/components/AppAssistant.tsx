import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { useLocation, useNavigate, useParams } from "@/lib/router";
import { assistantApi } from "@/api/assistant";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
};

const STARTERS: Record<string, string[]> = {
  issue: [
    "Draft a reply to this issue comment thread.",
    "What should happen next on this issue?",
    "Summarize blockers and owner actions.",
  ],
  default: [
    "How do I navigate this app?",
    "What should I work on next?",
    "Explain what this page is for.",
  ],
};

function pageKind(pathname: string) {
  if (pathname.includes("/issues/")) return "issue";
  return "default";
}

function pageTitle(pathname: string) {
  if (pathname.includes("/issues/")) return "Issue Copilot";
  if (pathname.includes("/dashboard")) return "Operations Dashboard";
  if (pathname.includes("/goals")) return "Goals";
  if (pathname.includes("/agents")) return "Agents";
  return "SMIRK Copilot";
}

export function AppAssistant() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      body: "Ask me what this page means, what to do next, or have me draft the next comment.",
    },
  ]);
  const location = useLocation();
  const navigate = useNavigate();
  const { issueId } = useParams<{ issueId?: string }>();
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const kind = pageKind(location.pathname);
  const starters = STARTERS[kind] ?? STARTERS.default;

  const context = useMemo(
    () => ({
      path: `${location.pathname}${location.search}`,
      pageTitle: pageTitle(location.pathname),
      companyId: selectedCompanyId ?? undefined,
      issueId: issueId ?? undefined,
    }),
    [issueId, location.pathname, location.search, selectedCompanyId],
  );

  const chat = useMutation({
    mutationFn: (message: string) => assistantApi.chat({ message, context }),
    onSuccess: (response, message) => {
      setMessages((current) => [
        ...current,
        { id: `user-${current.length}`, role: "user", body: message },
        { id: `assistant-${current.length + 1}`, role: "assistant", body: response.message },
      ]);
      setBody("");
    },
    onError: (err) => {
      pushToast({
        title: err instanceof Error ? err.message : "Assistant request failed",
        tone: "error",
      });
    },
  });

  function submit(nextMessage?: string) {
    const trimmed = (nextMessage ?? body).trim();
    if (!trimmed || chat.isPending) return;
    chat.mutate(trimmed);
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="fixed right-4 bottom-4 z-50 h-12 w-12 rounded-full border border-cyan-400/30 bg-zinc-950 text-cyan-100 shadow-[0_16px_50px_-20px_rgba(34,211,238,0.7)] hover:bg-zinc-900 md:right-6 md:bottom-6"
        onClick={() => setOpen(true)}
        aria-label="Open SMIRK copilot"
        title="Open SMIRK copilot"
      >
        <MessageSquare className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[420px] border-l border-cyan-500/15 bg-[linear-gradient(180deg,rgba(12,18,24,0.98),rgba(7,10,14,0.98))] p-0 text-zinc-100 sm:max-w-[420px]"
        >
          <SheetHeader className="border-b border-white/10 px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-zinc-50">
              <Bot className="h-4 w-4 text-cyan-300" />
              Ask SMIRK
            </SheetTitle>
            <div className="text-xs text-zinc-400">
              {context.pageTitle} · {context.path}
            </div>
          </SheetHeader>

          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-white/8 px-5 py-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                <Sparkles className="h-3.5 w-3.5" />
                Quick asks
              </div>
              <div className="flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-100"
                    onClick={() => submit(starter)}
                  >
                    {starter}
                  </button>
                ))}
                {issueId ? (
                  <button
                    type="button"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-100"
                    onClick={() => navigate(`/issues/${issueId}`)}
                  >
                    Open issue
                  </button>
                ) : null}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-5 py-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6",
                      message.role === "assistant"
                        ? "bg-white/6 text-zinc-100"
                        : "ml-auto bg-cyan-500/15 text-cyan-50",
                    )}
                  >
                    {message.body}
                  </div>
                ))}
                {chat.isPending ? (
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-white/6 px-4 py-3 text-sm text-zinc-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <div className="border-t border-white/8 px-5 py-4">
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Ask what to do next, ask for a draft reply, or ask me to explain this page."
                className="min-h-[110px] border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-500"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] text-zinc-500">
                  Uses live app context{issueId ? " and the current issue thread" : ""}.
                </div>
                <Button
                  type="button"
                  onClick={() => submit()}
                  disabled={!body.trim() || chat.isPending}
                  className="gap-2 bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                >
                  {chat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Ask
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
