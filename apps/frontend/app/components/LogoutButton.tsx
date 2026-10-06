"use client";

import { Box, Button } from "@mui/material";
import { usePathname } from "next/navigation";

export function LogoutButton() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <Box component="form" action="/api/logout" method="post">
      <Button type="submit">Odhlásit se</Button>
    </Box>
  );
}
