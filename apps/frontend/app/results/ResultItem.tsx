"use client";
import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import { useId } from "react";
import { CheckResult, PdfCheckResult, SelectedDocument } from "@/types";

const DocumentCheckResultItem = ({
  title,
  result,
}: {
  title: string;
  result: PdfCheckResult;
}) => {
  return (
    <Box>
      {title}:{" "}
      <Typography
        component="span"
        sx={{
          color: result.valid
            ? "success.main"
            : result.valid === false
              ? "error.main"
              : "warning.main",
        }}
      >
        {result.message}
      </Typography>
    </Box>
  );
};

export const ResultItem = ({
  title,
  result,
  selectedDocument,
}: {
  title: string;
  result: CheckResult;
  selectedDocument: SelectedDocument;
}) => {
  const id = useId();

  const {
    documentRules: {
      pageSize,
      marginLeftMm,
      fontFamily,
      fontSize,
      lineSpacing,
    },
  } = selectedDocument;

  return (
    <Accordion
      defaultExpanded={true}
      elevation={0}
      sx={{ border: `1px solid`, borderColor: "divider", width: "100%" }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        aria-controls={`${id}-panel1-content`}
        id={`${id}-panel1-header`}
        sx={{ "& .MuiAccordionSummary-content": { maxWidth: "stretch" } }}
      >
        <Typography
          component="h2"
          variant="h3"
          sx={{ textOverflow: "ellipsis", overflow: "hidden" }}
        >
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography component="h3" variant="h4">
              Vlastnosti souboru
            </Typography>

            <DocumentCheckResultItem
              title={`Písmo (${fontFamily})`}
              result={result.pdf.fontFamily}
            />

            <DocumentCheckResultItem
              title={`Okraje stránky (kontroluje se pouze levý okraj ${marginLeftMm}mm)`}
              result={result.pdf.marginLeftMm}
            />

            <DocumentCheckResultItem
              title={`Velikost písma (${fontSize})`}
              result={result.pdf.fontSize}
            />

            <DocumentCheckResultItem
              title={`Řádkování (${lineSpacing})`}
              result={result.pdf.lineSpacing}
            />

            <DocumentCheckResultItem
              title={`Rozměr stránek (${pageSize})`}
              result={result.pdf.pageSize}
            />

            {selectedDocument.documentRules.chapterStartsNewPage &&
              result.pdf.chapterStartsNewPage && (
                <DocumentCheckResultItem
                  title="Všechny hlavní kapitoly začínají na nové stránce"
                  result={result.pdf.chapterStartsNewPage}
                />
              )}

            {result.ai && (
              <>
                <Typography component="h3" variant="h4">
                  Výsledek analýzy AI
                </Typography>

                <Typography component="h4" variant="h5">
                  Violations
                </Typography>

                <Typography>{result.ai.summary}</Typography>

                <Stack spacing={2}>
                  {result.ai.violations.map((violation) => (
                    <Stack spacing={1} key={violation.ruleId}>
                      <Typography sx={{ fontWeight: "bold" }}>
                        {violation.description} ({violation.location})
                      </Typography>
                      <Typography>
                        {violation.explanation} ({violation.ruleId})
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                <Typography component="h4" variant="h5">
                  Impossible to determine
                </Typography>

                {result.ai.impossibleToDetermine.map((point) => (
                  <Stack key={point.ruleId}>
                    {point.reason} ({point.ruleId})
                  </Stack>
                ))}
              </>
            )}
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
