import { createFileRoute } from "@tanstack/react-router";
import { PageCheckPage } from "@/client/features/page-check/PageCheckPage";
import { pageCheckSearchSchema } from "@/types/schemas/page-check";

export const Route = createFileRoute("/_app/p/$projectId/page-check")({
  validateSearch: pageCheckSearchSchema,
  component: PageCheckRoute,
});

function PageCheckRoute() {
  const { projectId } = Route.useParams();
  const { url = "" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <PageCheckPage
      projectId={projectId}
      url={url}
      onCheck={(next) => void navigate({ search: { url: next } })}
    />
  );
}
