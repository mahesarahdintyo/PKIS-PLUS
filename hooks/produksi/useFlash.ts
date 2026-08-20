import { useCallback } from "react";
import { toast } from "sonner";

export function useFlash() {
  const flash = useCallback((msg: string, isError = false) => {
    if (isError) {
      toast.error(msg);
    } else {
      toast.success(msg);
    }
  }, []);

  return { successMsg: "", errorMsg: "", flash };
}
