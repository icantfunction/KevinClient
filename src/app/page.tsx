// Stage 10 Admin Page Purpose
import StudioOsApp from "@/components/studio-os-app";
import { StudioOsAuthProvider } from "@/components/studio-os-auth-provider";

export default function Home() {
  return (
    <StudioOsAuthProvider>
      <StudioOsApp />
    </StudioOsAuthProvider>
  );
}
