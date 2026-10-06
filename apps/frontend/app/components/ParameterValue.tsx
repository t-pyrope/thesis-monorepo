import { RuleValue } from "@/app/components/types";
import type { ReactNode } from "react";
import { Box, List, ListItem, Stack, Typography } from "@mui/material";
import { formatLabel } from "@/app/components/utils";

const formatValue = (value: string | number | boolean | null | undefined) => {
  if (typeof value === "boolean") {
    return value ? "Ano" : "Ne";
  }

  if (value === null || value === undefined) {
    return "Neuvedeno";
  }

  return typeof value === "string" ? formatLabel(value) : String(value);
};

export const ParameterValue = ({ value }: { value: RuleValue }): ReactNode => {
  if (Array.isArray(value)) {
    return (
      <List
        dense
        disablePadding
        sx={{
          pl: 2,
          mt: 0.5,
          listStyleType: "disc",
        }}
      >
        {value.map((item, index) => (
          <ListItem
            key={index}
            disableGutters
            sx={{
              display: "list-item",
              py: 0.15,
            }}
          >
            <ParameterValue value={item} />
          </ListItem>
        ))}
      </List>
    );
  }

  if (typeof value === "object" && value !== null) {
    return (
      <Stack spacing={0.75} sx={{ mt: 0.5 }}>
        {Object.entries(value).map(([key, nestedValue]) => (
          <Box key={key}>
            <Typography
              component="span"
              variant="body2"
              sx={{ fontWeight: 600 }}
            >
              {formatLabel(key)}:{" "}
            </Typography>

            <ParameterValue value={nestedValue} />
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Typography component="span" variant="body2" color="text.primary">
      {formatValue(value)}
    </Typography>
  );
};
