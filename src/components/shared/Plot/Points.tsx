import * as d3 from 'd3';
import _ from 'lodash';
import { useCallback, useContext, useEffect, useMemo } from 'react';
import { theme } from 'twin.macro';
import PlotContext from './PlotContext';
import { MergeStrategy, Point2d, Shape } from './types';

function drawShape(
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    point: Point2d,
    color: string,
    size: number,
    opacity: number,
    xScale: d3.ScaleContinuousNumeric<number, number>,
    yScale: d3.ScaleContinuousNumeric<number, number>,
    transform: d3.ZoomTransform
) {
    const [x, y] = transform.apply([xScale(point[0]) ?? 0, yScale(point[1]) ?? 0]);

    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();

    switch (shape) {
        case 'triangle': {
            // Equilateral triangle with same visual area as a circle of `size` radius
            const r = size * 1.25;
            ctx.moveTo(x, y - r);
            ctx.lineTo(
                x + r * Math.sin((2 * Math.PI) / 3),
                y - r * Math.cos((2 * Math.PI) / 3)
            );
            ctx.lineTo(
                x + r * Math.sin((4 * Math.PI) / 3),
                y - r * Math.cos((4 * Math.PI) / 3)
            );
            ctx.closePath();
            break;
        }
        case 'square': {
            const s = size * 1.6;
            ctx.rect(x - s / 2, y - s / 2, s, s);
            break;
        }
        case 'diamond': {
            const r = size * 1.25;
            ctx.moveTo(x, y - r);
            ctx.lineTo(x + r, y);
            ctx.lineTo(x, y + r);
            ctx.lineTo(x - r, y);
            ctx.closePath();
            break;
        }
        case 'cross': {
            const r = size * 1.25;
            const t = r * 0.4; // arm half-thickness
            ctx.moveTo(x - r, y - t);
            ctx.lineTo(x - t, y - t);
            ctx.lineTo(x - t, y - r);
            ctx.lineTo(x + t, y - r);
            ctx.lineTo(x + t, y - t);
            ctx.lineTo(x + r, y - t);
            ctx.lineTo(x + r, y + t);
            ctx.lineTo(x + t, y + t);
            ctx.lineTo(x + t, y + r);
            ctx.lineTo(x - t, y + r);
            ctx.lineTo(x - t, y + t);
            ctx.lineTo(x - r, y + t);
            ctx.closePath();
            break;
        }
        case 'circle':
        default:
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            break;
    }
    ctx.fill();
}

function fade(ctx: CanvasRenderingContext2D, opacity: number) {
    ctx.globalAlpha = opacity;
    ctx.fillStyle = theme`colors.white`;
    ctx.fillRect(0, 0, ctx.canvas.clientWidth, ctx.canvas.clientHeight);
}

function drawPoints(
    ctx: CanvasRenderingContext2D,
    points: Point2d[],
    colors: string[],
    sizes: number[],
    shapes: Shape[],
    hidden: boolean[],
    selected: boolean[],
    isPointHighlighted: (index: number) => boolean,
    active: boolean,
    xScale: d3.ScaleContinuousNumeric<number, number>,
    yScale: d3.ScaleContinuousNumeric<number, number>,
    transform: d3.ZoomTransform
) {
    const shapeOf = (i: number): Shape => shapes[i] ?? 'circle';

    for (let i = 0; i < points.length; i++) {
        if (!hidden[i]) continue;
        drawShape(
            ctx,
            shapeOf(i),
            points[i],
            colors[i],
            sizes[i] * 5.0,
            0.7,
            xScale,
            yScale,
            transform
        );
    }
    fade(ctx, 0.85);

    for (let i = 0; i < points.length; i++) {
        if (isPointHighlighted(i) || hidden[i] || selected[i]) continue;
        drawShape(
            ctx,
            shapeOf(i),
            points[i],
            colors[i],
            sizes[i] * 5.0,
            0.7,
            xScale,
            yScale,
            transform
        );
    }

    for (let i = 0; i < points.length; i++) {
        if (isPointHighlighted(i) || hidden[i] || !selected[i]) continue;
        drawShape(
            ctx,
            shapeOf(i),
            points[i],
            theme`colors.red.400`,
            sizes[i] * 5.0 + 2.0,
            1.0,
            xScale,
            yScale,
            transform
        );
    }

    for (let i = 0; i < points.length; i++) {
        if (isPointHighlighted(i) || hidden[i] || !selected[i]) continue;
        drawShape(
            ctx,
            shapeOf(i),
            points[i],
            colors[i],
            sizes[i] * 5.0,
            0.7,
            xScale,
            yScale,
            transform
        );
    }

    if (!active) {
        for (let i = 0; i < points.length; ++i) {
            if (isPointHighlighted(i)) {
                fade(ctx, 0.5);
                break;
            }
        }
    }

    for (let i = 0; i < points.length; i++) {
        if (!isPointHighlighted(i)) continue;
        const outlineColor = selected[i] ? theme`colors.red.500` : theme`colors.white`;

        drawShape(
            ctx,
            shapeOf(i),
            points[i],
            outlineColor,
            sizes[i] * 5.0 + 2.0,
            1.0,
            xScale,
            yScale,
            transform
        );
    }

    for (let i = 0; i < points.length; i++) {
        if (!isPointHighlighted(i)) continue;
        drawShape(
            ctx,
            shapeOf(i),
            points[i],
            colors[i],
            sizes[i] * 5.0,
            1.0,
            xScale,
            yScale,
            transform
        );
    }
}

function clear(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, ctx.canvas.clientWidth, ctx.canvas.clientHeight);
}

interface Props {
    colors: string[];
    sizes: number[];
    shapes?: Shape[];
    selected: boolean[];
    hidden: boolean[];
    onClick?: (index?: number, mergeMode?: MergeStrategy) => void;
}

const Points = ({
    colors,
    sizes,
    shapes,
    hidden,
    selected,
    onClick,
}: Props): JSX.Element => {
    const {
        svgRef,
        canvas,
        width,
        height,
        transformRef,
        isPointHighlighted,
        setHoveredIndex,
        active,
        setActive,
        xScale,
        yScale,
        setXScale,
        setYScale,
        xRange,
        yRange,
        points,
    } = useContext(PlotContext);

    const [xDomain, yDomain] = useMemo(() => {
        const x = [
            _.minBy(points, (p) => p[0])?.[0] ?? 0,
            _.maxBy(points, (p) => p[0])?.[0] ?? 1,
        ];
        const y = [
            _.minBy(points, (p) => p[1])?.[1] ?? 0,
            _.maxBy(points, (p) => p[1])?.[1] ?? 1,
        ];
        return [x, y];
    }, [points]);

    useEffect(() => {
        const x = d3.scaleLinear().domain(xDomain).range(xRange);
        setXScale(() => x);
    }, [setXScale, xDomain, xRange]);
    useEffect(() => {
        const y = d3.scaleLinear().domain(yDomain).range(yRange);
        setYScale(() => y);
    }, [setYScale, yDomain, yRange]);

    const draw = useCallback(() => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        clear(ctx);
        drawPoints(
            ctx,
            points,
            colors,
            sizes,
            shapes ?? [],
            hidden,
            selected,
            isPointHighlighted,
            active,
            xScale,
            yScale,
            transformRef?.current
        );
    }, [
        canvas,
        points,
        colors,
        sizes,
        shapes,
        hidden,
        selected,
        xScale,
        yScale,
        isPointHighlighted,
        active,
        transformRef,
    ]);

    useEffect(() => {
        draw();
    }, [draw, width, height]);

    useEffect(() => {
        let lastTransform = transformRef.current;

        const animate = () => {
            const transform = transformRef.current;
            if (transform !== lastTransform) {
                draw();
                lastTransform = transform;
            }
            request = requestAnimationFrame(animate);
        };

        let request = requestAnimationFrame(() => {
            animate();
        });

        return () => cancelAnimationFrame(request);
    }, [transformRef, draw]);

    useEffect(() => {
        if (!svgRef.current) return;

        const indexMap = points.map((_p, i) => i).filter((i) => !hidden[i]);

        const delaunay = d3.Delaunay.from(
            indexMap,
            (i) => xScale(points[i][0]),
            (i) => yScale(points[i][1])
        );

        const findHoveredIndex = (point: [number, number]) => {
            const transform = transformRef.current;

            const [x, y] = transform.invert(point);

            const i = delaunay.find(x, y);

            if (isNaN(i)) {
                setHoveredIndex(undefined);
                return;
            }

            const index = indexMap[i];

            const dist = Math.hypot(
                x - xScale(points[index][0]),
                y - yScale(points[index][1])
            );

            const radius = 8 / transform.k;
            return dist < radius ? index : undefined;
        };

        // We want to select point only on clicks and not on drags to prevent
        // unwanted interaction with the brushing behavior
        // This flag indicates if the current interaction is a 'click'
        let isClick: boolean;

        d3.select<Element, unknown>(svgRef.current).on('pointermove', (event) => {
            // reset isClick when the mouse is moved
            // do this always (before any other early out)
            isClick = false;

            if (event.buttons) {
                setHoveredIndex(undefined);
                return;
            }

            const hoveredIndex = findHoveredIndex(d3.pointer(event));
            setHoveredIndex(hoveredIndex);
        });
        d3.select<Element, unknown>(svgRef.current).on('pointerenter', () => {
            setActive(true);
        });
        d3.select<Element, unknown>(svgRef.current).on('pointerleave', () => {
            setActive(false);
            setHoveredIndex(undefined);
            isClick = false;
        });

        d3.select<Element, unknown>(svgRef.current).on('pointerdown', (event) => {
            if (event.buttons !== 1 || event.altKey) return;
            isClick = true;
        });

        d3.select<Element, unknown>(svgRef.current).on('pointerup', (event) => {
            const position = d3.pointer(event);

            if (isClick === true) {
                const hoveredIndex = findHoveredIndex(position);
                if (hoveredIndex !== undefined) {
                    const mergeMode: MergeStrategy =
                        event.ctrlKey && event.shiftKey
                            ? 'intersect'
                            : event.ctrlKey
                              ? 'difference'
                              : event.shiftKey
                                ? 'union'
                                : 'replace';

                    onClick?.(hoveredIndex, mergeMode);
                } else {
                    onClick?.();
                }
            }
            isClick = false;
        });
    }, [
        svgRef,
        points,
        hidden,
        xScale,
        yScale,
        transformRef,
        setHoveredIndex,
        setActive,
        onClick,
    ]);

    return <></>;
};

export default Points;
