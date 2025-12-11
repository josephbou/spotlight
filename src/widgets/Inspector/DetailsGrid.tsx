import {
    FunctionComponent,
    KeyboardEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import { VariableSizeGrid } from 'react-window';
import type { GridOnScrollProps, ListOnScrollProps } from 'react-window';
import { Dataset, useDataset } from '../../stores/dataset';
import tw, { styled } from 'twin.macro';
import getScrollbarSize from '../../browser';
import Header, { Ref as HeaderRef } from './Header';
import RowHeightContext from './rowHeightContext';
import { State as StoreState, useStore } from './store';
import ViewGrid from './ViewGrid';
import Info from '../../components/ui/Info';

export const MIN_COLUMN_WIDTH = 128;
export const COLUMN_COUNT_OPTIONS = [1, 2, 4, 6, 8, 10, 12, 14, 16];

const HEADER_SIZE = 24;

const DetailsGridWrapper = styled.div<{ orientation?: 'horizontal' | 'vertical' }>`
    ${tw`flex`}
    ${({ orientation }) => (orientation === 'vertical' ? tw`flex-col` : tw`flex-row`)}
`;

const viewsSelector = (state: StoreState) => state.lenses;
const focusedRowSelector = (d: Dataset) => d.lastFocusedRow;
const rowCountSelector = (d: Dataset) => d.length;
const selectedIndicesSelector = (d: Dataset) => d.selectedIndices;

const DetailsGrid: FunctionComponent<{
    width: number;
    height: number;
    visibleColumnsCount: number;
    orientation?: 'horizontal' | 'vertical';
}> = ({ width, height, visibleColumnsCount, orientation = 'horizontal' }) => {
    const isVertical = orientation === 'vertical';
    const [scrollbarWidth, scrollbarHeight] = getScrollbarSize();
    const detailsGrid = useRef<VariableSizeGrid>(null);
    const header = useRef<HeaderRef>(null);
    const scrollLeft = useRef<number>();
    const scrollTop = useRef<number>();
    const mouseDown = useRef(false);
    const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
    const leftItemIndex = useRef<number>(0);

    const views = useStore(viewsSelector);
    const focusedRow = useDataset(focusedRowSelector);
    const rowCount = useDataset(rowCountSelector);
    const rowIndices = useDataset(selectedIndicesSelector);

    const [itemCount, itemSize] = useMemo(() => {
        let visibleCount: number = visibleColumnsCount;
        const availableSpace = isVertical
            ? height - HEADER_SIZE - scrollbarHeight
            : width - HEADER_SIZE - scrollbarWidth;

        let newSize = availableSpace / visibleColumnsCount;
        // snap to next lower column count in the available options in order to keep min column width
        // For vertical, MIN_COLUMN_WIDTH might be MIN_ROW_HEIGHT? Assume same requirement.
        while (newSize < MIN_COLUMN_WIDTH && visibleCount > COLUMN_COUNT_OPTIONS[0]) {
            visibleCount =
                COLUMN_COUNT_OPTIONS[COLUMN_COUNT_OPTIONS.indexOf(visibleCount) - 1];
            newSize = availableSpace / visibleCount;
        }
        return [visibleCount, newSize];
    }, [
        visibleColumnsCount,
        width,
        height,
        scrollbarWidth,
        scrollbarHeight,
        isVertical,
    ]);

    const getItemSize = useCallback(() => itemSize, [itemSize]);

    useEffect(() => {
        detailsGrid.current?.resetAfterRowIndex(0);
        header.current?.resetAfterIndex(0);
    }, [views]);
    useEffect(() => {
        if (isVertical) detailsGrid.current?.resetAfterRowIndex(0);
        else detailsGrid.current?.resetAfterColumnIndex(0);
    }, [itemSize, isVertical]);

    const snapToItem = useCallback(
        (itemToScrollTo: number) => {
            if (isVertical) {
                detailsGrid.current?.scrollTo({
                    scrollTop: itemToScrollTo * itemSize,
                    scrollLeft: scrollLeft.current || 0,
                });
            } else {
                detailsGrid.current?.scrollTo({
                    scrollLeft: itemToScrollTo * itemSize,
                    scrollTop: scrollTop.current || 0,
                });
            }
            leftItemIndex.current = itemToScrollTo;
        },
        [itemSize, isVertical]
    );

    const snapToClosestItem = useCallback(() => {
        const currentScroll = isVertical
            ? scrollTop.current || 0
            : scrollLeft.current || 0;
        const itemToScrollTo = Math.round(currentScroll / itemSize);
        snapToItem(itemToScrollTo);
    }, [itemSize, snapToItem, isVertical]);

    useEffect(() => {
        // when item size changed compute new scroll position based on visible item
        if (isVertical) scrollTop.current = leftItemIndex.current * itemSize;
        else scrollLeft.current = leftItemIndex.current * itemSize;
        snapToClosestItem();
    }, [itemSize, snapToClosestItem, isVertical]);

    useEffect(() => {
        // scroll to focused item on focus
        if (focusedRow !== undefined) {
            snapToItem(Math.min(focusedRow, rowCount - visibleColumnsCount));
        }
    }, [focusedRow, rowCount, snapToItem, visibleColumnsCount]);

    const onScrollSnap = useCallback((): void => {
        // when mouse is still pressed dont scroll now but save scroll position
        if (mouseDown.current === false) {
            if (
                isVertical
                    ? scrollTop.current !== undefined
                    : scrollLeft.current !== undefined
            ) {
                snapToClosestItem();
            }
        }
    }, [snapToClosestItem, isVertical]);

    const onScroll = useCallback(
        ({
            scrollUpdateWasRequested,
            scrollLeft: scrollOffsetLeft,
            scrollTop: scrollOffsetTop,
        }: GridOnScrollProps) => {
            header.current?.scrollTo(isVertical ? scrollOffsetLeft : scrollOffsetTop);

            if (scrollTimer.current !== undefined) {
                clearTimeout(scrollTimer.current);
            }

            scrollLeft.current = scrollOffsetLeft;
            scrollTop.current = scrollOffsetTop;

            if (!scrollUpdateWasRequested) {
                scrollTimer.current = setTimeout(onScrollSnap, 150);
            }
        },
        [onScrollSnap, isVertical]
    );

    const onScrollHeader = useCallback(
        ({ scrollOffset, scrollUpdateWasRequested }: ListOnScrollProps) => {
            if (scrollUpdateWasRequested) return;
            detailsGrid.current?.scrollTo({
                scrollTop: isVertical ? scrollTop.current || 0 : scrollOffset,
                scrollLeft: isVertical ? scrollOffset : scrollLeft.current || 0,
            });
        },
        [isVertical]
    );

    const onMouseDown = useCallback(() => {
        mouseDown.current = true;
    }, []);
    const onMouseUp = useCallback(() => {
        mouseDown.current = false;
        if (
            isVertical
                ? scrollTop.current !== undefined
                : scrollLeft.current !== undefined
        ) {
            snapToClosestItem();
        }
    }, [snapToClosestItem, isVertical]);

    const onResize = useCallback(
        (resizedViewKey?: string) => {
            const resizedIndex = views.findIndex(({ key }) => key === resizedViewKey);
            // resetAfterRowIndex logic change?
            // RowHeightContext triggers this.
            // If horizontal: attributes are rows. resetAfterRowIndex(resizedIndex).
            // If vertical: attributes are columns. resetAfterColumnIndex(resizedIndex).
            if (isVertical)
                detailsGrid.current?.resetAfterColumnIndex(Math.max(0, resizedIndex));
            else detailsGrid.current?.resetAfterRowIndex(Math.max(0, resizedIndex));

            header.current?.resetAfterIndex(Math.max(0, resizedIndex));
            header.current?.scrollToItemBottom(resizedIndex);
        },
        [views, isVertical]
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            const lastSelectedIndex = leftItemIndex.current;

            const step =
                (e.key === 'ArrowRight' && !isVertical) ||
                (e.key === 'ArrowDown' && isVertical)
                    ? 1
                    : (e.key === 'ArrowLeft' && !isVertical) ||
                        (e.key === 'ArrowUp' && isVertical)
                      ? -1
                      : 0;

            const nextSelectedIndex = Math.min(
                rowIndices.length - itemCount,
                Math.max(0, lastSelectedIndex + step)
            );

            if (nextSelectedIndex !== lastSelectedIndex) {
                detailsGrid.current?.scrollTo({
                    scrollLeft: isVertical ? undefined : nextSelectedIndex * itemSize,
                    scrollTop: isVertical ? nextSelectedIndex * itemSize : undefined,
                });
                leftItemIndex.current = nextSelectedIndex;
            }
        },
        [rowIndices, itemCount, itemSize, isVertical]
    );

    // Header Count logic:
    // Header items are views.

    // Styles:
    // Wrapper style updated above.

    return (
        <RowHeightContext onResize={onResize} orientation={orientation}>
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/no-noninteractive-tabindex */}
            <div tabIndex={0} onKeyDown={handleKeyDown} tw="focus:outline-none">
                <DetailsGridWrapper
                    style={{ width, height }}
                    onMouseDown={onMouseDown}
                    onMouseUp={onMouseUp}
                    orientation={orientation}
                >
                    <Header
                        ref={header}
                        height={isVertical ? HEADER_SIZE : height}
                        width={isVertical ? width : HEADER_SIZE}
                        itemCount={views.length}
                        onScroll={onScrollHeader}
                        orientation={orientation}
                    />
                    {rowIndices.length > 0 && views.length > 0 ? (
                        <ViewGrid
                            ref={detailsGrid}
                            height={isVertical ? height - HEADER_SIZE : height}
                            width={isVertical ? width : width - HEADER_SIZE}
                            columnWidth={getItemSize}
                            estimatedColumnWidth={itemSize}
                            rowIndices={rowIndices}
                            views={views}
                            onScroll={onScroll}
                            orientation={orientation}
                        />
                    ) : (
                        <Info>
                            {views.length === 0 ? (
                                <>No View Configured</>
                            ) : (
                                <>No Data Selected</>
                            )}
                        </Info>
                    )}
                </DetailsGridWrapper>
            </div>
        </RowHeightContext>
    );
};

export default DetailsGrid;
