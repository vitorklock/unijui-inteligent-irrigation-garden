
export namespace Garden {

    export interface Position {
        x: number
        y: number
    }

    export namespace Tile {
        export type Type =
            | "soil"
            | "path"
            | "pillar"
            | "water_source"
    }

    export interface Tile extends Position {
        type: Tile.Type
        hasPlant: boolean
        moisture: number  // 0 = dry, 1 = ideal, >1 = flooded
    }

    export interface HosePath {
        id: string
        source: Position
        target: Position
        tiles: Position[] // ordered positions from source to target
    }

}

export interface Garden {
    width: number
    height: number
    tiles: Garden.Tile[][] // tiles[y][x]
    hoses: Garden.HosePath[]
}    
