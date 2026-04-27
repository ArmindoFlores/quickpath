import OBR, { buildCurve, buildImage, type Curve, type Image, type InteractionManager, type Vector2 } from "@owlbear-rodeo/sdk";
import type { PathfindingResult } from "./pathfinding";
import type { WritableDraft } from "immer";

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
        .build();
}

function makeRelative(path: Vector2[]) {
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

export function updateQuickpathRuler(drafts: QuickpathInteractionDrafts, path: PathfindingResult, targetPos: Vector2, dpi: number) {
    const [ruler, ending, target] = drafts;

    if (path === null) {
        ruler.points = makeRelative([ruler.position, targetPos]);
        ending.position = target.position;
    }
    else {
        const scaledPath = path.path.map(point => ({ x: (point.x + 0.5) * dpi, y: (point.y + 0.5) * dpi })); 
        ruler.points = makeRelative(scaledPath);
        if (ruler.points.length > 0) {
            ending.position = scaledPath.at(-1);
        }
        else {
            ending.position = target.position;
        }
    }
}
