import OBR, { isImage, type Item, type Curve, type ToolEvent, type Vector2, type KeyEvent, type Image } from "@owlbear-rodeo/sdk";
import { utils } from "./utils";
import { type CostFunction, type GridMap } from "./grid/map";
import { cached, SceneCache } from "./caching";
import { pathfind as _pathfind } from "./pathfinding";
import { isEqual } from "lodash";
import {startQuickpathInteraction, updateQuickpathRuler, type QuickpathInteraction } from "./visual";
import { HorizontalHexGrid, SquareGrid, VerticalHexGrid, type ParsedGrid, type Path, type SimpleLine } from "./grid";
import { parseGrid, getGrid } from "./grid/tools";

const MEASURE_TOOL = "rodeo.owlbear.tool/measure";
const FIND_PATH_TOOL_MODE = utils.id("find-path");
const SUPPORTED_GRID_TYPES = ["SQUARE", "HEX_HORIZONTAL", "HEX_VERTICAL"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GRID_CLASSES: Record<string, new (...args: any[]) => GridMap> = {
    "SQUARE": SquareGrid,
    "HEX_HORIZONTAL": HorizontalHexGrid,
    "HEX_VERTICAL": VerticalHexGrid,
};

// This contains the active interaction manager if active, and null
// otherwise
let pathfindingInteraction: QuickpathInteraction | null = null;
// This contains the starting point for this interaction if active,
// and null otherwise.
let pathfindingStart: Vector2 | null = null;

// This contains an occupancy grid that is used for path finding and
// is computed from the current scene and its obstructions
let gridMap: GridMap | null = null;
// This contains the most recent OBR Grid object, but representing scale
// as GridScale instead of stringl
let obrGrid: ParsedGrid | null = null;

// This contains the latest valid path while using the Quickpath tool,
// or null otherwise
let latestPath: Path | null;

// This cache contains relevant scene items and is used to track whether
// any changes made should require a recomputation for the OccupancyGrid
const cache: SceneCache = new SceneCache();

const pathfind = cached(
    _pathfind,
    isEqual,
    isEqual,
);
pathfind.setMaxCacheSize(50);

async function processKey(event: KeyEvent) {
    if (pathfindingInteraction === null) return;
    if (!event.code.startsWith("Shift")) return;
    // TODO: split path
}

async function startPathfinding(event: ToolEvent) {
    if (pathfindingInteraction !== null) {
        console.warn("Tried to start an interaction without canceling the last one");
        return;
    }
    if (event.target === undefined || event.target.layer !== "CHARACTER" || !isImage(event.target)) return;
    const target = event.target;
    
    pathfindingInteraction = await startQuickpathInteraction(target);
    pathfindingStart = target.position;
}

function updatePathfinding(event: ToolEvent) {
    if (pathfindingInteraction === null) {
        return;
    }

    const [update] = pathfindingInteraction;
    update(im => {
        // FIXME: do not call update if pathfinding hasn't changed to prevent timeouts!
        if (pathfindingStart === null || gridMap === null || obrGrid === null) {
            return;
        }
        
        const start = gridMap.fromWorldCoords(pathfindingStart);
        const end = gridMap.fromWorldCoords(event.pointerPosition);

        const path = pathfind(start, end, gridMap);
        latestPath = path ? path.path : null;

        updateQuickpathRuler(im, path, event.pointerPosition, obrGrid, gridMap)
    });
}

function stopPathfinding(cancel: boolean) {
    if (pathfindingInteraction === null || gridMap === null) return;

    let target: string = "";
    const [update, stop] = pathfindingInteraction;

    update(data => target = data[2].id);
    stop();
    pathfindingInteraction = null;

    if (!cancel) {
        OBR.scene.items.updateItems([target], items => {
            if (latestPath === null || latestPath.length === 0) return;
            const image = items[0] as Image;
            const newPosition = gridMap!.toCenteredWorldCoords(latestPath[latestPath.length - 1]);
            image.position = newPosition;
        });
    }
}

function isBlockingLine(item: Item): item is Curve {
    return (
        item.type === "CURVE" &&
        item.metadata["com.battle-system.smoke/isVisionLine"] === true &&
        item.metadata["com.battle-system.smoke/blocking"] === true &&
        item.metadata["com.battle-system.smoke/disabled"] !== true &&
        !(
            item.metadata["com.battle-system.smoke/isDoor"] === true &&
            item.metadata["com.battle-system.smoke/doorOpen"] === true
        )
    );
}

function occupancyGridUpdatedNeeded(items: Item[]) {
    let update = false;
    for (const itemKey of cache.items.keys()) {
        const corresponding = items.find(item => item.id === itemKey);
        if (corresponding === undefined || (!isBlockingLine(corresponding) && !(corresponding.layer === "MAP" && isImage(corresponding)))) {
            update = true;
            cache.delete(itemKey);
        }
    }
    for (const item of items) {
        if (item.layer === "MAP" && isImage(item)) {
            if (cache.update(item.id, {layer: item.layer, ...item.position})) {
                update = true;
            }
        }
        else if (isBlockingLine(item)) {
            // FIXME: only track relevant metadata
            if (cache.update(item.id, {points: item.points, position: item.position, metadata: item.metadata})) {
                update = true;
            }
        }
    }
    return update;
}

function vectorAdd(v1: Vector2, v2: Vector2) {
    return {
        x: v1.x + v2.x,
        y: v1.y + v2.y,
    }
}

function getEuclideanDistanceFunction(scale: number): CostFunction {
    return (source, dest) => {
        return scale * utils.distance(source, dest);
    };
}

function getChebychevDistanceFunction(scale: number): CostFunction {
    return (source, dest) => {
        return scale * Math.max(Math.abs(source.x - dest.x), Math.abs(source.y - dest.y));
    };
}

function getManhattanDistanceFunction(scale: number): CostFunction {
    return (source, dest) => {
        return scale * (Math.abs(source.x - dest.x) + Math.abs(source.y - dest.y));
    };
}

function distanceFunctionFromGrid(grid: ParsedGrid): CostFunction {
    if (grid.type === "HEX_HORIZONTAL" || grid.type === "HEX_VERTICAL") {
        // When using a hex grid, the distance between two consecutive grid cells is always 1 unit
        return () => grid.scale.parsed.multiplier;
    }
    switch (grid.measurement) {
        case "EUCLIDEAN":
            return getEuclideanDistanceFunction(grid.scale.parsed.multiplier);
        case "CHEBYSHEV":
            return getChebychevDistanceFunction(grid.scale.parsed.multiplier);
        case "MANHATTAN":
            return getManhattanDistanceFunction(grid.scale.parsed.multiplier);
        default:
            console.warn(`unknown measurement type "${grid.measurement}"`);
            return getEuclideanDistanceFunction(grid.scale.parsed.multiplier);
    }
}

async function updateOccupancyMap(items: Item[], force: boolean = false) {
    if (obrGrid === null || (!force && !occupancyGridUpdatedNeeded(items))) return;

    let xMax: number | undefined = undefined, xMin: number | undefined = undefined, yMax: number | undefined = undefined, yMin: number | undefined = undefined;
    const visionLines: SimpleLine[] = [];
    for (const item of items) {
        if (item.layer === "MAP" && isImage(item)) {
            const itemDPI = item.grid.dpi;
            const factor = obrGrid.dpi / itemDPI;

            if (xMax === undefined || item.position.x + factor * item.image.width > xMax) xMax = item.position.x + factor * item.image.width;
            if (xMin === undefined || item.position.x < xMin) xMin = item.position.x;
            if (yMax === undefined || item.position.y + factor * item.image.height > yMax) yMax = item.position.y + factor * item.image.height;
            if (yMin === undefined || item.position.y < yMin) yMin = item.position.y;
        }
        else if (isBlockingLine(item)) {
            for (let i = 1; i < item.points.length; i++) {
                visionLines.push({
                    start: vectorAdd(item.points[i-1], item.position),
                    end: vectorAdd(item.points[i], item.position),
                });
            }
        }
    }
    if (yMax === undefined || xMax === undefined || xMin === undefined || yMin === undefined) {
        return;
    }

    const gridClass = GRID_CLASSES[obrGrid.type];
    
    gridMap = new gridClass(
        xMin, xMax, yMin, yMax,
        obrGrid.dpi,
        distanceFunctionFromGrid(obrGrid),
        obrGrid.scale.parsed.unit
    );
    gridMap.build(visionLines);
    pathfind.clearCache();
}

function setupScene() {
    OBR.tool.createMode({
        id: FIND_PATH_TOOL_MODE,
        icons: [
            {label: "Find Path", icon: "/favicon.svg", filter: {activeTools: [MEASURE_TOOL]}}
        ],
        cursors: [
            {cursor: "grab", filter: {dragging: false, target: [{key: "layer", value: "CHARACTER"}]}},
            {cursor: "grabbing", filter: {dragging: true, target: [{key: "layer", value: "CHARACTER"}]}},
            {cursor: "crosshair"},
        ],
        preventDrag: {dragging: false},
        onClick: () => {
            if (obrGrid?.measurement === "ALTERNATING") {
                OBR.notification.show(`The "ALTERNATING" measuring mode is not supported.`, "ERROR");
            }
            else if (!SUPPORTED_GRID_TYPES.includes(obrGrid!.type)) {
                OBR.notification.show(`The "${obrGrid?.type}" grid type is not supported.`, "ERROR");
            }
            else {
                OBR.tool.activateMode(MEASURE_TOOL, FIND_PATH_TOOL_MODE);
            }
        },
        onKeyUp: (_, event) => processKey(event),
        onToolDragStart: (_, event) => startPathfinding(event),
        onToolDragMove: (_, event) => updatePathfinding(event),
        onToolDragEnd: () => stopPathfinding(false),
        onToolDragCancel: () => stopPathfinding(true),
        onDeactivate: () => stopPathfinding(true),
        shortcut: "P",
    });

    let unsubscribeFromSceneItems: () => void | undefined;
    let unsubscribeFromSceneGrid: () => void | undefined;
    function onSceneReady(ready: boolean) {
        if (!ready) return;
        cache.clear();

        unsubscribeFromSceneItems = OBR.scene.items.onChange(updateOccupancyMap);
        unsubscribeFromSceneGrid = OBR.scene.grid.onChange(newObrGrid => {
            pathfind.clearCache();
            const shouldUpdateOccupancyMap = obrGrid === null || obrGrid.dpi !== newObrGrid.dpi || obrGrid.type !== newObrGrid.type;
            obrGrid = parseGrid(newObrGrid);
            if (shouldUpdateOccupancyMap) {
                OBR.scene.items.getItems().then(items => updateOccupancyMap(items, true));
            }
            else if (gridMap !== null) {
                gridMap.cost = distanceFunctionFromGrid(obrGrid);
                gridMap.unit = obrGrid.scale.parsed.unit;
            }
        });
        getGrid().then(grid => {
            obrGrid = grid;
        });
        OBR.scene.items.getItems().then(updateOccupancyMap);
    }

    OBR.scene.isReady().then(onSceneReady);
    const unsubscribeFromSceneReady = OBR.scene.onReadyChange(onSceneReady);

    return () => {
        unsubscribeFromSceneReady();
        if (unsubscribeFromSceneItems) unsubscribeFromSceneItems();
        if (unsubscribeFromSceneGrid) unsubscribeFromSceneGrid();
    }
}

function setup() {
    let unsubscribe: (() => void) | null = null;
    OBR.scene.isReady().then(ready => {
        if (ready) {
            unsubscribe = setupScene();
        }
    });
    OBR.scene.onReadyChange(ready => {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        if (ready) {
            unsubscribe = setupScene();
        }
    });
}

OBR.onReady(setup);
