import { LogoutButton } from "@/app/components/LogoutButton";
import { Box, Typography } from "@mui/material";

export const Header = () => {
  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        justifyContent: "space-between",
        p: 2,
        alignItems: "center",
      }}
    >
      <Typography variant="h5" component="h1">
        Hromadná AI analýza akademických prací
      </Typography>
      <LogoutButton />
    </Box>
  );
};
