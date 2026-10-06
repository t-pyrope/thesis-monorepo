import { Box, Button, TextField, Typography } from "@mui/material";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <Box
      component="main"
      sx={{
        width: "100%",
        maxWidth: 520,
        mx: "auto",
        mt: { xs: 10, sm: 20 },
        px: 3,
        pb: 8,
      }}
    >
      <Typography variant="h1" sx={{ mb: 6 }}>
        Přihlášení
      </Typography>
      <Box
        component="form"
        action="/api/login"
        method="post"
        sx={{ display: "grid", gap: 3 }}
      >
        <TextField
          name="password"
          label="Heslo"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          error={!!error}
          helperText={error ? "Nesprávné heslo." : undefined}
        />
        <Box>
          <Button type="submit" variant="contained">
            Přihlásit se
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
