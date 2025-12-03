import { Garden as G } from "./types";
import type { Garden as GardenModel } from "./types";

export class GardenGrid {
    readonly width: number;
    readonly height: number;
    private readonly tiles: G.Tile[][];

    constructor(garden: GardenModel) {
        this.width = garden.width;
        this.height = garden.height;
        this.tiles = garden.tiles;
    }

    inBounds(x: number, y: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    getTile(x: number, y: number): G.Tile | undefined {
        if (!this.inBounds(x, y)) return undefined;
        return this.tiles[y][x];
    }

    neighbors4(pos: G.Position): G.Tile[] {
        const out: G.Tile[] = [];
        const deltas = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
        ];

        for (const { dx, dy } of deltas) {
            const x = pos.x + dx;
            const y = pos.y + dy;
            const tile = this.getTile(x, y);
            if (tile) out.push(tile);
        }

        return out;
    }

    isWalkableForHose(tile: G.Tile): boolean {
        // Hoses can cross soil, paths and water_source, but not pillars
        return tile.type !== "pillar";
    }

    getMovementCost(tile: G.Tile): number {
        // Prefer paths slightly over soil, water sources cost like paths
        switch (tile.type) {
            case "path":
            case "water_source":
                return 1;
            case "soil":
                return 1.3;
            default:
                return Infinity; // pillar / invalid
        }
    }

    findTilesByType(type: G.Tile.Type): G.Tile[] {
        const result: G.Tile[] = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const t = this.tiles[y][x];
                if (t.type === type) result.push(t);
            }
        }
        return result;
    }

    findPlantTiles(): G.Tile[] {
        const result: G.Tile[] = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const t = this.tiles[y][x];
                if (t.hasPlant) result.push(t);
            }
        }
        return result;
    }

    findWaterSources(): G.Tile[] {
        return this.findTilesByType("water_source");
    }
}
