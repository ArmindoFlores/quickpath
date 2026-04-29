import OBR, { buildCurve, buildImage, type Curve, type Image, type InteractionManager, type Vector2 } from "@owlbear-rodeo/sdk";
import type { Path, PathfindingResult } from "./pathfinding";
import type { WritableDraft } from "immer";
import { type ParsedGrid } from "./gridTools";
import type { GridMap } from "./gridMaps";

export type QuickpathInteractionArgs = [Curve, Image, Image];
export type QuickpathInteraction = InteractionManager<QuickpathInteractionArgs>;
export type InteractionDrafts<T> = T extends infer I ? WritableDraft<I> : never;
export type QuickpathInteractionDrafts = InteractionDrafts<QuickpathInteractionArgs>;

function buildRuler(position: Vector2) {
    return buildCurve()
        .position(position)
        .points([])
        .strokeColor("#6E7391")
        .fillOpacity(0)
        .strokeDash([40, 40])
        .strokeWidth(10)
        .tension(0)
        .disableHit(true)
        .closed(false)
        .layer("RULER")
        .build();
}

function buildRulerEnd(target: Image): Image {
    return buildImage(target.image, target.grid)
        .position(target.position)
        .scale(target.scale)
        .rotation(target.rotation)
        .textType("PLAIN")
        .build();
}

function makeRelative(path: Path) {
    if (path.length < 2) return path;
    return path.map(point => ({ x: point.x - path[0].x, y: point.y - path[0].y }));
}

export async function startQuickpathInteraction(target: Image) {
    const rulerEnd = buildRulerEnd(target);
    const interaction = await OBR.interaction.startItemInteraction<QuickpathInteractionArgs>([
        buildRuler(target.position),
        rulerEnd,
        target
    ]);
    return interaction;
}

export function updateQuickpathRuler(drafts: QuickpathInteractionDrafts, path: PathfindingResult, targetPos: Vector2, obrGrid: ParsedGrid, grid: GridMap) {
    const [ruler, ending, target] = drafts;

    if (path === null) {
        ending.text.plainText = "";
        ruler.points = makeRelative([ruler.position, targetPos]);
        ending.position = targetPos;
        ending.image = {
            url: `${window.origin}/forbidden.png`,
            mime: "image/png",
            width: 1280,
            height: 1280,
        };
        ending.grid = {
            dpi: 2 * 1280 * obrGrid.dpi / target.grid.dpi,
            offset: { x: 640, y: 640 },
        };
    }
    else {
        ending.image = target.image;
        ending.grid = target.grid;
        ending.text.plainText = `${path.distance !== 0 ? path.distance.toFixed(obrGrid.scale.parsed.digits) + obrGrid.scale.parsed.unit : ""}`;
        ending.text.style.fontSize = 30;

        const scaledPath = path.path.map(point => grid.toWorldCoords(point)); 
        ruler.points = makeRelative(scaledPath);
        if (ruler.points.length > 0) {
            ending.position = grid.toCenteredWorldCoords(path.path.at(-1)!);
        }
        else {
            ending.position = target.position;
        }
    }
}
