"use client";

import { useEffect, useMemo } from "react";
import {
  LOCAL_STORAGE_DOCUMENT_ID_KEY,
  LOCAL_STORAGE_RESULTS_KEY,
} from "@/app/constants";
import { useRouter } from "next/navigation";
import { CheckResult } from "@/types";
import { DOCUMENTS } from "@/app/components/constants";
import { Box, Button, Typography } from "@mui/material";
import { setStateFromLocalStorage } from "@/app/utils";

import styles from "../page.module.css";
import { ResultItem } from "@/app/results/ResultItem";

export default function ResultsPage() {
  const results = useMemo<{ [key: string]: CheckResult } | null>(() => {
    return setStateFromLocalStorage(LOCAL_STORAGE_RESULTS_KEY);
  }, []);
  const documentId = useMemo(() => {
    return setStateFromLocalStorage(LOCAL_STORAGE_DOCUMENT_ID_KEY);
  }, []);

  const router = useRouter();

  useEffect(() => {
    if (!results || !documentId) {
      router.replace("/");
    }
  }, [documentId, results, router]);

  const resultsArray = Object.entries(results ?? {});
  const selectedDocument = DOCUMENTS.find(
    (document) => document.profile_id === documentId,
  );

  const onStartAgainClick = () => {
    localStorage.removeItem(LOCAL_STORAGE_DOCUMENT_ID_KEY);
    localStorage.removeItem(LOCAL_STORAGE_RESULTS_KEY);
    router.replace("/");
  };

  if (!selectedDocument) {
    return null;
  }

  return resultsArray.length > 0 ? (
    <div className={styles.page}>
      <main className={styles.main}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "flex-start",
          }}
        >
          <Typography variant="h1" component="h1">
            Výsledky
          </Typography>

          <Button onClick={onStartAgainClick} variant="contained">
            Nová analýza
          </Button>
        </Box>

        {resultsArray.map(([documentName, result]) => (
          <ResultItem
            title={documentName}
            result={result}
            selectedDocument={selectedDocument}
            key={documentName}
          />
        ))}
      </main>
    </div>
  ) : null;
}
