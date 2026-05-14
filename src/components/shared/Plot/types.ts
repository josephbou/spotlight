export interface Margin {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export type Point2d = [number, number];

export type MergeStrategy = 'replace' | 'union' | 'difference' | 'intersect';

export type Shape = 'circle' | 'triangle' | 'square' | 'diamond' | 'cross';

export const SHAPES: Shape[] = ['circle', 'triangle', 'square', 'diamond', 'cross'];
