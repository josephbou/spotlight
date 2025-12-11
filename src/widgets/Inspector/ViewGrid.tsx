import {
    forwardRef,
    ForwardRefRenderFunction,
    useContext,
    useImperativeHandle,
    useRef,
} from 'react';
import { VariableSizeGrid } from 'react-window';
import type { GridOnScrollProps } from 'react-window';
import { IndexArray } from '../../types';
import DetailCell from './DetailCell';
import { RowHeightContext } from './rowHeightContext';
import { LensConfig } from './types';

type ViewGridProps = {
    height: number;
    width: number;
    columnWidth: () => number;
    estimatedColumnWidth: number;
    views: LensConfig[];
    rowIndices: IndexArray;
    onScroll: ({
        scrollUpdateWasRequested,
        scrollLeft,
        scrollTop,
    }: GridOnScrollProps) => void;
    orientation?: 'horizontal' | 'vertical';
};

export type Ref = {
    scrollTo: ({
        scrollLeft,
        scrollTop,
    }: {
        scrollLeft?: number | undefined;
        scrollTop?: number | undefined;
    }) => void;
    resetAfterRowIndex: (index: number) => void;
    resetAfterColumnIndex: (index: number) => void;
};

const ViewGrid: ForwardRefRenderFunction<Ref, ViewGridProps> = (
    {
        height,
        width,
        columnWidth,
        estimatedColumnWidth,
        views,
        rowIndices,
        onScroll,
        orientation = 'horizontal',
    },
    ref
) => {
    const gridRef = useRef<VariableSizeGrid>(null);

    const { rowHeight } = useContext(RowHeightContext);

    useImperativeHandle(
        ref,
        () => ({
            scrollTo: ({ scrollLeft, scrollTop }) => {
                gridRef.current?.scrollTo({ scrollLeft, scrollTop });
            },
            resetAfterRowIndex: (index: number) => {
                gridRef.current?.resetAfterRowIndex(index);
            },
            resetAfterColumnIndex: (index: number) => {
                gridRef.current?.resetAfterColumnIndex(index);
            },
        }),
        []
    );

    const isVertical = orientation === 'vertical';

    return (
        <VariableSizeGrid
            ref={gridRef}
            height={height}
            width={width}
            columnWidth={isVertical ? rowHeight : columnWidth}
            estimatedColumnWidth={estimatedColumnWidth}
            itemKey={({ columnIndex, rowIndex }) =>
                isVertical
                    ? `${views[columnIndex].key}/${rowIndices[rowIndex]}`
                    : `${views[rowIndex].key}/${rowIndices[columnIndex]}`
            }
            rowHeight={isVertical ? columnWidth : rowHeight}
            columnCount={isVertical ? views.length : rowIndices.length}
            rowCount={isVertical ? rowIndices.length : views.length}
            useIsScrolling={true}
            onScroll={onScroll}
            style={{ overflow: 'scroll' }}
            itemData={{ orientation }}
        >
            {DetailCell}
        </VariableSizeGrid>
    );
};

export default forwardRef(ViewGrid);
