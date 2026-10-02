import type { Metadata } from "next";

// The page is a client component, which can't export metadata itself; without
// this it fell back to the site-wide default title and description.
export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
