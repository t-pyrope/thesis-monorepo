import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import definitionsDocument from "@academic-analyzer/analysis-core/docs/rule-definitions.json";
import { DOCUMENTS } from "@/app/components/constants";
import { formatLabel } from "./utils";

type GuidelineRule = {
  description: string;
  severity: string;
};

const definitionMap = new Map(
  definitionsDocument.rule_definitions.map((definition) => [
    definition.id,
    definition,
  ]),
);

const categoryMap = new Map(
  definitionsDocument.categories.map((category) => [
    category.id,
    category.name,
  ]),
);

const severityColor = (severity: string) => {
  switch (severity) {
    case "error":
      return "error" as const;

    case "recommendation":
      return "info" as const;

    default:
      return "default" as const;
  }
};

const severityLabel = (severity: string) => {
  switch (severity) {
    case "error":
      return "Povinné";

    case "recommendation":
      return "Doporučení";

    default:
      return formatLabel(severity);
  }
};

export const RulesModal = ({
  selectedProfileId,
}: {
  selectedProfileId: string;
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const selectedDocument = DOCUMENTS.find(
    (document) => document.profile_id === selectedProfileId,
  );

  const rulesByCategory = selectedDocument?.rules.reduce(
    (groups, rule) => {
      const definition = definitionMap.get(rule.definition);

      if (!definition) {
        return groups;
      }

      const category = definition.category;

      (groups[category] ??= []).push(rule);

      return groups;
    },
    {} as Record<string, GuidelineRule[]>,
  );

  return (
    <>
      <Dialog
        open={isDialogOpen && Boolean(selectedDocument)}
        onClose={() => setIsDialogOpen(false)}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        {selectedDocument && (
          <>
            <DialogTitle>
              <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
                {selectedDocument.institution.faculty}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {formatLabel(selectedDocument.institution.work_type)} ·{" "}
                {selectedDocument.year}
              </Typography>
            </DialogTitle>

            <DialogContent dividers>
              <Stack>
                {Object.entries(rulesByCategory ?? {}).map(
                  ([category, rules]) => (
                    <Box
                      key={category}
                      sx={{
                        p: 2,
                        // border: "1px solid",
                        // borderColor: "divider",
                        // borderRadius: 1,
                        "&:before": {
                          display: "none",
                        },
                        "&:not(:last-child)": {
                          // marginBottom: 1,
                        },
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>
                          {categoryMap.get(category) ?? formatLabel(category)}
                        </Typography>

                        <Chip label={rules.length} size="small" />
                      </Stack>
                      <Stack spacing={2}>
                        {rules.map((rule) => (
                          <Paper
                            key={rule.description}
                            elevation={0}
                            variant="outlined"
                            sx={{
                              p: 1,
                              gap: 1,
                              // display: "flex",
                              // flexDirection: "column",
                              // alignItems: "flex-start",
                            }}
                          >
                            <Chip
                              label={severityLabel(rule.severity)}
                              size="small"
                              color={severityColor(rule.severity)}
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {rule.description}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  ),
                )}
              </Stack>
            </DialogContent>
          </>
        )}

        <DialogActions>
          <Button type="button" onClick={() => setIsDialogOpen(false)}>
            Zavřít
          </Button>
        </DialogActions>
      </Dialog>{" "}
      {selectedDocument && (
        <Button
          type="button"
          variant="outlined"
          onClick={() => setIsDialogOpen(true)}
          sx={{
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          Zobrazit pravidla
        </Button>
      )}
    </>
  );
};
