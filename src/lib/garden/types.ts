
export namespace Garden {

    export namespace Tile {
        export type Type =
            | "soil"
            | "path"
            | "pillar"
            | "water_source"

    }

    export interface Tile {
        x: number
        y: number
        type: Tile.Type
        hasPlant: boolean
        moisture: number  // 0 = dry, 1 = ideal, >1 = flooded
    }

}

export interface Garden {
    width: number
    height: number
    tiles: Garden.Tile[][] // tiles[y][x]
}    
