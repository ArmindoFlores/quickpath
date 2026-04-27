import OBR, { isImage, type Item, type Curve, type ToolEvent, type Vector2 } from "@owlbear-rodeo/sdk";
import { utils } from "./utils";
import { OccupancyGrid } from "./occupancyGrid";
import { cached, SceneCache } from "./caching";
import { pathfind as _pathfind } from "./pathfinding";
import { isEqual } from "lodash";
import {startQuickpathInteraction, updateQuickpathRuler, type QuickpathInteraction } from "./visual";

interface SimpleLine {
    start: Vector2;
    end: Vector2;
}

const MEASURE_TOOL = "rodeo.owlbear.tool/measure";
const FIND_PATH_TOOL_MODE = utils.id("find-path");

let pathfindingInteraction: QuickpathInteraction | null = null;
let pathfindingStart: Vector2 | null = null;
let grid: OccupancyGrid;
const cache: SceneCache = new SceneCache();

const pathfind = cached(
    _pathfind,
    isEqual,
    isEqual,
);
pathfind.setMaxCacheSize(50);

function handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    console.log("Received event!", event);
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

    const start = {
        x: Math.round(pathfindingStart.x / grid.dpi - 0.5),
        y: Math.round(pathfindingStart.y / grid.dpi - 0.5),
    };

    const end = {
        x: Math.round(event.pointerPosition.x / grid.dpi - 0.5),
        y: Math.round(event.pointerPosition.y / grid.dpi - 0.5),
    };

    const path = pathfind(start, end, grid);

    const [update] = pathfindingInteraction;
    update(im => updateQuickpathRuler(im, path, event.pointerPosition, grid.dpi));
}

function stopPathfinding() {
    if (pathfindingInteraction === null) return;
    const [, stop] = pathfindingInteraction;
    pathfindingInteraction = null;
    stop();
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

function intersects(line1: SimpleLine, line2: SimpleLine) {
    const { start: p1, end: p2 } = line1;
    const { start: p3, end: p4 } = line2;

    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;

    const denom = d1x * d2y - d1y * d2x;

    if (denom === 0) return false;

    const dx = p3.x - p1.x;
    const dy = p3.y - p1.y;

    const t = (dx * d2y - dy * d2x) / denom;
    const u = (dx * d1y - dy * d1x) / denom;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function computeOccupancy(x: number, y: number, grid: OccupancyGrid, lines: SimpleLine[]) {
    let occupancy = 0xff;
    for (let yOffset = -1; yOffset <= 1; yOffset++) {
        for (let xOffset = -1; xOffset <= 1; xOffset++) {
            if (yOffset === 0 && xOffset === 0) continue;
            for (const line of lines) {
                const start: Vector2 = {
                    x: Math.round((x + xOffset + 0.5) * grid.dpi),
                    y: Math.round((y + yOffset + 0.5) * grid.dpi),
                };
                const end: Vector2 = {
                    x: Math.round((x + 0.5) * grid.dpi),
                    y: Math.round((y + 0.5) * grid.dpi),
                };
                if (intersects(line, {start, end})) {
                    occupancy ^= grid.maskFromNeighbour({x: xOffset, y: yOffset});
                    break;
                }
            }
        }
    }
    return occupancy;
}

function fillOcupancyGrid(grid: OccupancyGrid, lines: SimpleLine[]) {
    for (let y = grid.bounds.y.min; y < grid.bounds.y.max; y++) {
        for (let x = grid.bounds.x.min; x < grid.bounds.x.max; x++) {
            grid.setOccupancy(x, y, computeOccupancy(x, y, grid, lines));
        }
    }
}

function occupancyGridUpdatedNeeded(items: Item[]) {
    let update = false;
    for (const itemKey of cache.items.keys()) {
        const corresponding = items.find(item => item.id === itemKey);
        if (corresponding === undefined) update = true;
    }
    for (const item of items) {
        if (item.layer === "MAP" && isImage(item)) {
            if (cache.update(item.id, {layer: item.layer, ...item.position})) {
                update = true;
            }
        }
        else if (isBlockingLine(item)) {
            if (cache.update(item.id, {points: item.points, position: item.position})) {
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

async function updateOccupancyMap(items: Item[]) {
    if (!occupancyGridUpdatedNeeded(items)) return;

    const gridDPI = await OBR.scene.grid.getDpi();

    let xMax: number, xMin: number, yMax: number, yMin: number;
    const visionLines: SimpleLine[] = [];
    for (const item of items) {
        if (item.layer === "MAP" && isImage(item)) {
            const itemDPI = item.grid.dpi;
            const factor = gridDPI / itemDPI;

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
    grid = new OccupancyGrid(xMin, xMax, yMin, yMax, gridDPI);
    console.log(grid);
    fillOcupancyGrid(grid, visionLines);
    pathfind.clearCache();
}

function setupScene() {
    console.log("Setting up");

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
        onClick: () => OBR.tool.activateMode(MEASURE_TOOL, FIND_PATH_TOOL_MODE),
        onToolDragStart: (_, event) => startPathfinding(event),
        onToolDragMove: (_, event) => updatePathfinding(event),
        onToolDragEnd: () => stopPathfinding(),
        onToolDragCancel: () => stopPathfinding(),
        shortcut: "P",
    });


    let unsubscribeFromSceneItems: () => void | undefined;
    function onSceneReady(ready: boolean) {
        if (!ready) return;
        cache.clear();
        unsubscribeFromSceneItems = OBR.scene.items.onChange(updateOccupancyMap);
        OBR.scene.items.getItems().then(updateOccupancyMap);
    }

    OBR.scene.isReady().then(onSceneReady);
    const unsubscribeFromSceneReady = OBR.scene.onReadyChange(onSceneReady);

    return () => {
        console.log("Tearing down");
        unsubscribeFromSceneReady();
        if (unsubscribeFromSceneItems) unsubscribeFromSceneItems();
    }
}

function setup() {
    window.addEventListener("message", handleMessage);
    window.addEventListener("messageerror", handleMessage);

    let unsubscribe: () => void | null = null;
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
