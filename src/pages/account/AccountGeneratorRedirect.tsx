import React from "react";
import { Navigate } from "react-router-dom";

export default function AccountGeneratorRedirect() {
  return <Navigate to="/funnel/uploadPhoto" replace />;
}
