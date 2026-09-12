declare module "cloudflare:workers" { export const DurableObject: typeof import("@cloudflare/workers-types/index.ts").CloudflareWorkersModule.DurableObject; }
declare module "cloudflare:workers" {
  export const WorkflowEntrypoint: typeof import("@cloudflare/workers-types/index.ts").CloudflareWorkersModule.WorkflowEntrypoint;
  export type WorkflowEvent<T> = import("@cloudflare/workers-types/index.ts").CloudflareWorkersModule.WorkflowEvent<T>;
  export type WorkflowStep = import("@cloudflare/workers-types/index.ts").CloudflareWorkersModule.WorkflowStep;
}
