import React from "react";
import { Redirect } from "expo-router";
import { useAuthStore, UserRole } from "./useAuthStore";
import { Loading } from "../../components/CareUI";

export function Protected({
  children,
  role,
}: React.PropsWithChildren<{ role?: UserRole }>) {
  const auth = useAuthStore();
  if (!auth.ready) return <Loading />;
  if (!auth.userId || (role && auth.role !== role))
    return <Redirect href="/" />;
  return <>{children}</>;
}
