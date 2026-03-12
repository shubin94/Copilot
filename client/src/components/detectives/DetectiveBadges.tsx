/**
*
* DetectiveBadges
*
* CENTRALIZED BADGE RENDERER
*
* All detective badges (Blue Tick, Pro, Recommended) must be rendered using this component.
* Do NOT render badgeState.showBlueTick, showPro, or showRecommended directly in UI components.
*
* This ensures badge rendering is consistent across:
* * service cards
* * detective profile pages
* * listings
* * favorites
* * search results
*
* If badge styles change, update ONLY this file.
*/
import { Badge } from "@/components/ui/badge";

export type BadgeState = {
  showBlueTick?: boolean;
  showPro?: boolean;
  showRecommended?: boolean;
  blueTickLabel?: string;
};

export interface DetectiveBadgesProps {
  badgeState?: BadgeState | null;
}

export function DetectiveBadges({ badgeState }: DetectiveBadgesProps) {
  if (!badgeState) return null;

  return (
    <span className="flex items-center gap-1 ml-1">
      {badgeState.showBlueTick && (
        <img
          src="/blue-tick.png"
          alt={badgeState.blueTickLabel || "Verified"}
          className="h-4 w-4"
        />
      )}
      {badgeState.showPro && (
        <img
          src="/crown.png"
          alt="Pro"
          className="h-4 w-4"
        />
      )}
      {badgeState.showRecommended && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0">
          Recommended
        </Badge>
      )}
    </span>
  );
}
