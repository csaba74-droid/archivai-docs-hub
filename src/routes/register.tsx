import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./login";

export const Route = createFileRoute("/register")({
  component: () => <AuthPage initialMode="register" />,
});
