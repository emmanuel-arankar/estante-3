import { Outlet } from "react-router-dom";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const ContainedLayout = () => {
  return (
    <div className="max-w-7xl mx-auto px-4">
      <Breadcrumbs />
      <Outlet />
    </div>
  );
};