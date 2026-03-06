// FILE: src/pages/account/AccountGeneratorRedirect.tsx
import React from "react";
import { Navigate } from "react-router-dom";

export default function AccountGeneratorRedirect() {
  return <Navigate to="/generator" replace />;
}