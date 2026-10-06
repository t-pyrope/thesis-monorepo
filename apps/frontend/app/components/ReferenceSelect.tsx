"use client";

import { Stack, TextField } from "@mui/material";
import { UseFormRegisterReturn } from "react-hook-form";

import { DOCUMENTS } from "@/app/components/constants";
import { RulesModal } from "@/app/components/RulesModal";

export const ReferenceSelect = ({
  selectedProfileId,
  ...props
}: {
  selectedProfileId: string;
} & Partial<UseFormRegisterReturn<string>>) => {
  const options = DOCUMENTS.map((doc) => ({
    label: `${doc.institution.faculty_code}, ${doc.institution.work_type} (${doc.year})`,
    value: doc.profile_id,
  }));

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "flex-end" } }}
        component="div"
      >
        <TextField
          {...props}
          select
          fullWidth
          label="Metodické pokyny*"
          slotProps={{
            select: {
              native: true,
            },
          }}
        >
          {options.map(({ label, value }) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </TextField>

        <RulesModal selectedProfileId={selectedProfileId} />
      </Stack>
    </>
  );
};
