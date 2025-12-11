import 'twin.macro';
import { FunctionComponent } from 'react';
import AddViewButton from '../AddViewButton';
import ColumnCountSelect from './ColumnCountSelect';
import OrientationSelect from './OrientationSelect';
import { WidgetMenu } from '../../../lib';

interface Props {
    visibleColumnsCount: number;
    setVisibleColumnsCount: (count: number) => void;
    visibleColumnsCountOptions: number[];
    orientation: 'horizontal' | 'vertical';
    setOrientation: (orientation: 'horizontal' | 'vertical') => void;
}

const MenuBar: FunctionComponent<Props> = ({
    visibleColumnsCount,
    setVisibleColumnsCount,
    visibleColumnsCountOptions,
    orientation,
    setOrientation,
}) => {
    return (
        <WidgetMenu>
            <div tw="flex-grow" />
            <OrientationSelect
                orientation={orientation}
                setOrientation={setOrientation}
            />
            <div tw="w-2" />
            <ColumnCountSelect
                visibleColumnsCount={visibleColumnsCount}
                setVisibleColumnsCount={setVisibleColumnsCount}
                visibleColumnsCountOptions={visibleColumnsCountOptions}
            />
            <AddViewButton />
        </WidgetMenu>
    );
};

export default MenuBar;
