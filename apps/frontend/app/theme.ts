import { createTheme } from "@mui/material";

const ink = "#252525";
const inkSelected = "#454545";
const muted = "#666666";
const canvas = "#fafafa";
const field = "#eeeeee";
const border = "#d4d4d4";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: ink },
    secondary: { main: muted },
    background: { default: canvas, paper: canvas },
    text: { primary: ink, secondary: muted },
    divider: border,
    error: { main: "#a52d27" },
    warning: { main: "#865c18" },
    success: { main: "#386348" },
    info: { main: "#476274" },
  },
  shape: { borderRadius: 0 },
  spacing: 8,
  typography: {
    fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    fontSize: 16,
    h1: {
      fontSize: "clamp(2.5rem, 5vw, 4rem)",
      fontWeight: 700,
      lineHeight: 1.04,
      letterSpacing: "-0.055em",
      marginBottom: 48,
      textWrap: "balance",
    },
    h2: {
      fontSize: "2.5rem",
      fontWeight: 600,
      lineHeight: 1.12,
      letterSpacing: "-0.045em",
    },
    h3: {
      fontSize: "2rem",
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: "-0.04em",
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: "-0.035em",
    },
    h5: { fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.025em" },
    h6: { fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.02em" },
    subtitle1: {
      fontSize: "0.9375rem",
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: "-0.025em",
    },
    body1: { fontSize: "1rem", lineHeight: 1.6, letterSpacing: "-0.025em" },
    body2: { fontSize: "0.875rem", lineHeight: 1.5, letterSpacing: "-0.015em" },
    button: {
      fontSize: "0.9375rem",
      fontWeight: 600,
      textTransform: "none",
      letterSpacing: "-0.025em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: canvas, color: ink },
        "::selection": { backgroundColor: "#dcdcdc", color: ink },
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          "&.Mui-focusVisible": {
            outline: `2px solid ${ink}`,
            outlineOffset: 4,
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44, padding: "12px 20px", boxShadow: "none" },
        outlined: {
          borderColor: border,
          "&:hover": { borderColor: ink, backgroundColor: "#e8e8e8" },
        },
        text: {
          padding: "8px 0",
          "&:hover": {
            backgroundColor: "transparent",
            textDecoration: "underline",
            textUnderlineOffset: 5,
          },
        },
        // Primary actions echo the reference's oversized, unboxed Submit link.
        contained: {
          justifyContent: "flex-start",
          // padding: "4px 0",
          // backgroundColor: "transparent",
          color: "white",
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: "-0.045em",
          "&:hover": {
            backgroundColor: inkSelected,
            // color: border,
            boxShadow: "none",
          },
          "&.Mui-disabled": { backgroundColor: inkSelected },
          // "&.MuiButton-loading": { color: "transparent" },
        },
        sizeSmall: { fontSize: "0.8125rem", padding: "6px 12px" },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        slotProps: { inputLabel: { shrink: true } },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          position: "relative",
          transform: "none",
          maxWidth: "100%",
          marginBottom: 8,
          fontSize: "0.9375rem",
          fontWeight: 500,
          lineHeight: 1.5,
          color: ink,
          "&.Mui-focused": { color: ink },
          "&.Mui-error": { color: "#a52d27" },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: field,
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#b0b0b0",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: ink,
            borderWidth: 1,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "#a52d27",
          },
          "&.Mui-disabled": { backgroundColor: "#f2f2f2" },
        },
        input: {
          padding: "17px 16px",
          "&::placeholder": { color: muted, opacity: 1 },
        },
        multiline: { padding: "16px", "& textarea": { padding: 0 } },
        notchedOutline: {
          borderColor: "transparent",
          top: 0,
          "& legend": { display: "none" },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 0, marginTop: 8 } },
    },
    MuiNativeSelect: { styleOverrides: { icon: { color: ink, right: 12 } } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none", boxShadow: "none" },
        outlined: { borderColor: border },
      },
    },
    MuiDialog: { styleOverrides: { paper: { border: `1px solid ${border}` } } },
    MuiDialogTitle: { styleOverrides: { root: { padding: "24px 32px" } } },
    MuiDialogContent: { styleOverrides: { root: { padding: "24px" } } },
    MuiDialogActions: { styleOverrides: { root: { padding: "16px 32px" } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 0, fontWeight: 500 } } },
    MuiAccordion: {
      styleOverrides: { root: { "&::before": { display: "none" } } },
    },
  },
});
