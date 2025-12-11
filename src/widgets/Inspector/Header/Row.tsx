import XIcon from '../../../icons/X';
import Button from '../../../components/ui/Button';
import Tooltip from '../../../components/ui/Tooltip';
import { CSSProperties, FunctionComponent, useCallback, useContext } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import type { DraggableProvided } from 'react-beautiful-dnd';
import type { ListChildComponentProps as RowProps } from 'react-window';
import { Dataset, useDataset } from '../../../stores/dataset';
import tw, { styled } from 'twin.macro';
import { shallow } from 'zustand/shallow';
import { RowHeightContext } from '../rowHeightContext';
import { State as StoreState, useStore } from '../store';

const RowItemWrapper = styled.div(
    ({
        isDropped = false,
        orientation = 'horizontal',
    }: {
        isDropped?: boolean;
        orientation?: 'horizontal' | 'vertical';
    }) => [
        tw`flex items-center border-gray-400 bg-gray-100`,
        orientation === 'horizontal'
            ? tw`flex-col border-b border-r`
            : tw`flex-row border-r border-b`,
        isDropped && tw`border-none shadow`,
    ]
);

const ViewNameWrapper = styled.div<{ orientation?: 'horizontal' | 'vertical' }>`
    ${tw`flex-grow flex w-full h-full text-xs overflow-hidden`}
    ${({ orientation }) => (orientation === 'horizontal' ? tw`pb-1` : tw`pr-1`)}
    > div {
        ${tw`flex flex-row h-full w-full items-stretch place-content-around`}
    }
`;
const ViewName = styled.span<{ orientation?: 'horizontal' | 'vertical' }>`
    ${({ orientation }) =>
        orientation === 'horizontal'
            ? `writing-mode: vertical-rl; transform: rotate(-180deg);`
            : ``}
    ${tw`truncate`}
`;

const RowFactory: FunctionComponent<RowProps> = ({
    index: listIndex,
    data,
    ...props
}) => {
    const index = Math.floor(listIndex / 2);
    // const { orientation } = data || ({ orientation: 'horizontal' } as any);

    switch (listIndex % 2) {
        case 0:
            return <Row index={index} data={data} {...props} />;
        default:
            return <RowResizer index={index} data={data} {...props} />;
    }
};

const RowResizer: FunctionComponent<RowProps> = ({ index, style, data }) => {
    const { orientation } = (data as { orientation?: 'horizontal' | 'vertical' }) || {
        orientation: 'horizontal',
    };
    const isHorizontal = orientation === 'vertical'; // Header is horizontal

    // In horizontal list (Vertical Inspector), we resize width.
    // react-window passes style with left/width varying.

    // In vertical list (Horizontal Inspector), we resize height.
    // react-window passes style with top/height varying.

    const { startResize } = useContext(RowHeightContext);

    const onMouseDown = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            startResize(index, isHorizontal ? event.screenX : event.screenY);
        },
        [index, startResize, isHorizontal]
    );

    const resizeStyle = isHorizontal
        ? {
              ...style,
              width: 3,
              left: ((style.left as number) || 0) - 2,
              cursor: 'col-resize',
              zIndex: 1,
          }
        : {
              ...style,
              height: 3,
              top: ((style.top as number) || 0) - 2,
              cursor: 'row-resize',
              zIndex: 1,
          };

    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
            onMouseDown={onMouseDown}
            tw="transition-colors hover:bg-gray-500 relative" // removed w-full since it might be h-full
            className={isHorizontal ? 'h-full' : 'w-full'}
            style={resizeStyle}
        ></div>
    );
};

const Row: FunctionComponent<RowProps> = ({ index, style, data }) => {
    const viewSelector = useCallback(
        (state: StoreState) => state.lenses[index],
        [index]
    );
    const view = useStore(viewSelector);
    const { orientation } = (data as { orientation?: 'horizontal' | 'vertical' }) || {
        orientation: 'horizontal',
    };

    return (
        <Draggable index={index} draggableId={view.key} key={view.key}>
            {(provided: DraggableProvided) => (
                <DroppableRowItem
                    index={index}
                    style={style}
                    provided={provided}
                    orientation={orientation}
                />
            )}
        </Draggable>
    );
};

type DroppableItemProps = {
    index: number;
    style: CSSProperties;
    provided: DraggableProvided;
    isDropped?: boolean;
    orientation?: 'horizontal' | 'vertical';
};

export const DroppableRowItem: FunctionComponent<DroppableItemProps> = ({
    provided,
    index,
    style,
    isDropped,
    orientation = 'horizontal',
}) => {
    return (
        <RowItemWrapper
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            ref={provided.innerRef}
            style={{
                ...style,
                ...provided.draggableProps.style,
            }}
            isDropped={isDropped}
            orientation={orientation}
        >
            <RowItem index={index} orientation={orientation} />
        </RowItemWrapper>
    );
};

type ItemProps = {
    index: number;
    orientation?: 'horizontal' | 'vertical';
};

const removeViewSelector = (state: StoreState) => state.removeLens;

const RowItem: FunctionComponent<ItemProps> = ({
    index,
    orientation = 'horizontal',
}) => {
    const viewSelector = useCallback(
        (state: StoreState) => state.lenses[index],
        [index]
    );
    const view = useStore(viewSelector);
    const removeView = useStore(removeViewSelector);

    const columnNamesSelector = useCallback(
        (d: Dataset) =>
            d.columns
                .filter(({ key }) => view.columns.includes(key))
                .map(({ name }) => name)
                .join(),
        [view.columns]
    );
    const columnNames = useDataset(columnNamesSelector, shallow);

    const viewName =
        (!view?.name || view?.name === 'view') && columnNames
            ? columnNames
            : view?.name;
    const longViewName =
        viewName === columnNames || !viewName || !columnNames
            ? viewName
            : `${viewName} (${columnNames})`;

    const onRemoveView = useCallback(
        () => view && removeView(view),
        [removeView, view]
    );

    return (
        <>
            <Button onClick={onRemoveView}>
                <XIcon />
            </Button>
            <ViewNameWrapper orientation={orientation}>
                <Tooltip content={longViewName} followCursor={true}>
                    <ViewName orientation={orientation}>{viewName}</ViewName>
                </Tooltip>
            </ViewNameWrapper>
        </>
    );
};

export default RowFactory;
