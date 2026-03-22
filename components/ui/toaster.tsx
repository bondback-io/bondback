"use client";

import * as React from "react";
import { ToastProviderWithContext } from "./use-toast";

export function Toaster({ children }: { children?: React.ReactNode }) {
  return <ToastProviderWithContext>{children}</ToastProviderWithContext>;
}

