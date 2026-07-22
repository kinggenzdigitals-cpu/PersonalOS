"use client";

import Link from "next/link";
import {
  BarChart3Icon,
  SettingsIcon,
  ListTodoIcon,
  LogOutIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/components/providers/profile-provider";

export function MobileProfileMenu() {
  const profile = useProfile();
  const initial = profile.display_name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu"
          className="grid size-9 place-items-center rounded-full bg-sage-soft text-sm font-semibold text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/tasks">
            <ListTodoIcon className="size-4" /> Tasks
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/reports">
            <BarChart3Icon className="size-4" /> Reports
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOutIcon className="size-4" /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
