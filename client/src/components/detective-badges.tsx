import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type BadgeType = 'verified' | 'blueTick' | 'pro' | 'recommended';

interface BadgeIconProps {
  type: BadgeType;
  className?: string;
}

/**
 * Icon-only badge component for detective name display
 * Shows single icon with tooltip, no text labels
 */
export function BadgeIcon({ type, className = "h-5 w-5 flex-shrink-0 cursor-help" }: BadgeIconProps) {
  const getBadgeConfig = (badgeType: BadgeType) => {
    switch (badgeType) {
      case 'verified':
        return {
          src: "/blue-tick.png",
          alt: "Verified",
          title: "Verified",
          tooltip: "Verified"
        };
      case 'blueTick':
        return {
          src: "/blue-tick.png",
          alt: "Blue Tick",
          title: "Blue Tick",
          tooltip: "Blue Tick"
        };
      case 'pro':
        return {
          src: "/pro.png",
          alt: "Pro",
          title: "Pro",
          tooltip: "Pro"
        };
      case 'recommended':
        return {
          src: "/star.png",
          alt: "Recommended",
          title: "Recommended",
          tooltip: "Recommended"
        };
      default:
        return {
          src: "/blue-tick.png",
          alt: "Badge",
          title: "Badge",
          tooltip: "Badge"
        };
    }
  };

  const config = getBadgeConfig(type);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <img 
          src={config.src} 
          alt={config.alt} 
          className={className}
          title={config.title}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
