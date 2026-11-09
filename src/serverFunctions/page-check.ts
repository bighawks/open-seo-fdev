import { createServerFn } from "@tanstack/react-start";
import { PageCheckService } from "@/server/features/page-check/services/PageCheckService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { pageCheckSchema } from "@/types/schemas/page-check";

export const checkPage = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(pageCheckSchema)
  .handler(({ data }) => PageCheckService.checkPage(data.url));
