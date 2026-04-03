import type { IssueWorkProduct } from "@paperclipai/shared";
import { WorkProductItem } from "./WorkProductItem";
import { ScrollArea } from "@/components/ui/scroll-area";

export function WorkProductList({ products }: { products: IssueWorkProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-2 border border-dashed rounded-lg">
        <p className="text-sm font-medium">No work products yet</p>
        <p className="text-xs text-muted-foreground">
          Artifacts, PRs, and previews produced for this issue will appear here.
        </p>
      </div>
    );
  }

  const sortedProducts = [...products].sort((a, b) => {
    // Primary first
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    // Then by date desc
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <ScrollArea className="h-full max-h-[600px] pr-4">
      <div className="space-y-3">
        {sortedProducts.map((product) => (
          <WorkProductItem key={product.id} product={product} />
        ))}
      </div>
    </ScrollArea>
  );
}
