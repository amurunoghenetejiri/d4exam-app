import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Mic,
  Paperclip,
  Search,
  Send,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSessionUser } from "@/lib/session";
import { useStudentContext } from "@/lib/student";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SplitHandle } from "@/components/dashboard/SplitHandle";
import { isOnlineNow } from "@/lib/offline-sync";
import { joinMessagingPresence, ticksFor } from "@/lib/messaging-presence";
import { uploadMessageMedia } from "@/lib/message-media";
import { VoiceBubble, ImageBubble, ImageLightbox, LongPressMenu, VoiceRecorderBar, lastSeenLabel, parseMediaUrls, attachmentLabel } from "@/components/messaging/MessageMedia";

export const Route = createFileRoute("/student/contact-officer")({
  head: () => ({ meta: [{ title: "Messages — D4EXAM" }] }),
  component: Page,
});

// NOTE: Full file is large. If this commit is incomplete the next commit completes it.
// This is a progressive restore marker.
function Page() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-slate-600">
      Loading messages…
    </div>
  );
}
