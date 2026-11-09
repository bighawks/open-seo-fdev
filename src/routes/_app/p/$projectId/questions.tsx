import { createFileRoute } from "@tanstack/react-router";
import { KeywordQuestionsPage } from "@/client/features/keywords/questions/KeywordQuestionsPage";
import { keywordQuestionsSearchSchema } from "@/types/schemas/keywords";

export const Route = createFileRoute("/_app/p/$projectId/questions")({
  validateSearch: keywordQuestionsSearchSchema,
  component: QuestionsRoute,
});

function QuestionsRoute() {
  const { projectId } = Route.useParams();
  const { q = "" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <KeywordQuestionsPage
      projectId={projectId}
      keyword={q}
      onSearch={(next) => void navigate({ search: { q: next } })}
    />
  );
}
