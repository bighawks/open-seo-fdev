import { createFileRoute } from "@tanstack/react-router";
import {
  CommandBlock,
  helpLinkClassName,
  SecretHelpPage,
} from "@/client/features/help/SecretHelpPage";

const ANTHROPIC_KEYS_URL = "https://platform.claude.com/settings/keys";

export const Route = createFileRoute("/_app/help/anthropic-api-key")({
  component: AnthropicApiKeyHelpPage,
});

function AnthropicApiKeyHelpPage() {
  const accountStep = (
    <li>
      Create an account at{" "}
      <a
        className={helpLinkClassName}
        href="https://platform.claude.com"
        target="_blank"
        rel="noreferrer"
      >
        platform.claude.com
      </a>{" "}
      and add credits (pay-as-you-go, like DataForSEO).
    </li>
  );
  const keyStep = (
    <li>
      Go to{" "}
      <a
        className={helpLinkClassName}
        href={ANTHROPIC_KEYS_URL}
        target="_blank"
        rel="noreferrer"
      >
        Claude Console API Keys
      </a>{" "}
      and click "Create Key".
    </li>
  );
  return (
    <SecretHelpPage
      title="Set up your Anthropic API key"
      intro={
        <>
          OpenSEO needs the <code>ANTHROPIC_API_KEY</code> secret before AI
          features like SAM, the in-app SEO agent, can run. It is optional —
          everything else in OpenSEO works without it.
        </>
      }
      everyAppIntro="SAM, prompt suggestions and website research run on Claude. On Every App the gateway holds the key once, for every app."
      secretName="ANTHROPIC_API_KEY"
      steps={
        <>
          {accountStep}
          {keyStep}
          <li>
            Save the key as the <code>ANTHROPIC_API_KEY</code> secret in your
            environment:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Docker self-hosting: <code>.env</code>
              </li>
              <li>Cloudflare: set it in the Workers UI (see below)</li>
              <li>
                Local development: <code>.env.local</code>
              </li>
            </ul>
          </li>
          <li>Restart OpenSEO.</li>
        </>
      }
      everyAppSteps={
        <>
          {accountStep}
          {keyStep}
          <li>
            An owner or admin runs this from the Every App checkout and pastes
            the key:
            <CommandBlock command="pnpm everyapp secret set ANTHROPIC_API_KEY" />
          </li>
          <li>Reload OpenSEO.</li>
        </>
      }
      dashboardPasteStep="Paste your Anthropic API key and save."
      terminalPromptHint="Paste your Anthropic API key when prompted."
    />
  );
}
