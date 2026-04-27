"use client";

import { createContext, useContext, type ReactNode } from "react";

type AdminNavExtrasValue = {
  showPromoTools: boolean;
};

const AdminNavExtrasContext = createContext<AdminNavExtrasValue>({
  showPromoTools: false,
});

export function AdminNavExtrasProvider({
  showPromoTools,
  children,
}: {
  showPromoTools: boolean;
  children: ReactNode;
}) {
  return (
    <AdminNavExtrasContext.Provider value={{ showPromoTools }}>
      {children}
    </AdminNavExtrasContext.Provider>
  );
}

export function useAdminNavExtras(): AdminNavExtrasValue {
  return useContext(AdminNavExtrasContext);
}
