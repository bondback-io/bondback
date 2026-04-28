"use client";

import * as React from "react";
import { CreateListingServicePickerDialog } from "@/components/listing/create-listing-service-picker-dialog";

type CreateListingPickerContextValue = {
  openCreateListingPicker: () => void;
};

const CreateListingPickerContext =
  React.createContext<CreateListingPickerContextValue | null>(null);

export function CreateListingPickerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(
    () => ({
      openCreateListingPicker: () => setOpen(true),
    }),
    []
  );

  return (
    <CreateListingPickerContext.Provider value={value}>
      {children}
      <CreateListingServicePickerDialog open={open} onOpenChange={setOpen} />
    </CreateListingPickerContext.Provider>
  );
}

export function useCreateListingPicker(): CreateListingPickerContextValue {
  const ctx = React.useContext(CreateListingPickerContext);
  if (!ctx) {
    throw new Error(
      "useCreateListingPicker must be used within CreateListingPickerProvider"
    );
  }
  return ctx;
}
