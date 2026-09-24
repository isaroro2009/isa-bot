import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Escucha en tiempo real los avisos que envía el equipo de IsaBot. */
export function LiveNotifications() {
  useEffect(() => {
    const ch = supabase
      .channel("in-app-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "in_app_notifications" },
        (payload) => {
          const n = payload.new as { title: string; body: string };
          toast(`📣 ${n.title}`, { description: n.body, duration: 12000 });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return null;
}
