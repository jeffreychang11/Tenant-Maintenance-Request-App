import { cookies } from "next/headers";
import { LoginForm } from "@/components/auth/LoginForm";
import { WelcomeChooser } from "@/components/auth/WelcomeChooser";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string }>;
}) {
  const { form } = await searchParams;
  const cookieStore = await cookies();
  const seenAuth = cookieStore.get("seen_auth")?.value === "1";

  // `form=1`/`form=0` let specific links force one view or the other
  // (e.g. "Log in" from the chooser, "New here?" from the plain form);
  // otherwise a device that's never completed a sign-in sees the
  // landlord/tenant chooser, and a device that has just gets the form.
  const showForm = form === "1" ? true : form === "0" ? false : seenAuth;

  return showForm ? <LoginForm /> : <WelcomeChooser />;
}
