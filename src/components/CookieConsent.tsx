import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "archivai-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:p-5">
        <p className="flex-1 text-sm text-foreground/85">
          Ez a weboldal sütiket használ a működéshez. A sütik kizárólag a
          szolgáltatás működéséhez szükségesek, marketing célra nem használjuk őket.
        </p>
        <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/adatkezeles">Részletek</Link>
          </Button>
          <Button
            onClick={accept}
            size="sm"
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Elfogadom
          </Button>
        </div>
      </div>
    </div>
  );
}
