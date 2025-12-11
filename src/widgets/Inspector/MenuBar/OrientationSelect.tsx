import Select from '../../../components/ui/Select';
import Tooltip from '../../../components/ui/Tooltip';
import { FunctionComponent, ReactNode, useCallback } from 'react';
import { MdOutlineScreenRotation } from 'react-icons/md';
import tw from 'twin.macro';

interface Props {
    orientation: 'horizontal' | 'vertical';
    setOrientation: (orientation: 'horizontal' | 'vertical') => void;
}

const OrientationIcon = tw(
    MdOutlineScreenRotation
)`w-4 h-4 inline-block align-middle stroke-current`;

const singleValueTemplate = (children: ReactNode) => (
    <div tw="flex items-center">
        <OrientationIcon tw="mr-0.5" />
        <span>{children}</span>
    </div>
);

const OPTIONS = ['horizontal', 'vertical'] as const;

const LABELS: Record<string, string> = {
    horizontal: 'Horizontal',
    vertical: 'Vertical',
};

const OrientationSelect: FunctionComponent<Props> = ({
    orientation,
    setOrientation,
}) => {
    const onChangeOrientation = useCallback(
        (value?: 'horizontal' | 'vertical') => {
            if (value) setOrientation(value);
        },
        [setOrientation]
    );

    const getLabel = useCallback(
        (val?: 'horizontal' | 'vertical') => (val ? LABELS[val] : ''),
        []
    );

    return (
        <Tooltip content="Orientation">
            <Select
                isSearchable={false}
                options={OPTIONS}
                value={orientation}
                onChange={onChangeOrientation}
                label={getLabel}
                variant="inline"
                singleValueTemplate={singleValueTemplate}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={false}
            />
        </Tooltip>
    );
};

export default OrientationSelect;
