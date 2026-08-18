import { LoginForm } from "@/components/auth/LoginForm";
import { WelcomeChooser } from "@/components/auth/WelcomeChooser";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string }>;
}) {
  const { form } = await searchParams;

  // Plain /login always shows the splash — only an explicit `?form=1`
  // (the splash's own "Log in" button, or a link from elsewhere) jumps
  // straight to the email+password form.
  return form === "1" ? <LoginForm /> : <WelcomeChooser />;
}
