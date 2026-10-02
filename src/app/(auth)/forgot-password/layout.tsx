import type { Metadata } from "next";

// The page is a client component, which can't export metadata itself; without
// this it fell back to the site-wide default title and description.
export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
