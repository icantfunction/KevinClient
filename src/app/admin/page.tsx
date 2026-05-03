import type { Metadata } from "next";
import StudioOsApp from "@/components/studio-os-app";
import { StudioOsAuthProvider } from "@/components/studio-os-auth-provider";

export const metadata: Metadata = {
  title: "Studio OS",
  description:
    "Unified operations dashboard for Kevin's photography practice and creator studio.",
  applicationName: "Kevin's Studio OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Studio OS",
  },
};

export default function AdminPage() {
  return (
    <StudioOsAuthProvider>
      <StudioOsApp />
    </StudioOsAuthProvider>
  );
}
