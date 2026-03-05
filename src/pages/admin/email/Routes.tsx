// src/pages/admin/email/routes.tsx
import React from "react";
import type { RouteObject } from "react-router-dom";

import AdminEmailLayoutPage from "./Index";
import AdminEmailTemplatesPage from "./Templates";
import AdminEmailOffersPage from "./Offers";
import AdminEmailCampaignsPage from "./Campaigns";

export const adminEmailRoutes: RouteObject = {
  path: "email",
  element: <AdminEmailLayoutPage />,
  children: [
    { index: true, element: <AdminEmailTemplatesPage /> },
    { path: "templates", element: <AdminEmailTemplatesPage /> },
    { path: "offers", element: <AdminEmailOffersPage /> },
    { path: "campaigns", element: <AdminEmailCampaignsPage /> },
  ],
};