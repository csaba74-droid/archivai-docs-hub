import { Files, Search, Upload, FolderOpen, User } from "lucide-react";
import { ScanButton } from "@/components/ScanButton";

type Props = {
  onAll: () => void;
  onSearch: () => void;
  onUpload: () => void;
  onCategories: () => void;
  onProfile: () => void;
  onScan: (files: File[]) => void;
  activeCat: string | null;
};

export function MobileBottomNav({ onAll, onSearch, onUpload, onCategories, onProfile, onScan, activeCat }: Props) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border flex items-end justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      aria-label="Mobil navigáció"
    >
      <NavBtn icon={<Files className="h-5 w-5" />} label="Összes" active={activeCat === null} onClick={onAll} />
      <NavBtn icon={<Search className="h-5 w-5" />} label="Keresés" onClick={onSearch} />

      <div className="flex flex-col items-center -mt-6">
        <button
          onClick={onUpload}
          aria-label="Feltöltés"
          className="h-14 w-14 rounded-full bg-brand text-brand-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Upload className="h-6 w-6" />
        </button>
        <span className="text-[10px] mt-1 text-muted-foreground">Feltöltés</span>
      </div>

      <div className="flex flex-col items-center gap-0.5 flex-1 max-w-[64px]">
        <ScanButton
          onFilesReady={onScan}
          iconOnly
          variant="ghost"
          className="h-9 w-9 rounded-full"
        />
        <span className="text-[10px] text-muted-foreground">Fotó</span>
      </div>

      <NavBtn icon={<FolderOpen className="h-5 w-5" />} label="Kategóriák" onClick={onCategories} />
      <NavBtn icon={<User className="h-5 w-5" />} label="Profil" onClick={onProfile} />
    </nav>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 flex-1 max-w-[64px] py-1 rounded-md transition-colors ${active ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}
