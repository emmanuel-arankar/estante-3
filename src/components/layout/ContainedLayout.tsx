import { Outlet } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs";

export const ContainedLayout = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 pb-8">
      <Breadcrumbs />
      <Outlet />
    </div>
  );
};