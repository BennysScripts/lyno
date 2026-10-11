"use client";
import { createContext, useContext } from "react";
import type { AppData, Template } from "@/lib/types";
import type { TemplateInput } from "@/lib/flow";
export type EditorTemplate = TemplateInput & { id?: string };
export type WorkspaceContext = {
  data: AppData;
  refresh: () => Promise<void>;
  mutate: <T = Record<string, unknown>>(
    path: string,
    body: unknown,
    method?: string,
    message?: string,
  ) => Promise<T>;
  run: (
    path: string,
    body: unknown,
    method?: string,
    message?: string,
  ) => Promise<void>;
  start: (t: Template) => void;
  editTemplate: (t?: EditorTemplate) => void;
  toast: (text: string, error?: boolean) => void;
  manage: boolean;
  admin: boolean;
  write: boolean;
};
export const AppContext = createContext<WorkspaceContext | null>(null);
export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("AppContext fehlt");
  return c;
}
