"use client";

import * as React from "react";
import { ToastProviderWithContext } from "./use-toast";
import { ErrorHandler } from "@/components/errors/error-handler";

export function Toaster({ children }: { children?: React.ReactNode }) {
  return (
    <ToastProviderWithContext>
      <ErrorHandler>{children}</ErrorHandler>
    </ToastProviderWithContext>
  );
}

