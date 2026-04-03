import { ExternalLink, FileText, GitBranch, GitPullRequest, Globe, Package, Activity } from "lucide-react";
import type { IssueWorkProduct } from "@paperclipai/shared";
import { cn, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const TYPE_ICONS: Record<string, any> = {
  preview_url: Globe,
  runtime_service: Activity,
  pull_request: GitPullRequest,
  branch: GitBranch,
  commit: Activity,
  artifact: Package,
  document: FileText,
};

export function WorkProductItem({ product }: { product: IssueWorkProduct }) {
  const Icon = TYPE_ICONS[product.type] || Package;
  
  return (
    <div className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
      <div className="mt-1 p-2 rounded-md bg-accent/10 text-muted-foreground group-hover:text-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-sm font-semibold truncate">{product.title}</h4>
            {product.isPrimary && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">Primary</Badge>
            )}
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] h-4 capitalize">
              {product.type.replace("_", " ")}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {relativeTime(product.createdAt)}
          </span>
        </div>
        
        {product.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2">{product.summary}</p>
        )}
        
        <div className="flex items-center gap-3 pt-1">
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View {product.type === "preview_url" ? "Preview" : "Product"}
            </a>
          )}
          
          <div className="flex items-center gap-1.5 ml-auto">
             <span className={cn(
               "h-2 w-2 rounded-full",
               product.healthStatus === "healthy" ? "bg-green-500" : 
               product.healthStatus === "unhealthy" ? "bg-red-500" : "bg-muted"
             )} />
             <span className="text-[10px] text-muted-foreground capitalize">{product.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
