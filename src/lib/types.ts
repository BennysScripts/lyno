import type { catalog } from "./catalog";
import type { CompanySettings, Permission } from "./customization";
import type { entitlements } from "./entitlements";
import type { campaignStatus } from "./discount";
import type { z } from "zod";
import type { preferencesSchema } from "./customization";
import type { Role } from "./security";
import type { TemplateInput } from "./flow";
export type Person = {
  id: string;
  name: string;
  email: string;
  role: Role;
  custom_role_id?: string | null;
  created_at: string;
};
export type Organization = {
  id: string;
  name: string;
  industry: string;
  size: string;
  is_demo: boolean;
  plan: string;
  modules: string[];
  discount_percent: number;
  discount_ends_at: string | null;
  subscription_status: string;
  trial_ends_at: string;
  period_ends_at: string | null;
  cancel_at_period_end: boolean;
};
export type Template = TemplateInput & {
  id: string;
  recurrence_days: number | null;
  next_run_at: string | null;
};
export type Workflow = {
  id: string;
  template_id: string;
  name: string;
  status: "active" | "completed" | "canceled";
  priority: "low" | "normal" | "high" | "urgent";
  form_data: Record<string, string | number | boolean>;
  due_at: string | null;
  created_at: string;
  completed_at: string | null;
  creator_name: string;
};
export type Task = {
  id: string;
  workflow_id: string;
  title: string;
  description: string;
  position: number;
  kind: "task" | "approval";
  status: "ready" | "pending" | "done" | "skipped" | "rejected";
  assignee_id: string | null;
  article_id: string | null;
  due_at: string | null;
};
export type Article = {
  id: string;
  title: string;
  body: string;
  category_id: string | null;
  category_name: string | null;
  visibility: "company" | "managers" | "team";
  team_id: string | null;
  author_name: string;
  updated_at: string;
};
export type Activity = {
  id: string;
  actor_name: string;
  action: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
};
export type Insights = {
  summary: {
    total: number;
    active: number;
    completed: number;
    canceled: number;
    avg_hours: string | null;
    overdue: number;
  };
  weekly: { date: string; started: number; completed: number }[];
  bottlenecks: { title: string; count: number; age_days: string }[];
  processes: {
    name: string;
    total: number;
    completed: number;
    avg_hours: string | null;
  }[];
  days: number;
};
export type AppData = {
  permissions: Permission[];
  access: Awaited<ReturnType<typeof entitlements>>;
  catalog: ReturnType<typeof catalog>;
  campaign: Awaited<ReturnType<typeof campaignStatus>>;
  settings: CompanySettings;
  preferences: z.infer<typeof preferencesSchema>;
  customRoles: { id: string; name: string; permissions: Permission[] }[];
  orders: {
    id: string;
    plan: string;
    modules: string[];
    amount_cents: number;
    discount_percent: number;
    discount_months: number;
    checkout_url: string | null;
    status: string;
    provider: string;
    expires_at: string;
    created_at: string;
  }[];
  documents: {
    id: string;
    title: string;
    filename: string;
    mime: string;
    size_bytes: number;
    visibility: string;
    team_id: string | null;
    article_id: string | null;
    created_at: string;
  }[];
  learningPaths: {
    id: string;
    title: string;
    description: string;
    article_ids: string[];
    completedIds: string[];
  }[];
  now: string;
  mailMode: "local" | "smtp";
  me: Person & { verified: boolean };
  organization: Organization;
  organizations: { id: string; name: string; role: Role }[];
  members: Person[];
  teams: { id: string; name: string; user_ids: string[] }[];
  templates: Template[];
  workflows: Workflow[];
  tasks: Task[];
  articles: Article[];
  categories: { id: string; name: string }[];
  comments: {
    id: string;
    workflow_id: string;
    author_name: string;
    body: string;
    created_at: string;
  }[];
  checklist: {
    id: string;
    title: string;
    article_id: string | null;
    template_id: string | null;
    completed_at: string | null;
  }[];
  notifications: {
    id: string;
    title: string;
    href: string;
    read_at: string | null;
    created_at: string;
  }[];
  activity: Activity[];
  invitations: {
    id: string;
    email: string;
    role: Role;
    expires_at: string;
    accepted_at: string | null;
  }[];
  billing: {
    id: string;
    kind: string;
    plan: string;
    amount_cents: number;
    created_at: string;
  }[];
  billingOperations: {
    id: string;
    action: string;
    status: "pending" | "processing" | "attention";
    attempts: number;
    last_error_code: string | null;
    created_at: string;
    next_attempt_at: string;
  }[];
  plans: {
    id: string;
    name: string;
    price: number;
    seats: number;
    description: string;
  }[];
  insights: Insights;
  assist: { testMode: boolean; used: number; limit: number };
  billingProvider: string;
};
