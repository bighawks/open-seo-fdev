import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getClaudeAccess } from "@/server/lib/claude";
import {
  getWorkersEnv,
  isHostedServerAuthMode,
} from "@/server/lib/runtime-env";
import { requireProjectContext } from "@/serverFunctions/middleware";

const ANTHROPIC_KEY_MISSING_MESSAGE =
  "ANTHROPIC_API_KEY is not set for this deployment yet. Add it to your environment, restart OpenSEO, then confirm here.";

const projectScopedSchema = z.object({ projectId: z.string().min(1) });

type SamAccessStatus = {
  enabled: boolean;
  errorMessage: string | null;
};

// Gates the in-app AI agent (SAM) on an Anthropic key being configured, the
// same way backlinks/AI-search gate on their DataForSEO subscriptions. Hosted
// deployments always have the key provisioned, so only self-hosted is checked.
export const getSamAccessSetupStatus = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(projectScopedSchema)
  .handler(async (): Promise<SamAccessStatus> => {
    if (await isHostedServerAuthMode()) {
      return { enabled: true, errorMessage: null };
    }

    // Behind an Every App gateway this is the gateway's binding; the gateway
    // answers 503 until an admin sets its ANTHROPIC_API_KEY.
    const enabled = Boolean(getClaudeAccess((await getWorkersEnv()) ?? {}));
    return {
      enabled,
      errorMessage: enabled ? null : ANTHROPIC_KEY_MISSING_MESSAGE,
    };
  });
