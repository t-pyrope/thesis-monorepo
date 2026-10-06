import { z } from "zod";
import { MAX_ASSIGNMENT_LENGTH } from "./constants.js";

export const analyzeSchema = z.object({
  rules: z.string(),
  documents: z.array(
    z
      .instanceof(File)
      .refine(
        (file) =>
          [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(file.type),
        {
          message: "Only PDF and DOCX files are allowed",
        },
      ),
  ),
  assignment: z
    .string()
    .transform((value) => value.replace(/\r\n/g, "\n"))
    .pipe(z.string().max(MAX_ASSIGNMENT_LENGTH)),
});
