import { Link } from "@tanstack/react-router";
import { ShieldAlert, Wrench } from "lucide-react";
import { GateCard } from "@/client/components/GateCard";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { isEveryAppClientAuthMode } from "@/lib/auth-mode";

export function SamSetupGate({
  errorMessage,
  isRefetching,
  onRetry,
}: {
  errorMessage: string | null;
  isRefetching: boolean;
  onRetry: () => void;
}) {
  return (
    <GateCard
      icon={Wrench}
      tone="warning"
      title="Enable AI Features"
      description={
        <>
          {isEveryAppClientAuthMode() ? (
            <p>
              SAM, OpenSEO&apos;s in-app AI agent, uses Claude through your
              Every App gateway. An admin creates a key in the Claude Console
              and sets it on the gateway with{" "}
              <code>pnpm everyapp secret set ANTHROPIC_API_KEY</code>, then
              confirm here.
            </p>
          ) : (
            <p>
              SAM, OpenSEO&apos;s in-app AI agent, needs an Anthropic API key.
              Create a key in the Claude Console, set it as the{" "}
              <code>ANTHROPIC_API_KEY</code> environment variable, restart
              OpenSEO, then confirm here.
            </p>
          )}
          <p className="text-xs">
            Step-by-step instructions for every deployment are in the{" "}
            <Link
              className="underline underline-offset-2 hover:text-foreground"
              to="/help/anthropic-api-key"
            >
              Anthropic API key setup guide
            </Link>
            .
          </p>
        </>
      }
      actions={
        <>
          <Button size="lg" pending={isRefetching} onClick={onRetry}>
            Confirm API Key
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={
              <a
                href="https://platform.claude.com/settings/keys"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Open Claude Console Keys
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Alert variant="warning">
          <ShieldAlert />
          <AlertDescription className="text-foreground">
            {errorMessage}
          </AlertDescription>
        </Alert>
      ) : null}
    </GateCard>
  );
}
