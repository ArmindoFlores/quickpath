import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import OBR, { type Theme as OBRTheme } from "@owlbear-rodeo/sdk";
import { createTheme, type Theme as MuiTheme } from "@mui/material/styles";
import { GlobalStyles } from "@mui/styled-engine";


function OBRContext() {
    const [isReady, setReady] = useState(OBR.isReady);
    const [theme, _setTheme] = useState<MuiTheme>();

    const setTheme = useCallback((theme: OBRTheme) => {
        _setTheme(createTheme({
            palette: {
                mode: theme.mode === "DARK" ? "dark" : "light",
                primary: theme.primary,
                secondary: theme.secondary,
                background: theme.background,
                text: theme.text,
            },
        }));
    }, []);

    useEffect(() => {
        const cleanup = OBR.onReady(() => setReady(true));
        return cleanup;
    }, []);

    useEffect(() => {
        if (!isReady) return;

        const cleanup = OBR.theme.onChange(newTheme => setTheme(newTheme));
        OBR.theme.getTheme().then(newTheme => setTheme(newTheme));

        return cleanup;
    }, [isReady, setTheme]);

    if (!isReady || !theme) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <GlobalStyles styles={{ body: { backgroundColor: "unset !important" } }} />
            <CssBaseline />
            <Outlet /> 
        </ThemeProvider>
    );
}

export function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<OBRContext />}>
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
