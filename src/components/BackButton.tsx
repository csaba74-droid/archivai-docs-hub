import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Generic "back" navigation: uses browser history when possible so the user
 * returns to wherever they came from. Falls back to /dashboard for hard-loaded
 * pages (no prior history entry).
 */
export function BackButton({
  fallback = "/dashboard",
  label = "Vissza",
  variant = "ghost",
  size = "sm",
  className,
}: {
  fallback?: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const navigate = useNavigate();
  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: fallback });
    }
  };
  return (
    <Button variant={variant} size={size} onClick={onClick} className={className}>
      <ArrowLeft className="h-4 w-4 mr-1" /> {label}
    </Button>
  );
}
