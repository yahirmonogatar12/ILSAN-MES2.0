import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Check, X } from "lucide-react";
import { IconButton } from "./Button";
import { ToastContext } from "./useToast";
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(
    null,
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider
      value={(message) => setToast({ message, id: Date.now() })}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast.message}
          <IconButton
            label="Cerrar notificación"
            icon={<X size={15} />}
            onClick={() => setToast(null)}
          />
        </div>
      )}
    </ToastContext.Provider>
  );
}
