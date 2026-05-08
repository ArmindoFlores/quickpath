import { Box, Checkbox, FormControlLabel, FormGroup } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import OBR from "@owlbear-rodeo/sdk";
import { constants } from "./constants";

export function SettingsPage() {
    const [quickpathRoomMetadata, _setQuickpathRoomMetadata] = useState<
        Record<string, boolean>
    >({});

    const setQuickpathRoomMetadata = useCallback(
        (update: Record<string, boolean>) => {
            _setQuickpathRoomMetadata((old) => {
                const updated = { ...old, ...update };
                OBR.room.setMetadata({
                    [constants.INCLUDED_OBSTRUCTIONS_ID]: updated,
                });
                return updated;
            });
        },
        [],
    );

    useEffect(() => {
        OBR.room.getMetadata().then((metadata) => {
            const quickpathMetadata =
                metadata[constants.INCLUDED_OBSTRUCTIONS_ID];
            if (quickpathMetadata === undefined) {
                setQuickpathRoomMetadata({
                    [constants.OBR_DYNAMIC_FOG_ID]: true,
                    [constants.SMOKE_AND_SPECTER_ID]: true,
                });
            } else {
                _setQuickpathRoomMetadata(
                    quickpathMetadata as Record<string, boolean>,
                );
            }
        });
    }, [setQuickpathRoomMetadata]);

    return (
        <Box
            sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-evenly",
            }}
        >
            <FormGroup>
                <FormControlLabel
                    control={
                        <Checkbox
                            disabled={
                                quickpathRoomMetadata[
                                    constants.OBR_DYNAMIC_FOG_ID
                                ] === undefined
                            }
                            checked={
                                quickpathRoomMetadata[
                                    constants.OBR_DYNAMIC_FOG_ID
                                ] ?? false
                            }
                            onChange={(_, checked) =>
                                setQuickpathRoomMetadata({
                                    [constants.OBR_DYNAMIC_FOG_ID]: checked,
                                })
                            }
                        />
                    }
                    label="Include Dynamic Fog walls"
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            disabled={
                                quickpathRoomMetadata[
                                    constants.SMOKE_AND_SPECTER_ID
                                ] === undefined
                            }
                            checked={
                                quickpathRoomMetadata[
                                    constants.SMOKE_AND_SPECTER_ID
                                ] ?? false
                            }
                            onChange={(_, checked) =>
                                setQuickpathRoomMetadata({
                                    [constants.SMOKE_AND_SPECTER_ID]: checked,
                                })
                            }
                        />
                    }
                    label="Include Smoke & Specter walls"
                />
            </FormGroup>
        </Box>
    );
}
